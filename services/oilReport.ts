// ===================================
// Oil analysis reports — PDF through the shared table report (services/pmsHistoryReport)
// and .xlsx (services/sheetFiles). English, as every report.
//   Point    one sampling point: its details, the trend of every parameter
//            over the last samples (C = caution, A = action), each sample with
//            its verdict, findings and the officer's review.
//   Status   every point of the vessel: last sample, verdict, next due.
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { saveSheet } from './sheetFiles';
import { assess, limitFor, pointStatus, pointTitle, previousResult, samplesOf, verdictOf } from './oil';
import { COMPARTMENT_LABEL, OilPoint, OilSample, PARAMS, ParamKey } from '../types/oil';

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const MARK = ['', ' C', ' A'];
const VERDICT = { normal: 'Normal', caution: 'Caution', action: 'ACTION' } as const;
/** The trend shows this many samples, newest last. */
const TREND_SAMPLES = 8;

const limitText = (p: OilPoint, k: ParamKey) => {
  const l = limitFor(p, k);
  if (!l) return '';
  const kind = PARAMS.find((d) => d.key === k)!.kind;
  const u = kind === 'visc' ? ' %' : kind === 'tbn' ? ' % of new' : kind === 'tan' ? ' over new' : '';
  return `${l.c ?? '—'} / ${l.a ?? '—'}${u}`;
};

function facts(p: OilPoint, machineHours?: number, all: OilSample[] = [], today = '') {
  const st = pointStatus(p, all, machineHours, today);
  const every = [p.intervalDays ? `${p.intervalDays} days` : '', p.intervalHours ? `${p.intervalHours} h` : ''].filter(Boolean).join(' or ');
  const nu = p.newOil ?? {};
  return [
    COMPARTMENT_LABEL[p.compartment],
    p.oil ? `Oil ${p.oil}${p.capacity ? `, ${p.capacity} L` : ''}` : '',
    p.lab ? `Lab ${p.lab}${p.labRef ? ` (${p.labRef})` : ''}` : '',
    every ? `Sampled every ${every}` : '',
    nu.v40 || nu.v100 || nu.tbn || nu.tan ? `New oil: ${[nu.v40 ? `V40 ${nu.v40}` : '', nu.v100 ? `V100 ${nu.v100}` : '', nu.tbn ? `TBN ${nu.tbn}` : '', nu.tan != null ? `TAN ${nu.tan}` : ''].filter(Boolean).join(', ')}` : '',
    p.isoTarget ? `ISO target ${p.isoTarget}` : '',
    st.dueDate || st.dueHours ? `Next due ${[st.dueDate ? dmy(st.dueDate) : '', st.dueHours ? `${st.dueHours} h` : ''].filter(Boolean).join(' / ')}` : '',
  ].filter(Boolean);
}

export function exportOilPoint(p: OilPoint, all: OilSample[], machineHours: number | undefined, today: string, vessel: VesselInfo | null) {
  const list = samplesOf(p.id, all);
  const res = list.filter((s) => s.result).slice(-TREND_SAMPLES);
  const keys = PARAMS.filter((d) => res.some((s) => s.result!.values[d.key] != null));
  const levels = res.map((s) => assess(p, s.result!, previousResult(s, all)).byKey);
  const trendRows = keys.map((d) => [
    d.label, d.unit, limitText(p, d.key),
    ...res.map((s, i) => {
      const v = s.result!.values[d.key];
      return v == null ? '' : `${v}${MARK[levels[i][d.key] ?? 0]}`;
    }),
  ]);
  if (res.some((s) => s.result!.iso)) trendRows.push(['ISO 4406', '', p.isoTarget ? `target ${p.isoTarget}` : '', ...res.map((s, i) => (s.result!.iso ? `${s.result!.iso}${MARK[levels[i].iso ?? 0]}` : ''))]);
  trendRows.push(['Running hours', 'h', '', ...res.map((s) => (s.machineHours != null ? String(s.machineHours) : ''))]);
  trendRows.push(['Hours on oil', 'h', '', ...res.map((s) => (s.oilHours != null ? String(s.oilHours) : ''))]);
  trendRows.push(['Verdict', '', '', ...res.map((s) => VERDICT[verdictOf(p, s, all) ?? 'normal'])]);
  const col = res.length ? Math.floor((273 - 95) / res.length) : 0;
  const trendWidths: Record<number, number> = { 0: 45, 1: 20, 2: 30 };
  res.forEach((_, i) => { trendWidths[3 + i] = col; });

  const sampleRows = [...list].reverse().map((s) => {
    const a = s.result ? assess(p, s.result, previousResult(s, all)) : null;
    return [
      dmy(s.date),
      [s.machineHours != null ? `${s.machineHours} h` : '', s.oilHours != null ? `oil ${s.oilHours} h` : '', s.topUp ? `top-up ${s.topUp} L` : ''].filter(Boolean).join(', '),
      [s.bottle ?? '', s.result?.labNo && s.result.labNo !== s.bottle ? s.result.labNo : ''].filter(Boolean).join(' / '),
      s.result ? dmy(s.result.date) : s.sent ? `sent ${dmy(s.sent.date)}` : 'not sent',
      a ? a.findings.map((f) => f.text).join('; ') || 'Within limits' : '',
      s.review ? `${VERDICT[s.review.verdict]} — ${s.review.action}${s.review.oilChanged ? ' (oil changed)' : ''}` : s.result ? 'Not reviewed' : '',
      s.review ? `${s.review.by}${s.review.byRank ? ` (${s.review.byRank})` : ''} ${dmy(s.review.date)}` : '',
    ];
  });

  const title = pointTitle(p);
  return exportPmsHistory('Oil analysis', `Oil ${title}`, vessel, [{
    title: `Oil analysis — ${title}`,
    facts: facts(p, machineHours, all, today),
    tables: [
      ...(res.length ? [{ title: `Trend (C = caution, A = action; limits caution / action)`, head: ['Parameter', 'Unit', 'Limits', ...res.map((s) => dmy(s.date))], rows: trendRows, widths: trendWidths }] : []),
      { title: 'Samples', head: ['Taken', 'Hours', 'Bottle / lab no.', 'Result', 'Findings', 'Review and action', 'Reviewed by'], rows: sampleRows, widths: { 0: 18, 1: 32, 2: 25, 3: 22, 4: 78, 5: 65, 6: 33 } },
      { title: 'Signed', head: ['Chief Engineer', 'Master'], rows: [['', '']], widths: { 0: 136, 1: 137 } },
    ],
  }]);
}

export function oilPointSheet(p: OilPoint, all: OilSample[], vessel: VesselInfo | null) {
  const list = samplesOf(p.id, all);
  const head = ['Taken', 'Running hours', 'Hours on oil', 'Top-up (L)', 'Bottle', 'Sent', 'Report date', 'Lab no.', ...PARAMS.map((d) => `${d.label}${d.unit ? ` (${d.unit})` : ''}`), 'ISO 4406', 'Lab verdict', 'Lab comment', 'Verdict', 'Findings', 'Review action', 'Oil changed', 'Reviewed by', 'Reviewed on'];
  const rows = list.map((s) => {
    const a = s.result ? assess(p, s.result, previousResult(s, all)) : null;
    return [
      s.date, s.machineHours ?? '', s.oilHours ?? '', s.topUp ?? '', s.bottle ?? '', s.sent?.date ?? '', s.result?.date ?? '', s.result?.labNo ?? '',
      ...PARAMS.map((d) => s.result?.values[d.key] ?? ''),
      s.result?.iso ?? '', s.result?.labVerdict ?? '', s.result?.labComment ?? '',
      verdictOf(p, s, all) ?? '', a ? a.findings.map((f) => f.text).join('; ') : '',
      s.review?.action ?? '', s.review?.oilChanged ? 'yes' : '', s.review ? s.review.by : '', s.review?.date ?? '',
    ];
  });
  return saveSheet([head, ...rows], 'Oil analysis', `Oil ${pointTitle(p)}`, vessel);
}

export function exportOilStatus(points: OilPoint[], all: OilSample[], hoursOf: (machineId?: string) => number | undefined, today: string, vessel: VesselInfo | null) {
  const rows = points.map((p) => {
    const st = pointStatus(p, all, hoursOf(p.machineId), today);
    return [
      pointTitle(p),
      COMPARTMENT_LABEL[p.compartment],
      p.oil ?? '',
      st.last ? dmy(st.last.date) : 'never',
      st.verdict ? VERDICT[st.verdict] : '',
      [st.dueDate ? dmy(st.dueDate) : '', st.dueHours ? `${st.dueHours} h` : ''].filter(Boolean).join(' / ') || (st.due === 'never' ? 'now' : ''),
      { never: 'Never sampled', ok: '', soon: 'Due soon', overdue: 'OVERDUE' }[st.due],
      [st.awaiting ? `${st.awaiting} at the lab${st.late ? ` (${st.late} late)` : ''}` : '', st.toReview ? `${st.toReview} to review` : ''].filter(Boolean).join(', '),
    ];
  });
  const due = points.filter((p) => ['overdue', 'never'].includes(pointStatus(p, all, hoursOf(p.machineId), today).due)).length;
  return exportPmsHistory('Oil analysis status', `Oil analysis ${today}`, vessel, [{
    title: 'Oil analysis — status',
    facts: [`${points.length} sampling points`, `${due} due now`, dmy(today)],
    tables: [{ title: 'Sampling points', head: ['Point', 'Compartment', 'Oil', 'Last sample', 'Verdict', 'Next due', 'Status', 'Open'], rows, widths: { 0: 62, 1: 40, 2: 38, 3: 20, 4: 18, 5: 30, 6: 25, 7: 40 } }],
  }]);
}

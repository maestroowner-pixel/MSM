// ===================================
// External inspections — the pure part (types/extInspection.ts): the number,
// the findings raised as NCs, and the visit's state worked out from them.
// Tested by `npm run check:extinsp`.
// ===================================

import { ExternalInspection, ExtInspKind, EXT_INSP_KIND_LABEL, PSC_ACTIONS } from '../types/extInspection';
import { CapaAction, CAPA_KIND_LABEL as CAPA_EN, NcGrade, NcSource, NC_GRADE_LABEL as NC_GRADE_EN, NonConformity } from '../types/safety';
import { NC_STATE_LABEL as NC_STATE_EN, ncState, nextNcNo } from './safety';
import { uid } from '../utils/id';

/** EI-2026-01, -02… */
export function nextInspNo(list: ExternalInspection[], date: string): string {
  const y = date.slice(0, 4);
  const re = new RegExp(`^EI-${y}-(\\d+)$`);
  const top = list.reduce((m, x) => Math.max(m, Number(re.exec(x.no)?.[1] ?? 0)), 0);
  return `EI-${y}-${String(top + 1).padStart(2, '0')}`;
}

export const NC_SOURCE_OF: Record<ExtInspKind, NcSource> = {
  psc: 'psc', flag: 'flag_class', class: 'flag_class', superintendent: 'superintendent', vetting: 'vetting',
  ism_audit: 'external_audit', mlc_audit: 'external_audit', other: 'other',
};

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const addMonths = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last), 12)).toISOString().slice(0, 10);
};

/** The date a PSC action code gives to put it right; undefined when the code has none (the officer sets it). */
export function dueForAction(code: string | undefined, date: string): string | undefined {
  const a = PSC_ACTIONS.find((x) => x.code === code);
  if (!a) return undefined;
  if (a.months != null) return addMonths(date, a.months);
  if (a.days != null) return addDays(date, a.days);
  return undefined;
}

/** Code 30 is a detainable deficiency — a major NC whatever else was chosen. */
export const gradeForAction = (code: string | undefined, grade: NcGrade): NcGrade => (code === '30' ? 'major' : grade);

/** A finding as written on the inspection's screen, before it is an NC. */
export interface FindingDraft {
  text: string;
  requirement?: string;
  grade: NcGrade;
  pscCode?: string;
  pscAction?: string;
  /** By when — the correction's date. */
  due: string;
  /** Who puts it right. */
  owner: string;
  /** The correction, if other than "put right what was found". */
  todo?: string;
}

export const findingProblem = (f: FindingDraft): 'text' | 'due' | 'owner' | null =>
  !f.text.trim() ? 'text' : !/^\d{4}-\d{2}-\d{2}$/.test(f.due) ? 'due' : !f.owner.trim() ? 'owner' : null;

type Signer = { name: string; rank?: string };

/**
 * The findings as NCs, numbered after `ncs` (NC-2026-004, -005…). Each gets one
 * correction action — owner and date from the finding; a PSC code 10 (rectified
 * during the inspection) is that action already done, by whoever records it.
 */
export function findingsToNcs(insp: ExternalInspection, drafts: FindingDraft[], ncs: NonConformity[], by: Signer, now: number): NonConformity[] {
  const out: NonConformity[] = [];
  for (const f of drafts) {
    const text = f.text.trim();
    const rectified = f.pscAction === '10';
    const action: CapaAction = {
      id: uid('ac'), kind: 'correction', text: f.todo?.trim() || `Rectify: ${text}`, owner: f.owner.trim(), due: f.due,
      ...(rectified ? { doneAt: now, doneBy: by.name, ...(by.rank ? { doneByRank: by.rank } : {}), doneNote: 'Rectified during the inspection (PSC action code 10)' } : {}),
    };
    out.push({
      id: uid('nc'), no: nextNcNo([...ncs, ...out], insp.date), date: insp.date, source: NC_SOURCE_OF[insp.kind],
      sourceRef: insp.reportNo?.trim() || insp.no, inspId: insp.id,
      ...(f.pscCode?.trim() ? { pscCode: f.pscCode.trim() } : {}), ...(f.pscAction ? { pscAction: f.pscAction } : {}),
      grade: gradeForAction(f.pscAction, f.grade), title: text.split('\n')[0].slice(0, 90), what: text,
      ...(insp.port?.trim() ? { where: insp.port.trim() } : {}), ...(f.requirement?.trim() ? { requirement: f.requirement.trim() } : {}),
      actions: [action], raisedBy: by.name, ...(by.rank ? { raisedByRank: by.rank } : {}), raisedAt: now, updatedAt: now,
    });
  }
  return out;
}

export const findingsOf = (insp: ExternalInspection, ncs: NonConformity[]) =>
  ncs.filter((n) => n.inspId === insp.id).sort((a, b) => a.no.localeCompare(b.no));

/**
 * clean — nothing found; overdue — an action past its date; open — findings to put right;
 * closed — every NC closed by the Master; verified — and every one verified by the office.
 */
export type InspState = 'clean' | 'overdue' | 'open' | 'closed' | 'verified';

export interface InspStatus {
  state: InspState;
  total: number;
  closed: number;
  verified: number;
  overdue: number;
  /** Detained and not yet released. */
  detainedNow: boolean;
}

export function inspStatus(insp: ExternalInspection, ncs: NonConformity[], today: string): InspStatus {
  const f = findingsOf(insp, ncs);
  const closed = f.filter((n) => n.closedAt).length;
  const verified = f.filter((n) => n.office?.result === 'verified').length;
  const overdue = f.filter((n) => ncState(n, today) === 'overdue').length;
  const state: InspState = !f.length ? 'clean' : overdue ? 'overdue' : closed < f.length ? 'open' : verified === f.length ? 'verified' : 'closed';
  return { state, total: f.length, closed, verified, overdue, detainedNow: !!insp.detained && !insp.releasedOn };
}

const ORDER: Record<InspState, number> = { overdue: 0, open: 1, closed: 2, verified: 3, clean: 4 };
/** A detention not lifted first, then overdue, open… and newest first within each. */
export function sortInspections(list: ExternalInspection[], ncs: NonConformity[], today: string): ExternalInspection[] {
  const key = new Map(list.map((x) => {
    const s = inspStatus(x, ncs, today);
    return [x.id, (s.detainedNow ? -1 : 0) * 10 + ORDER[s.state]];
  }));
  return [...list].sort((a, b) => key.get(a.id)! - key.get(b.id)! || b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
}

/** For the superintendent's vessel card: the last PSC, findings still open, overdue, a detention not lifted. */
export function extSummary(list: ExternalInspection[], ncs: NonConformity[], today: string) {
  const psc = list.filter((x) => x.kind === 'psc').sort((a, b) => b.date.localeCompare(a.date))[0];
  let open = 0;
  let overdue = 0;
  let detained = false;
  for (const x of list) {
    const s = inspStatus(x, ncs, today);
    open += s.total - s.closed;
    overdue += s.overdue;
    detained = detained || s.detainedNow;
  }
  return { lastPsc: psc ? { date: psc.date, port: psc.port, findings: findingsOf(psc, ncs).length, detained: !!psc.detained } : undefined, open, overdue, detained };
}

// ---- the papers (English, whatever the device says) ----------------------------

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const dmyT = (ms?: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};
const whoOf = (by?: string, rank?: string) => (by ? (rank ? `${by} (${rank})` : by) : '');
const how = (m?: { method?: string }) => (!m ? '' : m.method === 'biometric' ? 'signed biometrically' : m.method === 'drawn' ? 'signed by hand' : 'signed by PIN');
const STATE_EN: Record<InspState, string> = { clean: 'No findings', open: 'Findings open', overdue: 'Finding overdue', closed: 'All findings closed aboard', verified: 'All findings closed and verified by the office' };

export const FINDING_HEAD = ['No.', 'Finding', 'PSC codes', 'Grade', 'Requirement', 'Root cause', 'Actions', 'Status', 'Closed', 'Office'];

/**
 * The inspection as one section of the A4 landscape report (services/pmsHistoryReport):
 * the visit, its state, and every finding with its actions, closure and the office's verification —
 * what the vessel sends to the flag, class or the company as its answer to the findings.
 */
export function inspReport(insp: ExternalInspection, ncs: NonConformity[], today: string): import('./pmsHistory').MachineHistory {
  const s = inspStatus(insp, ncs, today);
  const rows = findingsOf(insp, ncs).map((n) => [
    n.no,
    [n.title, n.what !== n.title ? n.what : ''].filter(Boolean).join(' — '),
    [n.pscCode ? `Deficiency ${n.pscCode}` : '', n.pscAction ? `Action ${n.pscAction} ${PSC_ACTIONS.find((a) => a.code === n.pscAction)?.label ?? ''}`.trim() : ''].filter(Boolean).join('\n'),
    NC_GRADE_EN[n.grade],
    n.requirement ?? '',
    n.rootCause ?? '',
    n.actions.map((a) => `${CAPA_EN[a.kind]}: ${a.text} — ${a.owner}, by ${dmy(a.due)}${a.doneAt ? ` · done ${dmyT(a.doneAt)} ${whoOf(a.doneBy, a.doneByRank)}${a.doneNote ? ` (${a.doneNote})` : ''}` : ''}`).join('\n'),
    NC_STATE_EN[ncState(n, today)],
    n.closedAt ? [dmyT(n.closedAt), whoOf(n.closedBy, n.closedByRank), how(n.closedWith), n.effectiveness ? `Effective: ${n.effectiveness}` : ''].filter(Boolean).join(' · ') : '',
    n.office ? `${n.office.result === 'verified' ? 'Verified' : 'Returned'} ${dmyT(n.office.at)} ${whoOf(n.office.by, n.office.byRank)}${n.office.note ? ` — ${n.office.note}` : ''}` : '',
  ]);
  return {
    title: `${EXT_INSP_KIND_LABEL[insp.kind]}${insp.port ? ` — ${insp.port}` : ''}, ${dmy(insp.date)} (${insp.no})`,
    facts: [
      [insp.authority, insp.inspector ? `Inspector: ${insp.inspector}` : '', insp.reportNo ? `Report: ${insp.reportNo}` : ''].filter(Boolean).join(' · '),
      insp.detained ? (insp.releasedOn ? `DETAINED — detention lifted ${dmy(insp.releasedOn)}` : 'DETAINED — not yet lifted') : '',
      `${STATE_EN[s.state]} · ${s.total} finding(s), ${s.closed} closed, ${s.verified} verified by the office${s.overdue ? `, ${s.overdue} overdue` : ''}`,
      `Recorded by ${whoOf(insp.by, insp.byRank)}, ${dmyT(insp.at)}${insp.signedWith ? ` · ${how(insp.signedWith)}` : ''}`,
      insp.note ? `Note: ${insp.note}` : '',
    ].filter(Boolean),
    tables: rows.length ? [{ title: 'Findings', head: FINDING_HEAD, rows, widths: { 0: 20, 1: 41, 2: 28, 3: 22, 4: 24, 5: 24, 6: 50, 7: 20, 8: 26, 9: 22 } }] : [],
  };
}

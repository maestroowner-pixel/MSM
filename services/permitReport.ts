// ===================================
// A permit to work as a document — with its toolbox meeting report — for the
// file and for wet signatures (10 Oct 2026). A4 portrait.
//
//   1  the permit: type, number, vessel, status
//   2  the work: what, where, valid from / until, team, risk assessment
//   3  precautions with their answers; gas readings; isolations and notes
//   4  hazards of the risk assessment, controls, residual risk
//   5  toolbox meeting report: place, job, attendees (present, and a column
//      to sign by hand), topics covered, raised / agreed
//   6  signatures: requested, approved, started, closed (with the closing time)
//
// The rows are built once here; the browser draws them with jsPDF
// (utils/permitPdf.web.ts), phones print the HTML below.
// ===================================

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

import { VesselInfo } from './storage';
import { esc, share, vesselHeader } from './export';
import { RISK_LABEL, riskLevel } from './permits';
import { proofShort } from './signature';
import { PERMIT_TYPE_MAP } from '../constants/permitTypes';
import { TOOLBOX_TOPICS } from '../constants/toolbox';
import { PERMIT_STATUS_LABEL, Permit, RiskAssessment, SignStamp } from '../types/permits';
import { onWeb, onWindows } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { permitPdfBlob } from '../utils/permitPdf';

const ANSWER: Record<string, string> = { yes: 'Yes', no: 'NO', na: 'N/A' };
const dt = (local?: string) => (local ? local.replace('T', ' ') : '—');
const stampTime = (at: number) => {
  const d = new Date(at);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};

export interface PermitDoc {
  title: string;
  vesselLine: string;
  status: string;
  work: [string, string][];
  checks: string[][];
  gas: string[][];
  notes?: string;
  hazards: string[][];
  toolbox?: { lines: [string, string][]; attendees: string[][]; topics: string[]; concerns?: string };
  signatures: { step: string; who: string; when: string; how: string; drawing?: string }[];
}

export function permitDoc(p: Permit, ra: RiskAssessment | undefined, vessel: VesselInfo | null): PermitDoc {
  const def = PERMIT_TYPE_MAP[p.type];
  const sig = (step: string, s?: SignStamp, extra?: string) =>
    s ? [{ step, who: s.byRank ? `${s.by} (${s.byRank})` : s.by, when: `${stampTime(s.at)}${extra ? ` · ${extra}` : ''}`, how: proofShort(s.signedWith) || '—', ...(s.signedWith?.drawing ? { drawing: s.signedWith.drawing } : {}) }] : [];
  const t = p.toolbox;
  return {
    title: `Permit to work — ${def.label}${p.no ? ` · ${p.no}` : ''}`,
    vesselLine: vesselHeader(vessel),
    status: PERMIT_STATUS_LABEL[p.status],
    work: [
      ['Work', p.work || '—'],
      ['Location', p.location || '—'],
      ['Valid from', dt(p.from)],
      ['Valid until (permit closes)', dt(p.to)],
      ['Team', p.team.join(', ') || '—'],
      ['Risk assessment', ra ? `${ra.no ?? ''} ${ra.title}`.trim() : '—'],
    ],
    checks: def.checks.map((c) => [c.text, p.checks[c.id] ? ANSWER[p.checks[c.id]] : '—']),
    gas: (p.gasTests ?? []).map((g) => [stampTime(g.at), g.o2 != null ? `${g.o2}` : '', g.lel != null ? `${g.lel}` : '', g.h2s != null ? `${g.h2s}` : '', g.co != null ? `${g.co}` : '', g.by, g.instrument ?? '']),
    notes: p.notes?.trim() || undefined,
    hazards: (ra?.hazards ?? []).map((h) => [
      h.hazard,
      h.controls ?? '',
      RISK_LABEL[riskLevel(h.likelihood, h.severity)],
      h.residualLikelihood && h.residualSeverity ? RISK_LABEL[riskLevel(h.residualLikelihood, h.residualSeverity)] : '',
    ]),
    toolbox: t
      ? {
          lines: [
            ['Held', `${stampTime(t.at)} by ${t.byRank ? `${t.by} (${t.byRank})` : t.by}${t.signedWith ? ` · ${proofShort(t.signedWith)}` : ''}`],
            ['Place', t.location],
            ['Job discussed', t.work],
          ],
          attendees: t.attendees.map((a, i) => [String(i + 1), a.name, p.team.includes(a.name) ? 'team' : 'also present', a.present ? 'present' : 'ABSENT', '']),
          topics: TOOLBOX_TOPICS.map((x) => `${t.topics.includes(x.id) ? '☑' : '☐'} ${x.text}`),
          concerns: t.concerns,
        }
      : undefined,
    signatures: [
      ...sig('Requested', p.requested),
      ...sig('Approved', p.approved),
      ...sig('Work started', p.started),
      ...sig('Closed — work complete, area safe', p.closed, p.closedAt ? `finished ${dt(p.closedAt)}` : undefined),
      ...sig('Cancelled', p.cancelled),
    ],
  };
}

export function permitFileName(p: Permit, vessel: VesselInfo | null) {
  const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return `${p.no ?? 'Permit draft'} ${PERMIT_TYPE_MAP[p.type].label}${v ? `-${v}` : ''}.pdf`.replace(/[\\/:*?"<>|]+/g, ' ');
}

function table(head: string[], rows: string[][]) {
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function html(d: PermitDoc): string {
  const sigRows = d.signatures
    .map((s) => `<tr><td>${esc(s.step)}</td><td>${esc(s.who)}</td><td>${esc(s.when)}</td><td>${esc(s.how)}</td><td class="sig">${s.drawing ? `<svg viewBox="0 0 300 100" width="72" height="24"><path d="${esc(s.drawing)}" stroke="#0B2545" stroke-width="3" fill="none" stroke-linecap="round"/></svg>` : ''}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 0; } body { margin: 12mm; font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 9px; color: #0B2545; }
    h1 { font-size: 15px; margin: 0; } h2 { font-size: 11px; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: .5px; }
    .sub { color: #5b6b7e; margin: 2px 0 6px; } table { border-collapse: collapse; width: 100%; } td, th { border: .5px solid #c8d0db; padding: 3px 4px; vertical-align: top; text-align: left; }
    th { background: #eef2f7; font-size: 8px; } td.k { width: 30%; color: #5b6b7e; } td.sig { width: 80px; height: 22px; } .topics { columns: 2; }
  </style></head><body>
    <h1>${esc(d.title)}</h1><div class="sub">${esc(d.vesselLine)} · Status: ${esc(d.status)}</div>
    <h2>The work</h2><table>${d.work.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    <h2>Precautions</h2>${table(['Precaution', 'Answer'], d.checks)}
    ${d.gas.length ? `<h2>Gas readings</h2>${table(['Time', 'O₂ %', 'LEL %', 'H₂S ppm', 'CO ppm', 'By', 'Instrument'], d.gas)}` : ''}
    ${d.notes ? `<h2>Isolations and notes</h2><div>${esc(d.notes)}</div>` : ''}
    ${d.hazards.length ? `<h2>Hazards (risk assessment)</h2>${table(['Hazard', 'Controls', 'Risk', 'Residual'], d.hazards)}` : ''}
    <h2>Toolbox meeting report</h2>
    ${d.toolbox ? `<table>${d.toolbox.lines.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
      <div style="margin-top:6px">${table(['#', 'Name', '', 'Attendance', 'Signature'], d.toolbox.attendees)}</div>
      <div class="topics" style="margin-top:6px">${d.toolbox.topics.map((x) => `<div>${esc(x)}</div>`).join('')}</div>
      ${d.toolbox.concerns ? `<div style="margin-top:6px"><b>Raised / agreed:</b> ${esc(d.toolbox.concerns)}</div>` : ''}` : '<div>Not held.</div>'}
    <h2>Signatures</h2><table><thead><tr><th>Step</th><th>Name</th><th>Time</th><th>Confirmed by</th><th>Signature</th></tr></thead><tbody>${sigRows || '<tr><td colspan="5">Not signed.</td></tr>'}</tbody></table>
  </body></html>`;
}

export async function exportPermitPdf(p: Permit, ra: RiskAssessment | undefined, vessel: VesselInfo | null): Promise<string | null | void> {
  if (onWindows) throw new Error('PDF export is not available on Windows.');
  const d = permitDoc(p, ra, vessel);
  const fileName = permitFileName(p, vessel);
  if (onWeb) return saveFileWeb(permitPdfBlob(d), fileName, 'reports');
  const { uri } = await Print.printToFileAsync({ html: html(d), width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${fileName}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    await share(dest, 'application/pdf', fileName);
  } catch {
    await share(uri, 'application/pdf', fileName);
  }
}

// ===================================
// QHSE — what a non-conformity's state is, its number, the order of the lists,
// and the rows of the registers (types/safety.ts).
// ===================================

import { NonConformity, SafetyObservation, NC_GRADE_LABEL, NC_SOURCE_LABEL, OBS_KIND_LABEL, CAPA_KIND_LABEL } from '../types/safety';

export type NcState = 'overdue' | 'open' | 'ready' | 'closed';

/** overdue — an action past its date; open — actions to do (or none yet); ready — all done, waiting for the Master; closed. */
export function ncState(nc: NonConformity, today: string): NcState {
  if (nc.closedAt) return 'closed';
  const left = nc.actions.filter((a) => !a.doneAt);
  if (left.some((a) => a.due && a.due < today)) return 'overdue';
  if (!nc.actions.length || left.length) return 'open';
  return 'ready';
}

export const NC_STATE_LABEL: Record<NcState, string> = { overdue: 'Action overdue', open: 'Open', ready: 'Actions done — to close', closed: 'Closed' };

/** The next number for the year: NC-2026-001, -002… */
export function nextNcNo(list: NonConformity[], date: string): string {
  const y = date.slice(0, 4);
  const re = new RegExp(`^NC-${y}-(\\d+)$`);
  const top = list.reduce((m, n) => Math.max(m, Number(re.exec(n.no)?.[1] ?? 0)), 0);
  return `NC-${y}-${String(top + 1).padStart(3, '0')}`;
}

const ORDER: Record<NcState, number> = { overdue: 0, ready: 1, open: 2, closed: 3 };
export function sortNcs(list: NonConformity[], today: string): NonConformity[] {
  return [...list].sort((a, b) => ORDER[ncState(a, today)] - ORDER[ncState(b, today)] || b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
}

/** New cards first (not yet reviewed), then by date. */
export function sortObservations(list: SafetyObservation[]): SafetyObservation[] {
  return [...list].sort((a, b) => Number(!!a.reviewedAt) - Number(!!b.reviewedAt) || b.date.localeCompare(a.date) || b.at - a.at);
}

export function nextActionDue(nc: NonConformity): string | undefined {
  return nc.actions.filter((a) => !a.doneAt && a.due).map((a) => a.due).sort()[0];
}

const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const dmyT = (t?: number) => {
  if (!t) return '';
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};
const who = (by?: string, rank?: string) => (by ? (rank ? `${by} (${rank})` : by) : '');
const how = (m?: { method?: string }) => (!m ? '' : m.method === 'biometric' ? 'signed biometrically' : m.method === 'drawn' ? 'signed by hand' : 'signed by PIN');

export const NC_HEAD = ['No.', 'Found', 'Grade', 'Source', 'Finding', 'Requirement', 'Root cause', 'Actions', 'Status', 'Closed'];
export function ncRows(list: NonConformity[], today: string): string[][] {
  return list.map((n) => [
    n.no, dmy(n.date), NC_GRADE_LABEL[n.grade], [NC_SOURCE_LABEL[n.source], n.sourceRef].filter(Boolean).join(' · '),
    [n.title, n.what, n.where ? `Where: ${n.where}` : ''].filter(Boolean).join(' — '),
    n.requirement ?? '', n.rootCause ?? '',
    n.actions.map((a) => `${CAPA_KIND_LABEL[a.kind]}: ${a.text} — ${a.owner}, by ${dmy(a.due)}${a.doneAt ? ` · done ${dmyT(a.doneAt)} ${who(a.doneBy, a.doneByRank)}${a.doneNote ? ` (${a.doneNote})` : ''}` : ''}`).join('\n'),
    NC_STATE_LABEL[ncState(n, today)],
    n.closedAt ? [dmyT(n.closedAt), who(n.closedBy, n.closedByRank), how(n.closedWith), n.effectiveness ? `Effective: ${n.effectiveness}` : ''].filter(Boolean).join(' · ') : '',
  ]);
}

export const OBS_HEAD = ['Date', 'Type', 'Topic', 'Where', 'Observed', 'Action taken', 'Stop work', 'By', 'Review', 'NC'];
export function obsRows(list: SafetyObservation[], ncs: NonConformity[]): string[][] {
  return list.map((o) => [
    dmy(o.date), OBS_KIND_LABEL[o.kind], o.topic, o.location ?? '', o.what, o.action ?? '', o.stoppedWork ? 'Yes' : '',
    o.anonymous ? 'Anonymous' : who(o.by, o.byRank),
    o.reviewedAt ? [dmyT(o.reviewedAt), who(o.reviewedBy, o.reviewedByRank), o.review].filter(Boolean).join(' · ') : 'Not reviewed',
    o.ncId ? ncs.find((n) => n.id === o.ncId)?.no ?? '' : '',
  ]);
}

/** Cards per type for a month, yyyy-mm — the monthly safety meeting's figures. */
export function obsCounts(list: SafetyObservation[], month: string) {
  const m = list.filter((o) => o.date.startsWith(month));
  return { total: m.length, near: m.filter((o) => o.kind === 'near_miss').length, good: m.filter((o) => o.kind === 'good_practice').length, stop: m.filter((o) => o.stoppedWork).length };
}

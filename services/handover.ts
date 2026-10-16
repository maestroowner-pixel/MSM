// ===================================
// Handover at crew change (backlog #18, 16 Oct 2026) — one PDF the outgoing
// officer leaves the relief: what is overdue now, what falls due over the next
// trip, open defects and non-conformities, rounds half done — and their own
// notes: work in progress, things to watch. Signed on paper by both and the
// Master; the app keeps no handover record.
//
// The findings are inspection readiness turned on TODAY with the trip's length
// as the look-ahead (services/readiness.ts), so a handover and a readiness
// check can never disagree. The notes are a draft on this device
// (`msm:handover_draft`, services/handoverReport.ts) until printed — nothing
// here syncs. This file is pure, so `npm run check:readiness` runs it in node.
// ===================================

import { READINESS_HEAD, Readiness, ReadinessInput, buildReadiness, sectionRows } from './readiness';

export const HANDOVER_KEY = 'msm:handover_draft';

export interface HandoverDraft {
  /** What is handed over — "Deck — Chief Officer", "Engine room", "Whole vessel". */
  area: string;
  fromName: string;
  fromRank: string;
  toName: string;
  toRank: string;
  /** Days ahead to list what falls due — the relief's trip. */
  ahead: number;
  /** Work in progress, one item a line. */
  progress: string;
  /** For the relief — things to watch, where things are, who to call. */
  remarks: string;
}

export const AHEAD_CHOICES = [30, 60, 90];

export function emptyDraft(me?: { name: string; rank?: string } | null): HandoverDraft {
  return { area: '', fromName: me?.name ?? '', fromRank: me?.rank ?? '', toName: '', toRank: '', ahead: 60, progress: '', remarks: '' };
}

/** Everything a PSC would look at, as of today, looking `ahead` days. */
export function buildHandover(x: Omit<ReadinessInput, 'kind' | 'date' | 'ahead'>, ahead: number): Readiness {
  return buildReadiness({ ...x, kind: 'psc', date: x.today, ahead });
}

const lines = (s: string) => s.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
const who = (name: string, rank: string) => [name.trim(), rank.trim() ? `(${rank.trim()})` : ''].filter(Boolean).join(' ');
const dmy = (iso: string) => iso.split('-').reverse().join('.');

/** The PDF's pages, pure — `npm run check:readiness` reads them. */
export function handoverPages(d: HandoverDraft, r: Readiness) {
  const overdue = r.red;
  const coming = r.amber;
  const facts = [
    `${dmy(r.today)}`,
    [who(d.fromName, d.fromRank) ? `from ${who(d.fromName, d.fromRank)}` : null, who(d.toName, d.toRank) ? `to ${who(d.toName, d.toRank)}` : null].filter(Boolean).join(' ') || 'handed over',
    `${overdue ? `${overdue} overdue / open now` : 'nothing overdue'} · ${coming ? `${coming} falling due in the next ${d.ahead} days` : `nothing due in the next ${d.ahead} days`}`,
  ];
  const notes = [
    ...(lines(d.progress).length ? [{ title: 'Work in progress', head: ['', 'Item'], rows: lines(d.progress).map((l, i) => [String(i + 1), l]), widths: { 0: 6, 1: 180 } }] : []),
    ...(lines(d.remarks).length ? [{ title: 'For the relief', head: ['', 'Note'], rows: lines(d.remarks).map((l, i) => [String(i + 1), l]), widths: { 0: 6, 1: 180 } }] : []),
  ];
  const found = r.sections.filter((s) => s.gaps.length).map((s) => ({ title: s.title, head: READINESS_HEAD, rows: sectionRows(s).map((row) => [row[0] === 'FINDING' ? 'NOW' : 'Coming', ...row.slice(1)]), widths: { 0: 14, 1: 70, 2: 90, 3: 16 } }));
  const clean = r.sections.filter((s) => !s.gaps.length).map((s) => s.title);
  const sign = { title: 'Handed over and taken over', head: ['', 'Name', 'Signature', 'Date'], rows: [['Outgoing', who(d.fromName, d.fromRank), '', ''], ['Incoming', who(d.toName, d.toRank), '', ''], ['Master', '', '', '']], widths: { 0: 20, 1: 70, 2: 70, 3: 30 } };
  return [{ title: `Handover${d.area.trim() ? ` — ${d.area.trim()}` : ''}`, facts: [...facts, ...(clean.length ? [`in order: ${clean.join(', ')}`] : [])], tables: [...notes, ...found, sign] }];
}

// ===================================
// An incident, a near miss or a finding told in words (plan AI-4, 6 Nov 2026):
// the AI drafts the non-conformity — what happened, where, the causes the
// account shows, the actions — and names this vessel's past NCs that look
// alike. A draft for the officer on the NC screen: it fills only what is still
// empty, the actions are ticked one by one, and the NC is raised and signed as
// any other.
//
// Names stay aboard: every name on the crew list, the guest list and the
// hospital's treatments is replaced by the rank (or "guest", "crew member")
// before the account or a past NC leaves the device.
// ===================================

import { CapaAction, CapaKind, CAPA_KIND_LABEL, NC_GRADES, NC_SOURCES, NcGrade, NcSource, NonConformity } from '../types/safety';

export const MAX_PAST_NCS = 80;
export const MAX_ACCOUNT = 4000;

export interface Person {
  name: string;
  /** What the name becomes: the rank, "guest", "crew member". */
  as: string;
}

const LETTER = 'A-Za-zÀ-ÿĀ-žА-яЁёІіЇїЄєҐґ';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The people whose names must not go: the whole name first, then each part of three letters or more. */
export function scrubNames(text: string, people: Person[]): { text: string; replaced: number } {
  const words: { w: string; as: string }[] = [];
  for (const p of people) {
    const name = p.name.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    words.push({ w: name, as: p.as });
    for (const part of name.split(/[\s-]+/)) if (part.length >= 3) words.push({ w: part, as: p.as });
  }
  // Longest first, so "Anna Berg" goes whole before "Anna" alone.
  words.sort((a, b) => b.w.length - a.w.length);
  let out = text;
  let replaced = 0;
  for (const { w, as } of words) {
    const re = new RegExp(`(^|[^${LETTER}])${esc(w)}(?=[^${LETTER}]|$)`, 'gi');
    out = out.replace(re, (_m, pre: string) => {
      replaced++;
      return `${pre}[${as}]`;
    });
  }
  return { text: out, replaced };
}

export function peopleOf(d: { crew: { name: string; rank?: string }[]; passengers?: { name: string }[]; medTreatments?: { patient: string; patientRank?: string }[] }): Person[] {
  return [
    ...d.crew.map((c) => ({ name: c.name, as: c.rank?.trim() || 'crew member' })),
    ...(d.passengers ?? []).map((p) => ({ name: p.name, as: 'guest' })),
    ...(d.medTreatments ?? []).map((m) => ({ name: m.patient, as: m.patientRank?.trim() || 'patient' })),
  ];
}

export interface PastNc {
  key: string;
  date: string;
  source: string;
  grade: string;
  title: string;
  what: string;
  rootCause?: string;
  closed: boolean;
}

/** The vessel's NCs, newest first, under C1…; who raised, did and closed them does not go. */
export function pastForAi(ncs: NonConformity[], people: Person[], except?: string): { past: PastNc[]; ids: string[] } {
  const list = ncs.filter((n) => n.no && n.id !== except).sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_PAST_NCS);
  const s = (v: string, max: number) => scrubNames(v.slice(0, max), people).text;
  return {
    past: list.map((n, i) => ({
      key: `C${i + 1}`, date: n.date, source: n.source, grade: n.grade, title: s(n.title, 120), what: s(n.what, 300),
      ...(n.rootCause ? { rootCause: s(n.rootCause, 200) } : {}), closed: !!n.closedAt,
    })),
    ids: list.map((n) => n.id),
  };
}

export interface IncidentAiReply {
  title?: string;
  what?: string;
  where?: string;
  source?: string;
  grade?: string;
  requirement?: string;
  rootCause?: string;
  actions?: { kind?: string; text?: string; owner?: string; days?: number | string }[];
  similar?: { key?: string; why?: string }[];
  missing?: string[];
}

export interface DraftAction {
  id: string;
  kind: CapaKind;
  text: string;
  owner: string;
  due: string;
}

export interface IncidentRead {
  title?: string;
  what?: string;
  where?: string;
  source?: NcSource;
  grade?: NcGrade;
  requirement?: string;
  rootCause?: string;
  actions: DraftAction[];
  similar: { nc: NonConformity; why?: string }[];
  missing: string[];
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/[ \t]+/g, ' ').slice(0, max) : '');
const opt = <K extends string>(k: K, v: string) => (v ? { [k]: v } : {}) as Partial<Record<K, string>>;

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The reply against the NCs as they are now: an unknown key, source, grade or kind goes; a due date is counted from today. */
export function readIncident(reply: IncidentAiReply, ncs: NonConformity[], sent: string[], today: string): IncidentRead {
  const live = new Map(ncs.map((n) => [n.id, n]));
  const byKey = new Map(sent.map((id, i) => [`C${i + 1}`, id]));
  const source = NC_SOURCES.some((s) => s.key === reply.source) ? (reply.source as NcSource) : undefined;
  const grade = NC_GRADES.some((g) => g.key === reply.grade) ? (reply.grade as NcGrade) : undefined;
  const actions: DraftAction[] = [];
  for (const a of reply.actions ?? []) {
    const t = text(a?.text, 300);
    if (!t || !(String(a.kind) in CAPA_KIND_LABEL)) continue;
    const n = Number(a.days);
    const days = Number.isFinite(n) && n >= 0 && n <= 365 ? Math.round(n) : 30;
    actions.push({ id: `a${actions.length + 1}`, kind: a.kind as CapaKind, text: t, owner: text(a.owner, 60) || 'Master', due: addDays(today, days) });
    if (actions.length >= 8) break;
  }
  const seen = new Set<string>();
  const similar: IncidentRead['similar'] = [];
  for (const s of reply.similar ?? []) {
    const nc = live.get(byKey.get(String(s?.key ?? '')) ?? '');
    if (!nc || seen.has(nc.id)) continue;
    seen.add(nc.id);
    similar.push({ nc, ...opt('why', text(s.why, 200)) });
    if (similar.length >= 5) break;
  }
  return {
    ...opt('title', text(reply.title, 120)),
    ...opt('what', text(reply.what, 2000)),
    ...opt('where', text(reply.where, 120)),
    ...(source ? { source } : {}),
    ...(grade ? { grade } : {}),
    ...opt('requirement', text(reply.requirement, 200)),
    ...opt('rootCause', text(reply.rootCause, 1000)),
    actions,
    similar,
    missing: (reply.missing ?? []).map((m) => text(m, 200)).filter(Boolean).slice(0, 6),
  };
}

const FIELDS = ['title', 'what', 'where', 'requirement', 'rootCause'] as const;

/**
 * The draft with the AI's words where it is still empty; what the officer wrote
 * stays. Source and grade only on a new NC that did not come from a card (a
 * card already says what it is). Ticked actions join the NC's own.
 */
export function applyIncident(nc: NonConformity, r: IncidentRead, picked: DraftAction[], opts: { kind: boolean }, newId: (p: string) => string): { nc: NonConformity; kept: number } {
  let kept = 0;
  const next: NonConformity = { ...nc };
  for (const f of FIELDS) {
    const v = r[f];
    if (!v) continue;
    if ((nc[f] ?? '').trim()) kept++;
    else next[f] = v;
  }
  if (opts.kind) {
    if (r.source) next.source = r.source;
    if (r.grade) next.grade = r.grade;
  }
  const have = new Set(nc.actions.map((a) => a.text.trim().toLowerCase()));
  const add: CapaAction[] = picked.filter((a) => !have.has(a.text.trim().toLowerCase())).map((a) => ({ id: newId('ac'), kind: a.kind, text: a.text, owner: a.owner, due: a.due }));
  next.actions = [...nc.actions, ...add];
  return { nc: next, kept };
}

// ===================================
// A new revision of an SMS document read by the AI (plan AI-5, 6 Nov 2026):
// what changed against the revision before, which of the vessel's checklists
// and forms in the app now say something else, and which other documents of the
// SMS to look at. Pure; the panel is components/DocRevAiPanel.tsx.
//
// The model sees the two revisions (their text, or the PDF where the device has
// no text), the document's number and title, the checklists the vessel works to
// under short keys (K1, K2… with the lines numbered), and the other documents by
// number and title only (D1, D2…). No names: the lists carry none, and a
// document's text is the office's.
//
// Nothing is changed by the answer. A checklist line that disagrees is shown
// with the editor to open; the change note for the crew is a draft the officer
// edits and saves on the document (IsmDoc.changeNote). Keys the model makes up
// are dropped, and a line number the checklist does not have is dropped too.
// ===================================

import { CATEGORIES } from '../constants/categories';
import { ChecklistTemplate, templatesFor } from '../constants/checklists';
import { PERMIT_TYPES } from '../constants/permitTypes';
import { CheckBook, DpTemplate } from '../types/dp';
import { DOC_CATEGORY_LABEL, IsmDoc } from '../types/docs';
import { EquipmentItem } from '../types/equipment';
import { WatchTemplate } from '../types/watchLog';
import { templatesNow } from './dp';

export type SmsListKind = 'round' | 'dp' | 'watch' | 'permit' | 'engine';

/** One checklist or form the vessel works to in the app. `id` says where it lives, so a queued answer still finds it. */
export interface SmsList {
  id: string;
  kind: SmsListKind;
  title: string;
  lines: string[];
  /** For "Open": the round's category and period, the DP / watch book. */
  category?: string;
  period?: string;
  book?: CheckBook;
}

const WATCH_BOOKS: CheckBook[] = ['bridge', 'bridge-sea', 'bridge-arrival', 'bridge-pilot', 'bridge-vis', 'bridge-weather', 'engine', 'emergency', 'fam-safety', 'fam-bridge', 'fam-engine', 'fam-project', 'fam-pax', 'fam-dp'];

/** Lines a model reads in one go: enough for a vessel's whole set, not a runaway one. */
export const MAX_LISTS = 120;
export const MAX_LINES = 1600;

/**
 * The checklists and forms in force: the equipment rounds of the categories the
 * register uses (as worded by the vessel), the DP and watch checklists when those
 * modules are on, the permit precautions, the engine round's readings.
 */
export function vesselLists(x: {
  flat: EquipmentItem[];
  templates: ChecklistTemplate[];
  dpTemplates: DpTemplate[];
  watchTemplates: WatchTemplate[];
  on: (module: string) => boolean;
}): SmsList[] {
  const out: SmsList[] = [];
  const used = new Set(x.flat.map((i) => i.category));
  for (const c of CATEGORIES) {
    if (!used.has(c.key)) continue;
    for (const tpl of templatesFor(c.key, x.templates)) {
      out.push({ id: `round:${c.key}.${tpl.period}`, kind: 'round', title: `${c.label} — ${tpl.period} round`, lines: tpl.lines.map((l) => l.text), category: c.key, period: tpl.period });
    }
  }
  const dpLines = (t: DpTemplate) => t.lines.filter((l) => !l.head).map((l) => l.text.replace(/\{[^}]*\}/g, '').trim()).filter(Boolean);
  if (x.on('dp')) for (const t of templatesNow(x.dpTemplates, 'dp')) out.push({ id: `dp:${t.id}`, kind: 'dp', title: `DP checklist — ${t.title}`, lines: dpLines(t), book: 'dp' });
  if (x.on('watchChecks')) {
    for (const b of WATCH_BOOKS) for (const t of templatesNow(x.dpTemplates, b)) out.push({ id: `watch:${t.id}`, kind: 'watch', title: t.title, lines: dpLines(t), book: b });
  }
  if (x.on('ptw')) for (const p of PERMIT_TYPES) out.push({ id: `permit:${p.key}`, kind: 'permit', title: `Permit — ${p.label}`, lines: p.checks.map((c) => c.text) });
  if (x.on('watchLog')) {
    for (const w of x.watchTemplates.filter((w) => !w.deleted)) out.push({ id: `engine:${w.id}`, kind: 'engine', title: `Engine round — ${w.name}`, lines: w.params.map((p) => (p.unit ? `${p.name} (${p.unit})` : p.name)) });
  }
  // Keep within what one answer can cover: whole lists, first come first kept.
  const kept: SmsList[] = [];
  let n = 0;
  for (const l of out) {
    if (kept.length >= MAX_LISTS || n + l.lines.length > MAX_LINES) break;
    kept.push(l);
    n += l.lines.length;
  }
  return kept;
}

export interface AiList {
  key: string;
  title: string;
  lines: string[];
}

export const listsForAi = (lists: SmsList[]): AiList[] => lists.map((l, i) => ({ key: `K${i + 1}`, title: l.title.slice(0, 160), lines: l.lines.map((s) => s.slice(0, 240)) }));

export interface AiDoc {
  key: string;
  docNo?: string;
  title: string;
  kind: string;
}

/** The other documents in force, by number and title — their texts do not go. */
export function otherDocs(docs: IsmDoc[], self: string): IsmDoc[] {
  return docs.filter((d) => !d.deleted && d.id !== self).slice(0, 300);
}

export const docsForAi = (docs: IsmDoc[]): AiDoc[] => docs.map((d, i) => ({ key: `D${i + 1}`, ...(d.docNo ? { docNo: d.docNo } : {}), title: d.title.slice(0, 160), kind: DOC_CATEGORY_LABEL[d.category] }));

/** A revision as it goes: its own words when the device has them, else the file. */
export type RevInput = { text: string } | { mediaType: string; data: string } | null;

export function revText(rev: { text?: string; body?: string } | undefined): string | null {
  const s = [rev?.body, rev?.text].filter((x) => x && x.trim()).join('\n\n').trim();
  return s ? s.slice(0, 60000) : null;
}

// ---- the answer -----------------------------------------------------------------------

export interface SmsAiReply {
  /** The two are revisions of one document: yes, no, unclear. */
  same?: string;
  summary?: string;
  changes?: { section?: string; kind?: string; was?: string; now?: string; crew?: boolean }[];
  affected?: { key?: string; lines?: unknown[]; issue?: string; says?: string; should?: string; section?: string }[];
  docs?: { key?: string; why?: string }[];
  unreadable?: string;
}

export type ChangeKind = 'added' | 'removed' | 'changed';
const KINDS: ChangeKind[] = ['added', 'removed', 'changed'];
export type IssueKind = 'conflict' | 'missing' | 'outdated';
const ISSUES: IssueKind[] = ['conflict', 'missing', 'outdated'];

export interface SmsChange {
  section: string;
  kind: ChangeKind;
  was: string;
  now: string;
  /** Changes how the crew work, not only the wording. */
  crew: boolean;
}

export interface SmsIssue {
  list: SmsList;
  issue: IssueKind;
  /** The checklist's lines it is about, as numbered for the AI (from 1), with their words. */
  lines: { n: number; text: string }[];
  says: string;
  should: string;
  section: string;
}

export interface SmsRead {
  same: 'yes' | 'no' | 'unclear';
  /** There was a revision before to compare with. */
  compared: boolean;
  summary: string;
  changes: SmsChange[];
  issues: SmsIssue[];
  docs: { doc: IsmDoc; why: string }[];
  unreadable: string;
}

const s = (v: unknown, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * The answer against what was sent. `lists` and `docs` are the ones sent, in the
 * order sent (a queued job keeps their ids; look them up again before calling).
 */
export function readSms(r: SmsAiReply, lists: (SmsList | undefined)[], docs: (IsmDoc | undefined)[], compared: boolean): SmsRead {
  const changes: SmsChange[] = (r.changes ?? [])
    .map((c) => ({ section: s(c.section, 120), kind: (KINDS.includes(c.kind as ChangeKind) ? c.kind : 'changed') as ChangeKind, was: s(c.was), now: s(c.now), crew: c.crew === true }))
    .filter((c) => c.was || c.now)
    .slice(0, compared ? 40 : 0);

  const issues: SmsIssue[] = [];
  const seen = new Set<string>();
  for (const a of r.affected ?? []) {
    const m = /^K(\d+)$/.exec(s(a.key, 8));
    const list = m ? lists[Number(m[1]) - 1] : undefined;
    if (!list) continue;
    const lines = [...new Set((a.lines ?? []).map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1 && n <= list.lines.length))].sort((x, y) => x - y).map((n) => ({ n, text: list.lines[n - 1] }));
    const issue = (ISSUES.includes(a.issue as IssueKind) ? a.issue : 'conflict') as IssueKind;
    // A conflict or an outdated line is about a line; without one it is a guess.
    if (issue !== 'missing' && !lines.length) continue;
    const should = s(a.should);
    if (!should) continue;
    const id = `${list.id}|${issue}|${lines.map((l) => l.n).join(',')}`;
    if (seen.has(id)) continue;
    seen.add(id);
    issues.push({ list, issue, lines, says: s(a.says), should, section: s(a.section, 120) });
    if (issues.length >= 30) break;
  }

  const used = new Set<string>();
  const docOut: { doc: IsmDoc; why: string }[] = [];
  for (const d of r.docs ?? []) {
    const m = /^D(\d+)$/.exec(s(d.key, 8));
    const doc = m ? docs[Number(m[1]) - 1] : undefined;
    if (!doc || used.has(doc.id) || !s(d.why)) continue;
    used.add(doc.id);
    docOut.push({ doc, why: s(d.why, 300) });
    if (docOut.length >= 10) break;
  }

  const same = r.same === 'no' || r.same === 'unclear' ? r.same : 'yes';
  return { same: compared ? same : 'yes', compared, summary: s(r.summary, 800), changes, issues, docs: docOut, unreadable: s(r.unreadable, 400) };
}

/** The draft "What changed" for the crew: the summary, then what changes their work, then the rest. English — it is on the record. */
export function changeNoteDraft(read: SmsRead): string {
  const line = (c: SmsChange) => {
    const where = c.section ? `${c.section}: ` : '';
    if (c.kind === 'added') return `- ${where}new — ${c.now}`;
    if (c.kind === 'removed') return `- ${where}removed — ${c.was}`;
    return `- ${where}${c.now}${c.was ? ` (was: ${c.was})` : ''}`;
  };
  const crew = read.changes.filter((c) => c.crew);
  const rest = read.changes.filter((c) => !c.crew);
  return [read.summary, crew.map(line).join('\n'), rest.length ? `Other changes:\n${rest.map(line).join('\n')}` : ''].filter(Boolean).join('\n\n').slice(0, 4000);
}

/** The note shown with the document: only the current revision's. */
export const currentNote = (d: IsmDoc) => (d.changeNote && d.changeNote.revision === d.revision && d.changeNote.text.trim() ? d.changeNote : null);

/** What the revision before keeps when a new one is issued: one step back, never a chain. */
export function prevOf(d: IsmDoc): NonNullable<IsmDoc['prev']> {
  return {
    revision: d.revision,
    issued: d.issued,
    ...(d.fileUri && !d.filePending ? { fileUri: d.fileUri } : {}),
    ...(d.fileName && !d.filePending ? { fileName: d.fileName } : {}),
    ...(d.text ? { text: d.text } : {}),
    ...(d.body ? { body: d.body } : {}),
  };
}

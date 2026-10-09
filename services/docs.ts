// ===================================
// ISM documents — who has read what, as pure functions (types/docs.ts).
// ===================================

import { CrewMember } from '../types/crew';
import { DocAck, IsmDoc } from '../types/docs';

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Signatures for the CURRENT revision of a document. */
export function currentAcks(doc: IsmDoc, acks: DocAck[]): DocAck[] {
  return acks.filter((a) => a.docId === doc.id && a.revision === doc.revision);
}

/** Has this crew member signed the current revision? By id, else by name. */
export function hasRead(doc: IsmDoc, acks: DocAck[], person: Pick<CrewMember, 'id' | 'name'>): boolean {
  const n = norm(person.name);
  return currentAcks(doc, acks).some((a) => a.personKey === person.id || (n && norm(a.by) === n));
}

export interface ReadStatus {
  required: number;
  read: CrewMember[];
  unread: CrewMember[];
  /** Signatures from people not on the crew list (a relief, a superintendent). */
  others: DocAck[];
}

/** Who on the active crew list has and has not signed the current revision. */
export function readStatus(doc: IsmDoc, acks: DocAck[], crew: CrewMember[]): ReadStatus {
  const people = crew.filter((c) => c.active && !c.deleted);
  const read: CrewMember[] = [];
  const unread: CrewMember[] = [];
  for (const p of people) (hasRead(doc, acks, p) ? read : unread).push(p);
  const known = new Set(people.flatMap((p) => [p.id, norm(p.name)]));
  const others = currentAcks(doc, acks).filter((a) => !known.has(a.personKey) && !known.has(norm(a.by)));
  return { required: people.length, read, unread, others };
}

/** Has the person signing on this device read the current revision? */
export function iHaveRead(doc: IsmDoc, acks: DocAck[], personKey: string, name: string): boolean {
  const n = norm(name);
  return currentAcks(doc, acks).some((a) => a.personKey === personKey || (n && norm(a.by) === n));
}

/** A document is "to read" for someone when it must be read and they have not. */
export function toRead(docs: IsmDoc[], acks: DocAck[], personKey: string, name: string): IsmDoc[] {
  return docs.filter((d) => d.mustRead !== false && !iHaveRead(d, acks, personKey, name));
}

/** Review overdue / due within 30 days. */
export function reviewState(doc: IsmDoc, today: string): 'overdue' | 'soon' | null {
  if (!doc.reviewDue) return null;
  if (doc.reviewDue < today) return 'overdue';
  const days = (Date.parse(`${doc.reviewDue}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  return days <= 30 ? 'soon' : null;
}

// ---- search and order ---------------------------------------------------------------

export type DocSort = 'number' | 'title' | 'issued' | 'review';

const fold = (s: string | undefined) => (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Documents matching a word search and a number search. Every word must appear
 * somewhere — title, number, type, the text written aboard, the file name, or the
 * PDF's own text; the number search looks at the document number only.
 */
export function searchDocs(docs: IsmDoc[], words: string, number: string, categoryLabel: (d: IsmDoc) => string): IsmDoc[] {
  const ws = fold(words).split(/\s+/).filter(Boolean);
  // Numbers are written "SMS-07-03", "SMS 07.03", "sms0703": compare letters and digits only.
  const bare = (x: string | undefined) => fold(x).replace(/[^a-z0-9]/g, '');
  const num = bare(number);
  return docs.filter((d) => {
    if (num && !bare(d.docNo).includes(num)) return false;
    if (!ws.length) return true;
    const hay = fold([d.title, d.docNo, categoryLabel(d), d.body, d.fileName, d.text].filter(Boolean).join(' '));
    return ws.every((w) => hay.includes(w));
  });
}

/** "…enclosed space must be ventilated for 30 minutes before…" around the first word found in the body or file text. */
export function snippet(d: IsmDoc, words: string, width = 90): string | null {
  const ws = fold(words).split(/\s+/).filter(Boolean);
  if (!ws.length) return null;
  for (const src of [d.body, d.text]) {
    if (!src) continue;
    const f = fold(src);
    const at = f.indexOf(ws[0]);
    if (at < 0) continue;
    const from = Math.max(0, at - Math.floor(width / 3));
    const to = Math.min(src.length, from + width);
    return `${from > 0 ? '…' : ''}${src.slice(from, to).replace(/\s+/g, ' ').trim()}${to < src.length ? '…' : ''}`;
  }
  return null;
}

export function sortDocs(docs: IsmDoc[], by: DocSort): IsmDoc[] {
  const num = (d: IsmDoc) => d.docNo ?? '\uffff';
  const cmp: Record<DocSort, (a: IsmDoc, b: IsmDoc) => number> = {
    number: (a, b) => num(a).localeCompare(num(b), undefined, { numeric: true }) || a.title.localeCompare(b.title),
    title: (a, b) => a.title.localeCompare(b.title),
    issued: (a, b) => (b.issued ?? '').localeCompare(a.issued ?? ''),
    review: (a, b) => (a.reviewDue ?? '9999').localeCompare(b.reviewDue ?? '9999'),
  };
  return [...docs].sort(cmp[by]);
}

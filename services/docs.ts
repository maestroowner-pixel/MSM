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

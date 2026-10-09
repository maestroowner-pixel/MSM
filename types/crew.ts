// ===================================
// Crew — who is signing.
//
// Deliberately NOT user accounts. A vessel already has one MSM account (by IMO)
// and a set of approved devices; adding per-person passwords would mean a crew
// member locked out of a safety round at 0300 because they forgot one, on a
// shared tablet, at sea. What an inspection audit actually needs is an honest,
// attributable signature — the same thing a paper checklist gets.
//
// So: the master keeps a crew list, the person signing picks their name, and the
// name is snapshotted onto the inspection record (types/inspection.ts). The list
// travels with the vessel (synced, backed up); which name this device used last
// is a device preference, so a shared tablet on the bridge and a phone in an
// engineer's pocket each default sensibly.
//
// `active: false` retires someone who has left without deleting them, so their
// past inspections keep a live link and they stop cluttering the picker.
// ===================================

export interface CrewMember {
  id: string;
  name: string;
  /** Rank / role — "Third Officer", "Bosun". Snapshotted onto each signature. */
  rank?: string;
  active: boolean;
  addedAt: number;
  updatedAt: number;
  /**
   * A removal, kept as a record rather than done as a deletion.
   *
   * The list syncs as a union by id, newest `updatedAt` winning, and a Master
   * pushes the whole of it — so an entry deleted outright came straight back
   * from the vessel on the next pull, and an entry deleted in the vessel was
   * re-created by the next push from any Master still holding it. Four test
   * names walked from a demo vessel into a real one this way (11 Sep 2026) and
   * could not be got rid of from inside the app. A tombstone travels like any
   * other edit; `liveCrew` hides it everywhere the list is shown.
   */
  deleted?: boolean;
  /**
   * Aboard now. The Master or an officer signs people on and off (9 Oct 2026:
   * "in rest hours the Master must be able to mark who is on board"); someone
   * off on leave stays on the list, with their certificates, and comes back.
   * Absent = aboard, so lists made before this keep everyone where they were.
   */
  onBoard?: boolean;
  /** yyyy-mm-dd joined the vessel for the current trip. */
  signOn?: string;
  /** yyyy-mm-dd left the vessel. */
  signOff?: string;
}

/** Aboard and current: who records hours of rest and appears in the matrix. */
export function isAboard(c: Pick<CrewMember, 'active' | 'deleted' | 'onBoard'>): boolean {
  return c.active && !c.deleted && c.onBoard !== false;
}

/**
 * A crew member's personal details — kept APART from the crew list.
 *
 * The crew list is read by every device on the vessel (it is the signature
 * picker). Next of kin, date of birth and passport numbers are not for every
 * deckhand's phone, so they live in their own collection, `crew_private`, which
 * firestore.rules opens to Officers and the Master only. Same id as the crew
 * member.
 */
export interface NextOfKin {
  name?: string;
  relationship?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface CrewPrivate {
  id: string;
  dateOfBirth?: string;
  nationality?: string;
  passportNo?: string;
  seamansBookNo?: string;
  phone?: string;
  email?: string;
  homeAddress?: string;
  nextOfKin?: NextOfKin;
  updatedAt: number;
}

/** The list as the app shows it — without the removed. Storage keeps them. */
export function liveCrew(list: CrewMember[]): CrewMember[] {
  return list.filter((c) => !c.deleted);
}

/** "Jez Dodd · Third Officer" — one line for a picker row or a report cell. */
export function crewLabel(c: Pick<CrewMember, 'name' | 'rank'>): string {
  return c.rank ? `${c.name} · ${c.rank}` : c.name;
}

/** Signature line for a report: name first, rank in brackets. */
export function signatureLine(name: string, rank?: string): string {
  return rank ? `${name} (${rank})` : name;
}

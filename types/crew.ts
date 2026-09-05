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
}

/** "Jez Dodd · Third Officer" — one line for a picker row or a report cell. */
export function crewLabel(c: Pick<CrewMember, 'name' | 'rank'>): string {
  return c.rank ? `${c.name} · ${c.rank}` : c.name;
}

/** Signature line for a report: name first, rank in brackets. */
export function signatureLine(name: string, rank?: string): string {
  return rank ? `${name} (${rank})` : name;
}

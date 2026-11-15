// ===================================
// NFC tags — a second way, beside the QR, to say who or where (plan item 70, 15 Nov 2026).
//
// A wristband on a crew member or a guest, a sticker on a round's checkpoint or at a
// muster station. The tag carries the SAME payload as the QR it stands beside
// (`msm://crew/<id>`, `msm://checkpoint/<id>`, `msm://muster/<id>`), so everything a
// scan does a tap does.
//
// WHAT A TAP PROVES. An NTAG215 can be rewritten by any phone, so the words on it prove
// nothing: anyone could write `msm://crew/<the Master's id>` on a blank sticker. What
// cannot be rewritten is the chip's own serial number (UID). So every tag the vessel
// hands out is entered here by its UID, and a tap counts only when that UID is on the
// register, not revoked, and names the same person or place as the words on it
// (services/nfcTags.resolveTap). A copied chip with a forged UID needs special blanks;
// NTAG 424 DNA (a signed tap) is the next step, for keys and closed spaces.
//
// One tag per person or place in force: issuing a new one revokes the old (a lost
// wristband stops opening anything the moment the new one is written). Nothing is
// deleted — a revoked tag stays on the register with when and by whom.
// ===================================

export type NfcTagKind = 'person' | 'checkpoint' | 'muster';

export interface NfcTag {
  /** `tag_<uid>` — one record per chip, whatever it is given to. */
  id: string;
  /** The chip's serial number, upper-case hex without separators (04A1B2C3D4E580). */
  uid: string;
  kind: NfcTagKind;
  /** Crew member or passenger id, checkpoint id, muster station id. */
  ref: string;
  /** Who or what, for the register — a guest's name masked (A…e), like everything of theirs on the cloud. */
  name: string;
  issuedAt: number;
  issuedBy: string;
  revokedAt?: number;
  revokedBy?: string;
  updatedAt: number;
}

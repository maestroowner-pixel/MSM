// ===================================
// The register of NFC tags, and what a tap means (types/nfc.ts says why the UID decides).
//
// Pure: no storage, no React Native — scripts/check-nfc.ts runs it.
// ===================================

import { NfcTag, NfcTagKind } from '../types/nfc';
import { checkpointQrPayload, crewQrPayload, itemQrPayload, musterQrPayload, parseCheckpointQr, parseCrewQr, parseItemQr, parseMusterQr } from './crewQr';
import { isPassengerId } from '../types/passengers';
import { maskName } from '../utils/privacy';

/** "04:a1:b2…", "04 A1 B2", "04a1b2" → "04A1B2". */
export function normUid(uid: string): string {
  return uid.replace(/[^0-9a-f]/gi, '').toUpperCase();
}

export const tagId = (uid: string) => `tag_${normUid(uid)}`;

/** The words written on a tag of this kind — the same as its QR. */
export function payloadFor(kind: NfcTagKind, ref: string): string {
  return kind === 'person' ? crewQrPayload(ref) : kind === 'checkpoint' ? checkpointQrPayload(ref) : kind === 'item' ? itemQrPayload(ref) : musterQrPayload(ref);
}

function parsePayload(p: string): { kind: NfcTagKind; ref: string } | null {
  const crew = parseCrewQr(p);
  if (crew) return { kind: 'person', ref: crew };
  const cp = parseCheckpointQr(p);
  if (cp) return { kind: 'checkpoint', ref: cp };
  const ms = parseMusterQr(p);
  if (ms) return { kind: 'muster', ref: ms };
  const item = parseItemQr(p);
  if (item) return { kind: 'item', ref: item };
  return null;
}

export type TapResult =
  | { ok: true; tag: NfcTag; code: string }
  /** unknown: not on this vessel's register; revoked: replaced or reported lost; mismatch: the words were rewritten. */
  | { ok: false; why: 'unknown' | 'revoked' | 'mismatch'; tag?: NfcTag };

/**
 * A tap: the chip's UID and the words read from it (none when it was wiped). The UID
 * decides; words that name someone else mean the tag was rewritten, and it is refused
 * rather than believed either way. The code returned is what the scanner would have read
 * from the QR, so a tap goes down the scan's own path.
 */
export function resolveTap(uid: string, payload: string | null | undefined, tags: NfcTag[]): TapResult {
  const id = tagId(uid);
  const tag = tags.find((t) => t.id === id);
  if (!tag) return { ok: false, why: 'unknown' };
  if (tag.revokedAt) return { ok: false, why: 'revoked', tag };
  const said = payload ? parsePayload(payload) : null;
  if (payload && (!said || said.kind !== tag.kind || said.ref !== tag.ref)) return { ok: false, why: 'mismatch', tag };
  return { ok: true, tag, code: payloadFor(tag.kind, tag.ref) };
}

/** The tag in force for a person or a place. */
export function activeTag(tags: NfcTag[], kind: NfcTagKind, ref: string): NfcTag | undefined {
  return tags
    .filter((t) => t.kind === kind && t.ref === ref && !t.revokedAt)
    .sort((a, b) => b.issuedAt - a.issuedAt)[0];
}

/** On the register a guest is "A…e", like every guest name on the cloud. */
export function registerName(ref: string, name: string): string {
  return isPassengerId(ref) ? maskName(name) : name.trim();
}

/**
 * Writing a tag for someone: the new record, and the old tags of the same person or
 * place revoked — and the chip itself taken from whoever had it before (a wristband
 * handed on to the next crew member is re-issued, not shared).
 */
export function issueTag(tags: NfcTag[], uid: string, kind: NfcTagKind, ref: string, name: string, by: string, now: number): NfcTag[] {
  const id = tagId(uid);
  const revoke = (t: NfcTag): NfcTag => ({ ...t, revokedAt: now, revokedBy: by, updatedAt: now });
  const old = tags.filter((t) => !t.revokedAt && t.id !== id && t.kind === kind && t.ref === ref).map(revoke);
  const tag: NfcTag = { id, uid: normUid(uid), kind, ref, name: registerName(ref, name), issuedAt: now, issuedBy: by, updatedAt: now };
  return [tag, ...old];
}

export function revokeTag(tag: NfcTag, by: string, now: number): NfcTag {
  return { ...tag, revokedAt: now, revokedBy: by, updatedAt: now };
}

/** The last characters of a UID, enough to tell two wristbands apart on a screen. */
export const uidTail = (uid: string) => normUid(uid).slice(-6).replace(/(..)(?=.)/g, '$1:');

/** Who holds this chip now — the tag in force with its UID, if any. */
export function tagHolder(tags: NfcTag[], uid: string): NfcTag | undefined {
  const id = tagId(uid);
  return tags.find((t) => t.id === id && !t.revokedAt);
}

/**
 * Writing tags one after another (screens/NfcBatchSc): those still without one, in the
 * list's order — the ones already tagged and those skipped are passed over.
 */
export function batchQueue(ids: string[], tags: NfcTag[], kind: NfcTagKind, skipped: Set<string>): string[] {
  return ids.filter((id) => !skipped.has(id) && !activeTag(tags, kind, id));
}

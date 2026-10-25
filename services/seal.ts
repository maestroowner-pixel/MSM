// ===================================
// The seal — a signature bound to what was signed (25 Oct 2026, stage 2 of the
// flag approval of the electronic record books: MEPC.312(74) §4.3.3, and the
// Red Ensign Group's "advanced electronic signature" — linked to the signatory
// alone, identifying them, made with data under their sole control, and showing
// any later change of the signed data).
//
// Stage 1 recorded HOW a person confirmed (PIN / fingerprint / by hand); nothing
// tied that confirmation to the words of the entry. Now:
//   - every signer has their own key pair, ECDSA P-256, made on the device the
//     first time they sign there (services/signKeys). The private key never leaves
//     it and is opened only by their PIN (or their fingerprint on their own phone);
//     the public key goes to the vessel's key register (`sign_keys`);
//   - signing an entry signs the SHA-256 of the entry's content (`contentHash`,
//     canonical JSON — key order fixed, sync fields left out), and the seal sits in
//     the proof (`signedWith.seal`, an amendment's in `editedWith.seal`);
//   - each entry names the hash of the one before it in its book (`prev`), so an
//     entry taken out of the book leaves the next one pointing at nothing;
//   - a Master's verification seals the hashes of the versions it covers.
// Anyone can check a seal with the public key alone — `checkSeal` here, the same
// code for the screen, the printed copy and a copy taken off the ship.
//
// Signed by hand there is no secret of the signer's to sign with: such a record
// is sealed with the DEVICE's key (`kind: 'device'`) — any later change still
// shows, but the seal does not say who; the drawing does.
//
// Pure — no React Native — so `npm run check:seal` runs it under Node.
// ===================================

import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

export interface Seal {
  v: 1;
  alg: 'ES256';
  /** `person` — the signer's own key; `device` — the device's (signed by hand). */
  kind: 'person' | 'device';
  /** keyIdOf(pub). */
  key: string;
  /** Compressed public key, hex. */
  pub: string;
  /** contentHash of the record as signed. */
  hash: string;
  /** Compact r‖s, hex. */
  sig: string;
}

/** A key in the vessel's register (`sign_keys`, written once). */
export interface SignKeyRec {
  /** keyIdOf(pub). */
  id: string;
  /** Whose: crew id or `device:<id>` (as `byId` on records), or `dev:<deviceId>` for a device key. */
  person: string;
  name: string;
  rank?: string;
  kind: 'person' | 'device';
  pub: string;
  /** How it is opened: `pin`, `biometric`, or nothing for a device key. */
  opens?: 'pin' | 'biometric';
  deviceId?: string;
  at: number;
  updatedAt: number;
}

// ---- the register as this device holds it ----------------------------------------

let register: SignKeyRec[] | undefined;
/** DataContext hands the synced register over, as it does the ship's clock (utils/shipTime setShipClock). */
export function setKeyRegister(keys: SignKeyRec[] | undefined): void {
  register = keys;
}
/** The register for checks made away from React — the printed copy. Undefined: not known, the signature alone is checked. */
export const registeredKeys = () => register;

// ---- hashing --------------------------------------------------------------------

/** Fields left out of a record's hash: sync bookkeeping and the proofs that carry the seal. */
const SKIP = new Set(['updatedAt', 'signedWith', 'editedWith']);

/** JSON with keys in order and `undefined` dropped (Firestore drops it too) — the same bytes on every device. */
export function canonical(v: unknown, top = true): string {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : canonical(x, false))).join(',')}]`;
  if (typeof v === 'object') {
    const keys = Object.keys(v as object)
      .filter((k) => (v as any)[k] !== undefined && !k.startsWith('_') && !(top && SKIP.has(k)))
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((v as any)[k], false)}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

export const sha256Hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));

/** SHA-256 of what a record says (services/seal header). */
export function contentHash(rec: object): string {
  return sha256Hex(canonical(rec));
}

/** `3F2A-9C1B-77E0-41D5` — the key's fingerprint, printed beside a seal. */
export function keyIdOf(pubHex: string): string {
  return sha256Hex(pubHex).slice(0, 16).toUpperCase().replace(/(.{4})(?=.)/g, '$1-');
}

// ---- keys and signatures ----------------------------------------------------------

/** A new private key from 32 random bytes (services/random) — null when they are not a valid key (1 in 2^32). */
export function privateFrom(random: Uint8Array): Uint8Array | null {
  return p256.utils.isValidPrivateKey(random) ? random : null;
}

export const publicOf = (priv: Uint8Array) => bytesToHex(p256.getPublicKey(priv, true));

/** Seal `hash` with `priv`. ECDSA here is deterministic (RFC 6979): no randomness needed to sign. */
export function sealHash(priv: Uint8Array, hash: string, kind: Seal['kind']): Seal {
  const pub = publicOf(priv);
  return { v: 1, alg: 'ES256', kind, key: keyIdOf(pub), pub, hash, sig: p256.sign(hexToBytes(hash), priv).toCompactHex() };
}

/** The seal's signature is good for its own hash and key. */
export function sigValid(s: Seal): boolean {
  try {
    return s.alg === 'ES256' && keyIdOf(s.pub) === s.key && p256.verify(hexToBytes(s.sig), hexToBytes(s.hash), hexToBytes(s.pub));
  } catch {
    return false;
  }
}

// ---- a record's seal --------------------------------------------------------------

interface Sealable {
  editedBy?: string;
  signedWith?: { seal?: Seal };
  editedWith?: { seal?: Seal };
}

/**
 * The seal that speaks for this version: an amendment's is the amender's
 * (`editedWith`) — the original's `signedWith`, copied over by services/versions,
 * sealed the words before the change.
 */
export function sealOf(r: Sealable): Seal | undefined {
  return r.editedBy ? r.editedWith?.seal : r.signedWith?.seal;
}

export type SealState =
  /** Hash matches, signature good, key registered to the signer. */
  | 'valid'
  /** As valid, but sealed by the device (signed by hand). */
  | 'device'
  /** Hash and signature good, but the key is not in the register for this signer. */
  | 'unknownKey'
  /** The record no longer says what was signed. */
  | 'altered'
  /** The signature does not verify. */
  | 'badSig'
  /** No seal — signed before 2.69, or on a device that could not make a key. */
  | 'none';

const verifiedSigs = new Map<string, boolean>();

/** sigValid, remembered — a phone verifies a P-256 signature in ~0.1 s, and a month's page holds dozens. */
export function sigValidCached(s: Seal): boolean {
  const k = `${s.pub}:${s.hash}:${s.sig}`;
  let ok = verifiedSigs.get(k);
  if (ok === undefined) {
    ok = sigValid(s);
    verifiedSigs.set(k, ok);
  }
  return ok;
}

/** Is `s` a key the register holds for `person` (by `byId`, or the device for a device seal) made before `at`? */
export function keyKnown(s: Seal, keys: SignKeyRec[] | undefined, person: string | undefined, at: number): boolean {
  if (!keys) return true;
  const k = keys.find((x) => x.id === s.key && x.pub === s.pub);
  if (!k || k.at > at + 5 * 60_000) return false;
  return s.kind === 'device' ? k.kind === 'device' : k.kind === 'person' && (!person || k.person === person);
}

/** Who signed THIS version, for the register check. */
const signerOf = (r: { byId?: string; editedBy?: string; editedById?: string }) => (r.editedBy ? r.editedById : r.byId);

/** Check one record against its seal; `keys` — the register (omit to check the signature alone). */
export function checkRecord(rec: object, keys?: SignKeyRec[]): SealState {
  const r = rec as Sealable & { at?: number; editedAt?: number; byId?: string; editedById?: string };
  const s = sealOf(r);
  if (!s) return 'none';
  if (contentHash(r) !== s.hash) return 'altered';
  if (!sigValidCached(s)) return 'badSig';
  if (!keyKnown(s, keys, signerOf(r), (r.editedBy ? r.editedAt : r.at) ?? Date.now())) return 'unknownKey';
  return s.kind === 'device' ? 'device' : 'valid';
}

/** A state is a problem the Master must see. */
export const sealBad = (st: SealState) => st === 'altered' || st === 'badSig' || st === 'unknownKey';

// ---- the chain --------------------------------------------------------------------

/** The hash a new entry of the book points back to: the book's latest version, any month. */
export function chainHead(all: { at: number; editedAt?: number }[]): string | undefined {
  let last: (typeof all)[number] | undefined;
  for (const r of all) if (!last || (r.editedAt ?? r.at) >= (last.editedAt ?? last.at)) last = r;
  return last ? contentHash(last) : undefined;
}

/**
 * Entries whose `prev` points at no record in the book — the one before them is
 * missing. Two devices writing at once both point at the same head, which is
 * fine: the chain forks, nothing is lost.
 */
export function chainGaps<T extends { id: string; prev?: string }>(all: T[]): T[] {
  const hashes = new Set(all.map((r) => contentHash(r)));
  return all.filter((r) => r.prev && !hashes.has(r.prev));
}

// ---- a Master's verification ------------------------------------------------------

/** What a verification seals: the hash of every version it covers, in order. */
export function coverHashes(covers: string[], all: { id: string }[]): string[] {
  const byId = new Map(all.map((r) => [r.id, r]));
  return covers.map((id) => (byId.has(id) ? contentHash(byId.get(id)!) : ''));
}

/** A verification's covered versions still say what the Master signed (beside checkRecord on the verification itself). */
export function coversIntact(v: { covers?: string[]; coverHashes?: string[] }, all: { id: string }[]): boolean {
  if (!v.covers || !v.coverHashes) return true;
  const now = coverHashes(v.covers, all);
  return now.every((h, i) => !h || h === v.coverHashes![i]);
}

// ---- the book at a glance ---------------------------------------------------------

export interface Integrity {
  /** By record id. */
  state: Map<string, SealState>;
  sealed: number;
  unsealed: number;
  bad: string[];
  gaps: string[];
  /** Verifications whose seal or covered hashes do not hold. */
  badVerifications: string[];
}

export function bookIntegrity(
  all: (object & Sealable & { id: string; at: number; prev?: string; byId?: string })[],
  signs: (object & Sealable & { id: string; at: number; byId?: string; covers?: string[]; coverHashes?: string[] })[],
  keys?: SignKeyRec[],
): Integrity {
  const state = new Map<string, SealState>();
  const bad: string[] = [];
  let sealed = 0;
  let unsealed = 0;
  for (const r of all) {
    const st = checkRecord(r, keys);
    state.set(r.id, st);
    if (st === 'none') unsealed++;
    else sealed++;
    if (sealBad(st)) bad.push(r.id);
  }
  const badVerifications = signs.filter((s) => sealBad(checkRecord(s, keys)) || !coversIntact(s, all)).map((s) => s.id);
  return { state, sealed, unsealed, bad, gaps: chainGaps(all).map((r) => r.id), badVerifications };
}

/** How a record's seal reads on the printed copy (English — official paper). */
export function sealLine(st: SealState, s?: Seal): string {
  const k = s ? ` ${s.key}` : '';
  switch (st) {
    case 'valid':
      return `Sealed, key${k}: signature valid`;
    case 'device':
      return `Sealed by the device, key${k}: valid`;
    case 'unknownKey':
      return `Seal key${k} NOT IN THE KEY REGISTER`;
    case 'altered':
      return 'ALTERED AFTER SIGNING — seal does not match';
    case 'badSig':
      return 'SEAL INVALID';
    default:
      return 'No electronic seal';
  }
}

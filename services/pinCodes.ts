// ===================================
// One-time PIN codes (5 Nov 2026). The Master PIN lives on the Master's device
// only: on anyone else's phone or a shared tablet it would be 0000, and whoever
// held the device could give a shipmate's name a PIN and sign as them. So a person
// without a PIN on a shared device, or who has forgotten theirs, gets a code from
// the Master instead: for one name, one use, 15 minutes.
//
// The document's id is the hash of the code. Rules allow `get` but not `list`, so
// a device can only ask about a code it was told, one guess at a time over the
// network, and there is no list of hashes to take away and search. It needs a
// connection; without one, signing by hand stays open.
// ===================================

import { doc, getDocFromServer, setDoc, updateDoc } from 'firebase/firestore';

import { PIN_LENGTH, generatePin } from '../types/role';
import * as fb from './firebaseService';
import { codeDocId, sameCodeName } from './pinHash';
import { attempts, clearAttempts, countAttempt } from './signature';
import { randomBytes } from './signKeys';

const ROOT = 'safety_vessels';
export const CODE_LENGTH = PIN_LENGTH;
const LIFE_MS = 15 * 60_000;
const failKey = (personKey: string) => `code:${personKey}`;

export type CodeResult = { ok: true } | { ok: false; why: 'locked'; lockedUntil: number } | { ok: false; why: 'wrong' | 'used' | 'other' | 'offline' };

function newCode(): string {
  const r = randomBytes();
  if (!r) return generatePin();
  // 250 is the largest multiple of 10 a byte holds: above it, draw again rather than favour low digits.
  let out = '';
  while (out.length < CODE_LENGTH) for (const b of r(CODE_LENGTH)) if (b < 250 && out.length < CODE_LENGTH) out += b % 10;
  return out;
}

/** The Master's device: a new code for one name. Throws without a connection. */
export async function issuePinCode(vessel: string, name: string, by: string): Promise<string> {
  const code = newCode();
  const now = Date.now();
  await setDoc(doc(fb.firestoreDb(), ROOT, vessel, 'pin_codes', codeDocId(vessel, code)), { name, by, at: now, expires: now + LIFE_MS });
  return code;
}

/** Spends the code for this person. On `ok` the caller lets them choose a new PIN. */
export async function redeemPinCode(vessel: string, personKey: string, name: string, code: string): Promise<CodeResult> {
  const key = failKey(personKey);
  const f = await attempts(key);
  if (f.until && f.until > Date.now()) return { ok: false, why: 'locked', lockedUntil: f.until };
  const wrong = async (why: 'wrong' | 'other' | 'used'): Promise<CodeResult> => {
    const until = await countAttempt(key);
    return until ? { ok: false, why: 'locked', lockedUntil: until } : { ok: false, why };
  };
  const ref = doc(fb.firestoreDb(), ROOT, vessel, 'pin_codes', codeDocId(vessel, code.trim()));
  let snap;
  try {
    snap = await getDocFromServer(ref);
  } catch {
    return { ok: false, why: 'offline' };
  }
  if (!snap.exists()) return wrong('wrong');
  const rec = snap.data() as { name?: string; expires?: number; usedAt?: number };
  if (!sameCodeName(String(rec.name ?? ''), name)) return wrong('other');
  if (rec.usedAt || Number(rec.expires ?? 0) <= Date.now()) return wrong('used');
  try {
    const usedDevice = await fb.getLocalDeviceId().catch(() => '');
    // The rules take this once: a second device spending the same code is refused here.
    await updateDoc(ref, { usedAt: Date.now(), usedDevice: usedDevice ?? '' });
  } catch {
    return wrong('used');
  }
  await clearAttempts(key);
  return { ok: true };
}

// ===================================
// Confirmed signatures — the signing PIN and the proof a record carries.
//
// Asked for on 9 Oct 2026: sign inspections, maintenance, drills, permits, risk
// assessments and documents "with a PIN or a fingerprint — touch it and it is
// signed". One mechanism for all of them: components/SignConfirm asks, this file
// keeps the PIN and says what was proved.
//
// TWO WAYS TO CONFIRM, and when each is offered:
//   biometric  only when the signer IS this device's own account. A phone knows
//              that an enrolled finger touched it, not whose finger: on the bridge
//              tablet three officers may be enrolled, and a fingerprint there
//              would sign as whoever was picked from the list.
//   PIN        everyone, everywhere. The person's OWN signing PIN, 4–6 digits,
//              chosen by them the first time they sign on a device.
//
// WHY NOT THE ACCOUNT PIN. The eight-digit PIN a Master issues is stored readable
// so it can be read out again (services/accounts.ts) — so the Master could sign
// as anybody with it. The signing PIN is chosen by its holder and kept only as a
// salted hash, on the device, in the Keychain / Keystore where there is one.
// Nobody can read it back, the Master included; a forgotten one is RESET by the
// Master (Settings → Signing), and the holder chooses a new one.
//
// It is per device, not synced: a hash of a 4–6 digit PIN uploaded to the
// vessel's database could be tried against all million combinations by anyone
// who can read that database. Kept on the device it is protected by the lockout
// below, which is the only thing standing between a short PIN and a guess.
// ===================================

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PIN_MAX, PIN_MIN, isValidSignPin, stretch } from './pinHash';
export { PIN_MAX, PIN_MIN, isValidSignPin, isWeakPin } from './pinHash';

/** What a signed record carries about HOW its signer confirmed. */
/**
 * How a signature was confirmed. A person signs — so a PIN, a fingerprint, or
 * their hand on the screen (finger or stylus, on a phone or tablet). Never a
 * face: Face ID is not a signature (10 Oct 2026).
 */
export interface SignProof {
  method: 'biometric' | 'pin' | 'drawn';
  /** The handwritten signature, for `drawn` (SVG path, 300 × 100 — components/SignaturePad). */
  drawing?: string;
  /** The device it was signed on (firebaseService.getLocalDeviceId). */
  deviceId?: string;
  at: number;
}

export const MAX_TRIES = 5;
export const LOCK_MS = 5 * 60_000;

const INDEX_KEY = 'msm:signpins';
const FAIL_PREFIX = 'msm:signpin_fail_';

// ---- storage ------------------------------------------------------------------

let _ss: any | null | undefined;
function secureStore(): any | null {
  if (_ss !== undefined) return _ss;
  _ss = null;
  if (Platform.OS === 'web' || Platform.OS === 'windows') return _ss;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (requireOptionalNativeModule && requireOptionalNativeModule('ExpoSecureStore')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _ss = require('expo-secure-store');
    }
  } catch {
    _ss = null;
  }
  return _ss;
}

/** SecureStore keys allow only [A-Za-z0-9._-]. */
function slot(personKey: string): string {
  return `msm_signpin_${personKey.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

async function getRaw(k: string): Promise<string | null> {
  const SS = secureStore();
  try {
    return SS ? await SS.getItemAsync(k) : await AsyncStorage.getItem(k);
  } catch {
    return null;
  }
}

async function setRaw(k: string, v: string | null): Promise<void> {
  const SS = secureStore();
  if (SS) {
    if (v == null) await SS.deleteItemAsync(k);
    else await SS.setItemAsync(k, v);
  } else if (v == null) await AsyncStorage.removeItem(k);
  else await AsyncStorage.setItem(k, v);
}

export interface PinHolder {
  key: string;
  name: string;
  setAt: number;
}

/** Who has a signing PIN on this device — for the Master's reset list. Names only. */
export async function pinHolders(): Promise<PinHolder[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveHolders(list: PinHolder[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

export async function hasPin(personKey: string): Promise<boolean> {
  return !!(await getRaw(slot(personKey)));
}

export async function setPin(personKey: string, name: string, pin: string): Promise<void> {
  if (!isValidSignPin(pin)) throw new Error(`The PIN is ${PIN_MIN}–${PIN_MAX} digits.`);
  const salt = randomHex(16);
  await setRaw(slot(personKey), JSON.stringify({ salt, hash: stretch(pin, salt) }));
  await clearFails(personKey);
  const list = (await pinHolders()).filter((h) => h.key !== personKey);
  await saveHolders([...list, { key: personKey, name, setAt: Date.now() }]);
}

/**
 * The Master's PIN — the key to everyone's signing PIN on this device
 * (10 Oct 2026: "under a lock; by default the captain's PIN opens it; once a
 * person has set theirs, either the admin PIN or the owner's own PIN opens it").
 * Kept like any signing PIN, under its own holder key.
 */
export const ADMIN_KEY = 'master';
export const hasAdminPin = () => hasPin(ADMIN_KEY);

/** The Master's reset: the holder chooses a new PIN the next time they sign. */
export async function resetPin(personKey: string): Promise<void> {
  await setRaw(slot(personKey), null);
  await clearFails(personKey);
  await saveHolders((await pinHolders()).filter((h) => h.key !== personKey));
}

export type PinCheck = { ok: true } | { ok: false; left: number; lockedUntil?: number };

export async function checkPin(personKey: string, pin: string): Promise<PinCheck> {
  const lock = await lockedUntil(personKey);
  if (lock) return { ok: false, left: 0, lockedUntil: lock };
  const raw = await getRaw(slot(personKey));
  if (!raw) return { ok: false, left: MAX_TRIES };
  const { salt, hash } = JSON.parse(raw);
  if (stretch(pin, salt) === hash) {
    await clearFails(personKey);
    return { ok: true };
  }
  const f = await fails(personKey);
  const count = f.count + 1;
  const until = count >= MAX_TRIES ? Date.now() + LOCK_MS : undefined;
  await AsyncStorage.setItem(FAIL_PREFIX + personKey, JSON.stringify({ count: until ? 0 : count, until }));
  return { ok: false, left: until ? 0 : MAX_TRIES - count, lockedUntil: until };
}

async function fails(personKey: string): Promise<{ count: number; until?: number }> {
  try {
    const raw = await AsyncStorage.getItem(FAIL_PREFIX + personKey);
    return raw ? JSON.parse(raw) : { count: 0 };
  } catch {
    return { count: 0 };
  }
}

export async function lockedUntil(personKey: string): Promise<number | undefined> {
  const f = await fails(personKey);
  return f.until && f.until > Date.now() ? f.until : undefined;
}

async function clearFails(personKey: string): Promise<void> {
  await AsyncStorage.removeItem(FAIL_PREFIX + personKey).catch(() => {});
}

function randomHex(bytes: number): string {
  let s = '';
  for (let i = 0; i < bytes; i++) s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return s;
}

/** "Face ID · iPhone", "PIN" — one line for a report or a history row. */
/** One word for a printed record: PIN / fingerprint / handwritten. */
export function proofShort(p: SignProof | undefined): string {
  return !p ? '' : p.method === 'biometric' ? 'fingerprint' : p.method === 'drawn' ? 'handwritten' : 'PIN';
}

export function proofText(p: SignProof | undefined): string | null {
  if (!p) return null;
  return p.method === 'biometric' ? 'Confirmed by fingerprint' : p.method === 'drawn' ? 'Signed by hand on the screen' : 'Confirmed by PIN';
}

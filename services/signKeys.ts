// ===================================
// Signing keys on this device (25 Oct 2026, stage 2 — services/seal.ts says why).
//
// Each signer has their OWN key pair on each device they sign on:
//   pin        the private key is stored ENCRYPTED with their signing PIN
//              (AES-256-GCM under the same salted, iterated SHA-256 the PIN check
//              uses — services/pinHash). Nobody else on a shared bridge tablet can
//              use it, the Master included: a Master who resets someone's PIN
//              destroys that key, and the next signature makes a NEW key, which the
//              register shows with its date — impersonation cannot pass unseen.
//   biometric  on the signer's own device only (as the fingerprint itself): a
//              second key, kept in the Keychain / Keystore and used after the finger.
//   device     one per device, for what is signed by hand — integrity only.
// Where there is a Keychain / Keystore (phones) the blobs live there; on the web
// in the browser's storage, as the signing PIN already does.
//
// Changing or resetting a PIN drops the person's keys on this device (resetKeys);
// the next signature makes a new one. Old records stay valid: the register keeps
// every public key ever used.
//
// Randomness: Hermes has no WebCrypto, so the key's 32 bytes come from expo-crypto
// (the OS generator). A build without that native module gets no key — it signs
// as before, unsealed, and the record says so.
// ===================================

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gcm } from '@noble/ciphers/aes';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

import { stretch } from './pinHash';
import { Seal, privateFrom, publicOf, sealHash, keyIdOf, contentHash } from './seal';

// ---- randomness -------------------------------------------------------------------

let _rnd: ((n: number) => Uint8Array) | null | undefined;
function rng(): ((n: number) => Uint8Array) | null {
  if (_rnd !== undefined) return _rnd;
  _rnd = null;
  const c: any = (globalThis as any).crypto;
  if (Platform.OS === 'web' && c?.getRandomValues) {
    _rnd = (n) => c.getRandomValues(new Uint8Array(n));
    return _rnd;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (requireOptionalNativeModule && requireOptionalNativeModule('ExpoCrypto')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const C = require('expo-crypto');
      _rnd = (n) => C.getRandomBytes(n);
    }
  } catch {
    _rnd = null;
  }
  return _rnd;
}

/** 32 random bytes that make a valid key, or null when this build has no generator. */
function newPrivate(): Uint8Array | null {
  const r = rng();
  if (!r) return null;
  for (let i = 0; i < 4; i++) {
    const k = privateFrom(r(32));
    if (k) return k;
  }
  return null;
}

// ---- storage (as services/signature keeps the PIN) ------------------------------------

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

const slot = (kind: 'pin' | 'bio' | 'dev', personKey: string) => `msm_signkey_${kind}_${personKey.replace(/[^A-Za-z0-9._-]/g, '_')}`;

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
  try {
    if (SS) {
      if (v == null) await SS.deleteItemAsync(k);
      else await SS.setItemAsync(k, v);
    } else if (v == null) await AsyncStorage.removeItem(k);
    else await AsyncStorage.setItem(k, v);
  } catch {
    /* a key not kept is made again next time */
  }
}

// ---- the keys -----------------------------------------------------------------------

/** A key opened for one signature: seals, and says whether it is new (for the register). */
export interface OpenKey {
  kind: Seal['kind'];
  opens?: 'pin' | 'biometric';
  pub: string;
  id: string;
  /** Made just now — the caller adds it to the vessel's register. */
  fresh: boolean;
  seal: (rec: object) => Seal;
}

function opened(priv: Uint8Array, kind: Seal['kind'], fresh: boolean, opens?: 'pin' | 'biometric'): OpenKey {
  const pub = publicOf(priv);
  return { kind, opens, pub, id: keyIdOf(pub), fresh, seal: (rec) => sealHash(priv, contentHash(rec), kind) };
}

/** The person's PIN key, opened with the PIN they just proved — made the first time. Null: no generator, or the blob is unreadable. */
export async function openPinKey(personKey: string, pin: string): Promise<OpenKey | null> {
  const k = slot('pin', personKey);
  const raw = await getRaw(k);
  if (raw) {
    try {
      const { salt, nonce, ct } = JSON.parse(raw);
      const priv = gcm(hexToBytes(stretch(pin, salt)), hexToBytes(nonce)).decrypt(hexToBytes(ct));
      return opened(priv, 'person', false, 'pin');
    } catch {
      // Encrypted under an earlier PIN (changed on another path): start a new key.
    }
  }
  const priv = newPrivate();
  const r = rng();
  if (!priv || !r) return null;
  const salt = bytesToHex(r(16));
  const nonce = r(12);
  const ct = gcm(hexToBytes(stretch(pin, salt)), nonce).encrypt(priv);
  await setRaw(k, JSON.stringify({ v: 1, salt, nonce: bytesToHex(nonce), ct: bytesToHex(ct), pub: publicOf(priv) }));
  return opened(priv, 'person', true, 'pin');
}

async function plainKey(k: string, kind: Seal['kind'], opens?: 'biometric'): Promise<OpenKey | null> {
  const raw = await getRaw(k);
  if (raw) {
    try {
      return opened(hexToBytes(JSON.parse(raw).priv), kind, false, opens);
    } catch {
      /* unreadable — make a new one */
    }
  }
  const priv = newPrivate();
  if (!priv) return null;
  await setRaw(k, JSON.stringify({ v: 1, priv: bytesToHex(priv) }));
  return opened(priv, kind, true, opens);
}

/** The person's fingerprint key — their own device only, after the finger (components/SignConfirm). */
export const openBioKey = (personKey: string) => plainKey(slot('bio', personKey), 'person', 'biometric');

/** This device's key — what is signed by hand is sealed with it. */
export const openDeviceKey = (deviceId: string) => plainKey(slot('dev', deviceId || 'this'), 'device');

/** A PIN changed or reset: the person's keys on this device go; the next signature makes new ones. */
export async function resetKeys(personKey: string): Promise<void> {
  await setRaw(slot('pin', personKey), null);
  await setRaw(slot('bio', personKey), null);
}

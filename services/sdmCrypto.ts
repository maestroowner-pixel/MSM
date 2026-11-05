// ===================================
// The encrypted .sdm file (5 Nov 2026). The same file in three projects: the app
// (utils/), SDM-Web (utils/, and through it SDM-Desktop) and ISM AI Pilot
// (services/sdmCrypto.ts, which opens these files). Change all three together.
//
// A password the seafarer chooses, scrypt, AES-256-GCM (@noble, pure JS, so one
// code path on Hermes and in a browser). A key built into the app would be
// extractable from any copy of it, so there is none. A forgotten password cannot be
// recovered, and the screens say so. GCM also detects a wrong password or a changed file.
//
// N: pure JS on Hermes took 4.4 s at 2^14 and 9 s at 2^15 on an Apple M3, more on a
// phone. N is written in the file, so a later version can raise it and old files still open.
// A file from outside is not trusted to set it: see MAX_N.
//
// The vessel's file: what an officer needs and nothing else. It is not a backup, and
// restoring one would wipe the rest of the person's data, so `isVesselFile` stops that.
// ===================================

import { gcm } from '@noble/ciphers/aes';
import { scryptAsync } from '@noble/hashes/scrypt';

export const SDM_FORMAT = 'sdm-encrypted';
export const MIN_PASSWORD = 12;
const N = 1 << 14;
const R = 8;
const P = 1;
/** A hostile file must not be able to demand gigabytes of memory for scrypt: 2^18 x 8 x 128 bytes is 256 MB. */
const MAX_N = 1 << 18;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toB64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const x = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(x >> 18) & 63] + B64[(x >> 12) & 63] + (i + 1 < b.length ? B64[(x >> 6) & 63] : '=') + (i + 2 < b.length ? B64[x & 63] : '=');
  }
  return out;
}

export function fromB64(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0, acc = 0, n = 0;
  for (const c of clean) {
    const v = B64.indexOf(c);
    if (v < 0) throw new Error('bad-file');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 255;
    }
  }
  return out;
}

/** UTF-8 by hand: not every engine this runs on is sure to have TextEncoder. */
export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0) as number;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}

export function fromUtf8(b: Uint8Array): string {
  const parts: string[] = [];
  let chunk: number[] = [];
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp = c;
    if (c >= 0xf0) cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xe0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xc0) cp = ((c & 31) << 6) | (b[i++] & 63);
    chunk.push(cp);
    if (chunk.length >= 4096) {
      parts.push(String.fromCodePoint(...chunk));
      chunk = [];
    }
  }
  parts.push(String.fromCodePoint(...chunk));
  return parts.join('');
}

const deriveKey = (password: string, salt: Uint8Array, n: number, r: number, p: number) =>
  scryptAsync(utf8(password.normalize('NFC')), salt, { N: n, r, p, dkLen: 32 });

/** `random` is the platform's: expo-crypto on a phone, crypto.getRandomValues in a browser. */
export async function encryptSdm(json: string, password: string, random: (n: number) => Uint8Array): Promise<string> {
  const salt = random(16);
  const nonce = random(12);
  const key = await deriveKey(password, salt, N, R, P);
  const data = gcm(key, nonce).encrypt(utf8(json));
  return JSON.stringify({ format: SDM_FORMAT, version: 1, kdf: { name: 'scrypt', N, r: R, p: P, salt: toB64(salt) }, cipher: 'aes-256-gcm', nonce: toB64(nonce), data: toB64(data) });
}

export function isEncryptedSdm(text: string): boolean {
  try {
    return JSON.parse(text)?.format === SDM_FORMAT;
  } catch {
    return false;
  }
}

/** The JSON inside. Throws 'wrong-password' (or a changed file: the two cannot be told apart), 'bad-file', 'newer-file'. */
export async function decryptSdm(text: string, password: string): Promise<string> {
  let f: any;
  try {
    f = JSON.parse(text);
  } catch {
    throw new Error('bad-file');
  }
  if (f?.format !== SDM_FORMAT) throw new Error('bad-file');
  if (f.version !== 1 || f.cipher !== 'aes-256-gcm' || f.kdf?.name !== 'scrypt') throw new Error('newer-file');
  const { N: n, r, p, salt } = f.kdf;
  const whole = (x: unknown, max: number): x is number => Number.isInteger(x) && (x as number) > 0 && (x as number) <= max;
  if (!whole(n, MAX_N) || (n & (n - 1)) !== 0 || n < 2 || !whole(r, 8) || !whole(p, 4) || typeof salt !== 'string' || typeof f.nonce !== 'string' || typeof f.data !== 'string') throw new Error('bad-file');
  const nonce = fromB64(f.nonce);
  if (nonce.length !== 12) throw new Error('bad-file');
  const key = await deriveKey(password, fromB64(salt), n, r, p);
  try {
    return fromUtf8(gcm(key, nonce).decrypt(fromB64(f.data)));
  } catch {
    throw new Error('wrong-password');
  }
}

const pick = (o: any, keys: string[]) => Object.fromEntries(keys.filter((k) => o?.[k] != null && o[k] !== '').map((k) => [k, o[k]]));
const PERSONAL = ['firstName', 'lastName', 'middleName', 'birthDate', 'birthPlace', 'nationality', 'phone', 'email', 'address', 'city', 'country', 'postalCode', 'visaUSA', 'visaSchengen', 'visaAustralia'];
const DOCUMENT = ['id', 'category', 'name', 'number', 'issueDate', 'expiryDate', 'noExpiryDate', 'issuePlace'];
const SERVICE = ['id', 'vesselName', 'vesselType', 'customVesselType', 'flag', 'grossTonnage', 'position', 'customPosition', 'signOn', 'signOff', 'company'];
const KIN = ['name', 'relationship', 'phone', 'email', 'address'];

/** Biometrics, day rate, photo, education, notes, DP days and every setting stay out: a list of what goes, so a new field stays out too. */
export function vesselFile(json: string): string {
  const s = JSON.parse(json);
  return JSON.stringify({
    exportKind: 'vessel',
    personal: pick(s.personal, PERSONAL),
    nextOfKin: pick(s.nextOfKin, KIN),
    documents: (s.documents ?? []).map((d: any) => pick(d, DOCUMENT)),
    seaService: (s.seaService ?? []).map((v: any) => pick(v, SERVICE)),
  });
}

export function isVesselFile(json: string): boolean {
  try {
    return JSON.parse(json)?.exportKind === 'vessel';
  } catch {
    return false;
  }
}

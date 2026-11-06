// ===================================
// A .msm backup with a password (6 Nov 2026, plan item 59). The password is the
// person's choice: a plain .msm stays a valid file, and an old one still opens.
//
// scrypt and AES-256-GCM, as in the encrypted .sdm (services/sdmCrypto.ts), but its
// own format: a backup is not a seafarer's file, and sdmCrypto is one file kept in
// three projects. Its base64 and UTF-8 are written for a few kilobytes; a backup
// carries every attached file, so these work in chunks over typed arrays.
//
// A forgotten password cannot be recovered, and the dialog says so. GCM also detects
// a wrong password or a changed file: the two cannot be told apart.
// ===================================

import { gcm } from '@noble/ciphers/aes';
import { scryptAsync } from '@noble/hashes/scrypt';

import { fromUtf8, MIN_PASSWORD } from './sdmCrypto';

export const BACKUP_FORMAT = 'msm-encrypted';
export const MIN_BACKUP_PASSWORD = MIN_PASSWORD;
const N = 1 << 14;
const R = 8;
const P = 1;
/** A file from outside must not demand gigabytes for scrypt: 2^18 x 8 x 128 bytes is 256 MB. */
const MAX_N = 1 << 18;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_CODES = Uint8Array.from(B64, (c) => c.charCodeAt(0));
const B64_VALUES = (() => {
  const v = new Int8Array(128).fill(-1);
  B64_CODES.forEach((code, i) => { v[code] = i; });
  return v;
})();
const CHUNK = 8190; // whole groups of 3 bytes, and few enough for String.fromCharCode.apply

function toB64(b: Uint8Array): string {
  const parts: string[] = [];
  const out = new Uint8Array((CHUNK / 3) * 4);
  for (let start = 0; start < b.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, b.length);
    let n = 0;
    for (let i = start; i < end; i += 3) {
      const left = end - i;
      const x = (b[i] << 16) | (left > 1 ? b[i + 1] << 8 : 0) | (left > 2 ? b[i + 2] : 0);
      out[n++] = B64_CODES[(x >> 18) & 63];
      out[n++] = B64_CODES[(x >> 12) & 63];
      out[n++] = left > 1 ? B64_CODES[(x >> 6) & 63] : 61;
      out[n++] = left > 2 ? B64_CODES[x & 63] : 61;
    }
    parts.push(String.fromCharCode.apply(null, out.subarray(0, n) as unknown as number[]));
  }
  return parts.join('');
}

function fromB64(s: string): Uint8Array {
  let len = s.length;
  while (len > 0 && s.charCodeAt(len - 1) === 61) len--;
  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let acc = 0, bits = 0, n = 0;
  for (let i = 0; i < len; i++) {
    const code = s.charCodeAt(i);
    const v = code < 128 ? B64_VALUES[code] : -1;
    if (v < 0) throw new Error('bad-file');
    acc = ((acc << 6) | v) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 255;
    }
  }
  return out;
}

/** JSON.stringify leaves no lone surrogate, so a surrogate here is always half of a pair. */
function utf8(s: string): Uint8Array {
  let size = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) size += 1;
    else if (c < 0x800) size += 2;
    else if (c >= 0xd800 && c < 0xdc00) { size += 4; i++; }
    else size += 3;
  }
  const out = new Uint8Array(size);
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out[n++] = c;
    else if (c < 0x800) {
      out[n++] = 0xc0 | (c >> 6);
      out[n++] = 0x80 | (c & 63);
    } else if (c >= 0xd800 && c < 0xdc00) {
      c = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(++i) - 0xdc00);
      out[n++] = 0xf0 | (c >> 18);
      out[n++] = 0x80 | ((c >> 12) & 63);
      out[n++] = 0x80 | ((c >> 6) & 63);
      out[n++] = 0x80 | (c & 63);
    } else {
      out[n++] = 0xe0 | (c >> 12);
      out[n++] = 0x80 | ((c >> 6) & 63);
      out[n++] = 0x80 | (c & 63);
    }
  }
  return out;
}

const deriveKey = (password: string, salt: Uint8Array, n: number, r: number, p: number) =>
  scryptAsync(utf8(password.normalize('NFC')), salt, { N: n, r, p, dkLen: 32 });

/** `random` is the platform's, services/signKeys randomBytes. `format` comes first: see isEncryptedBackup. */
export async function encryptBackup(json: string, password: string, random: (n: number) => Uint8Array): Promise<string> {
  const salt = random(16);
  const nonce = random(12);
  const key = await deriveKey(password, salt, N, R, P);
  const data = gcm(key, nonce).encrypt(utf8(json));
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, kdf: { name: 'scrypt', N, r: R, p: P, salt: toB64(salt) }, cipher: 'aes-256-gcm', nonce: toB64(nonce), data: toB64(data) });
}

/** By its first characters: a backup can be too large to parse only to ask this. */
export function isEncryptedBackup(text: string): boolean {
  return text.trimStart().startsWith(`{"format":"${BACKUP_FORMAT}"`);
}

/** The JSON inside. Throws 'wrong-password' (or a changed file), 'bad-file', 'newer-file'. */
export async function decryptBackup(text: string, password: string): Promise<string> {
  let f: any;
  try {
    f = JSON.parse(text);
  } catch {
    throw new Error('bad-file');
  }
  if (f?.format !== BACKUP_FORMAT) throw new Error('bad-file');
  if (f.version !== 1 || f.cipher !== 'aes-256-gcm' || f.kdf?.name !== 'scrypt') throw new Error('newer-file');
  const { N: n, r, p, salt } = f.kdf;
  const whole = (x: unknown, max: number): x is number => Number.isInteger(x) && (x as number) > 0 && (x as number) <= max;
  if (!whole(n, MAX_N) || (n & (n - 1)) !== 0 || n < 2 || !whole(r, 8) || !whole(p, 4) || typeof salt !== 'string' || typeof f.nonce !== 'string' || typeof f.data !== 'string') throw new Error('bad-file');
  const nonce = fromB64(f.nonce);
  if (nonce.length !== 12) throw new Error('bad-file');
  const data = fromB64(f.data);
  const key = await deriveKey(password, fromB64(salt), n, r, p);
  try {
    return fromUtf8(gcm(key, nonce).decrypt(data));
  } catch {
    throw new Error('wrong-password');
  }
}

// ===================================
// The Master's signed copy of a record book month (25 Oct 2026, MEPC.312(74)
// §4.4.3–4.4.4: an offline copy that is read-only or tamper-evident, portable,
// signed by the Master, and carries the signature's properties — name, rank,
// date and time).
//
// One ZIP:
//   <book>_<month>.pdf    the certified true copy, as printed (services/trueCopy)
//   records.json          every version of the month's entries, the earlier
//                         versions they replaced, the Master's verifications,
//                         the keys that sealed them and the month's access log
//   manifest.json         book, month, vessel, software, who signed it and when,
//                         and the SHA-256 of each file above
//   manifest.seal.json    the Master's seal over manifest.json (services/seal)
// Change one byte of any file and the copy no longer checks: the file's hash is
// not the manifest's, or the manifest is not what the Master sealed.
//
// `checkCopy` is the other end — the same code in the app ("Check a copy") and in
// `npm run check:seal`. Pure: JSZip and the hashes run under Node.
// ===================================

/* eslint-disable @typescript-eslint/no-var-requires */
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

import { Integrity, Seal, SignKeyRec, bookIntegrity, canonical, contentHash, keyIdOf, sigValid } from './seal';
import type { BookAccess, BookKey } from './bookAccess';
import { SOFTWARE } from './trueCopy';

export const COPY_FORMAT = 'ismpilot-erb-copy/1';

export interface CopyManifest {
  format: typeof COPY_FORMAT;
  software: string;
  book: BookKey;
  title: string;
  month: string;
  vessel: { name?: string; imo?: string };
  exportedAt: number;
  /** The signature's properties (§4.4.4). */
  master: { name: string; rank?: string; id: string; key: string };
  /** File name → SHA-256, hex. */
  files: Record<string, string>;
}

export interface CopyRecords {
  entries: object[];
  verifications: object[];
  keys: SignKeyRec[];
  access: BookAccess[];
}

const hexOf = (b: Uint8Array) => bytesToHex(sha256(b));

/** The files of the copy (before the seal) — `pdf` already drawn. */
export function copyFiles(pdfName: string, pdf: Uint8Array, records: CopyRecords): Record<string, Uint8Array> {
  return { [pdfName]: pdf, 'records.json': utf8ToBytes(JSON.stringify(records, null, 1)) };
}

export function copyManifest(m: Omit<CopyManifest, 'format' | 'software' | 'files'>, files: Record<string, Uint8Array>): CopyManifest {
  return { format: COPY_FORMAT, software: SOFTWARE, ...m, files: Object.fromEntries(Object.entries(files).map(([n, b]) => [n, hexOf(b)])) };
}

/** The ZIP — bytes for a browser, base64 for a phone's share sheet: the files, the manifest, the Master's seal over it. */
export async function zipCopy<K extends 'uint8array' | 'base64'>(files: Record<string, Uint8Array>, manifest: CopyManifest, seal: Seal, type: K): Promise<K extends 'base64' ? string : Uint8Array> {
  const JSZip = require('jszip');
  const zip = new JSZip();
  for (const [n, b] of Object.entries(files)) zip.file(n, b);
  zip.file('manifest.json', canonical(manifest));
  zip.file('manifest.seal.json', JSON.stringify(seal, null, 1));
  zip.file(
    'README.txt',
    [
      `${manifest.title} — the Master's signed copy.`,
      `Signed by ${manifest.master.name}${manifest.master.rank ? ` (${manifest.master.rank})` : ''}, ID ${manifest.master.id}, on ${new Date(manifest.exportedAt).toISOString()}, key ${manifest.master.key}.`,
      '',
      'manifest.json lists the SHA-256 of every file here; manifest.seal.json is the Master\'s ECDSA P-256 signature over',
      'the SHA-256 of manifest.json. records.json holds every record with its own seal. Any change to any file shows.',
      `Check it in ${manifest.software.split(',')[0]}: a record book → Check a copy.`,
    ].join('\n'),
  );
  return zip.generateAsync({ type, compression: 'DEFLATE' });
}

export interface CopyCheck {
  ok: boolean;
  problems: string[];
  manifest?: CopyManifest;
  integrity?: Integrity;
}

/** Check a signed copy (its ZIP, as bytes or base64): the Master's seal, every file's hash, every record's seal. */
export async function checkCopy(bytes: Uint8Array | string): Promise<CopyCheck> {
  const JSZip = require('jszip');
  const problems: string[] = [];
  let zip: any;
  try {
    zip = await JSZip.loadAsync(bytes, { base64: typeof bytes === 'string' });
  } catch {
    return { ok: false, problems: ['Not a ZIP file.'] };
  }
  const text = async (n: string) => (zip.file(n) ? ((await zip.file(n).async('string')) as string) : null);
  const mText = await text('manifest.json');
  const sText = await text('manifest.seal.json');
  if (!mText || !sText) return { ok: false, problems: ['Not a signed record book copy: manifest.json or manifest.seal.json is missing.'] };
  let manifest: CopyManifest;
  let seal: Seal;
  try {
    manifest = JSON.parse(mText);
    seal = JSON.parse(sText);
  } catch {
    return { ok: false, problems: ['The manifest cannot be read.'] };
  }
  if (manifest.format !== COPY_FORMAT) problems.push(`Unknown format ${String(manifest.format)}.`);
  // The seal is over the manifest's content hash — the same canonical bytes the file holds.
  if (contentHash(manifest) !== seal.hash) problems.push('The manifest was changed after the Master signed it.');
  else if (!sigValid(seal)) problems.push("The Master's signature on the manifest is not valid.");
  if (seal.key !== manifest.master.key || keyIdOf(seal.pub) !== seal.key) problems.push("The manifest's seal is not the Master's key named in it.");
  for (const [n, h] of Object.entries(manifest.files ?? {})) {
    const f = zip.file(n);
    if (!f) problems.push(`${n} is missing.`);
    else if (hexOf(await f.async('uint8array')) !== h) problems.push(`${n} was changed after the copy was signed.`);
  }
  let integrity: Integrity | undefined;
  const rText = await text('records.json');
  if (rText) {
    try {
      const r: CopyRecords = JSON.parse(rText);
      // The copy holds one month: its first entry points back into the month before, which is not in it — so no gap check here.
      integrity = { ...bookIntegrity(r.entries as any, r.verifications as any, r.keys), gaps: [] };
      if (integrity.bad.length) problems.push(`${integrity.bad.length} record(s) do not match their seal.`);
      if (integrity.badVerifications.length) problems.push(`${integrity.badVerifications.length} Master's verification(s) do not match the records.`);
      const masterKey = r.keys.find((k) => k.id === seal.key);
      if (!masterKey || masterKey.person !== manifest.master.id) problems.push("The Master's key is not in the copy's key register under the Master's ID.");
    } catch {
      problems.push('records.json cannot be read.');
    }
  }
  return { ok: !problems.length, problems, manifest, integrity };
}

/** The keys a copy needs: those of every seal in it. */
export function keysFor(recs: object[], register: SignKeyRec[]): SignKeyRec[] {
  const ids = new Set<string>();
  for (const r of recs as any[]) for (const p of [r.signedWith?.seal, r.editedWith?.seal]) if (p?.key) ids.add(p.key);
  return register.filter((k) => ids.has(k.id));
}

// ===================================
// The Master's signed copy as a file (services/signedCopy builds and checks it):
// saved by the browser on the web, the share sheet on a phone; and the picker for
// "Check a copy".
// ===================================

import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

import { CopyManifest, CopyRecords, checkCopy, copyFiles, copyManifest, zipCopy, CopyCheck } from '../services/signedCopy';
import { TrueCopy, trueCopyDoc } from '../services/trueCopy';
import type { Seal } from '../services/seal';
import { deliverFile, onWeb } from './fileShare';
import { pickBinaryFileWeb } from './webFile';
import { saveFileWeb } from './webSave';

/**
 * Draw the PDF, list the files, let `seal` sign the manifest (the Master's key,
 * opened by their signature), and hand the ZIP over.
 */
export async function deliverSignedCopy(
  c: { copy: TrueCopy; name: string },
  records: CopyRecords,
  m: Omit<CopyManifest, 'format' | 'software' | 'files'>,
  seal: (manifest: CopyManifest) => Seal,
): Promise<string | null | void> {
  const z = await buildSignedCopy(c, records, m, seal);
  if (onWeb) return saveFileWeb(new Blob([base64Bytes(z.base64) as BlobPart], { type: 'application/zip' }), z.name, 'reports');
  await deliverFile(z.name, z.base64, true, 'application/zip');
}

/** The signed copy's ZIP, not handed anywhere yet — for the share sheet, or kept on the device (utils/keptCopies). */
export async function buildSignedCopy(
  c: { copy: TrueCopy; name: string },
  records: CopyRecords,
  m: Omit<CopyManifest, 'format' | 'software' | 'files'>,
  seal: (manifest: CopyManifest) => Seal,
): Promise<{ name: string; base64: string }> {
  const pdf = new Uint8Array(trueCopyDoc({ ...c.copy, printedAt: m.exportedAt }).output('arraybuffer'));
  const files = copyFiles(c.name, pdf, records);
  const manifest = copyManifest(m, files);
  const s = seal(manifest);
  return { name: c.name.replace(/\.pdf$/i, '') + '_signed-copy.zip', base64: await zipCopy(files, manifest, s, 'base64') };
}

export function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Pick a signed copy and check it. Null: nothing picked. */
export async function pickAndCheckCopy(): Promise<CopyCheck | null> {
  if (onWeb) {
    const f = await pickBinaryFileWeb('.zip,application/zip');
    return f?.bytes ? checkCopy(new Uint8Array(f.bytes)) : null;
  }
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/zip', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  return checkCopy(await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: 'base64' as any }));
}

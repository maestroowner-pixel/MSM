// ===================================
// A maker's manual picked for a PMS machine (services/manuals, 21 Nov 2026).
// Manuals run to 50–200 MB, so the file is NOT read into a base64 string (that is
// what pickDocForAi does, and a phone runs out of memory on a big book): it is
// picked as a file, uploaded as a Blob in chunks (attachmentStorage.uploadManual),
// and on a device on no vessel copied into the app's own folder.
// ===================================

import * as DocumentPicker from 'expo-document-picker';
import { persist } from './attachments';

export interface PickedManual {
  name: string;
  size: number;
  mime: string;
  /** Native: the picked copy in the cache. */
  uri: string;
}

export const MANUAL_MAX = 200 * 1024 * 1024;
/** A device on no vessel keeps the file in the record on web; on a phone, a file of its own. */
export const MANUAL_MAX_LOCAL = 200 * 1024 * 1024;

export async function pickManual(): Promise<PickedManual | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const mime = a.mimeType || (/\.pdf$/i.test(a.name) ? 'application/pdf' : 'application/octet-stream');
  return { name: a.name ?? 'Manual.pdf', size: a.size ?? 0, mime, uri: a.uri };
}

/** The file as a Blob for the upload — read by the platform, not through a JS string. */
export async function manualBlob(p: PickedManual): Promise<Blob> {
  return await (await fetch(p.uri)).blob();
}

/** Where a device on no vessel keeps it: a copy in attachments/ (re-based by resolveUri after a reinstall). */
export async function keepManualLocally(p: PickedManual): Promise<string> {
  const ext = (p.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'pdf').toLowerCase();
  return await persist(p.uri, ext);
}

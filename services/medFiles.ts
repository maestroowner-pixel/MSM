// ===================================
// Files kept with a medical log entry — the written radio medical advice
// (13 Oct 2026: "attach the PDF of the medical advice, compressed").
//
//   PDF      in the browser it is compressed (utils/pdfCompress.web.ts) when
//            that makes it smaller; on a phone it goes as it is.
//   Photo    of the advice, or a picture file: downscaled like every photo
//            (services/images.ts, 1600 px JPEG).
//
// On a vessel that syncs, the file goes to its own folder in Cloud Storage that
// only the Master and the officers can open (storage.rules `medical`), and the
// entry keeps the link. A device on its own keeps it inside the entry.
// ===================================

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { downscale } from './images';
import { uploadMedical, uploadRestricted } from './attachmentStorage';
import { pickFromCamera } from './attachments';
import { onWeb } from '../utils/fileShare';
import { pickBinaryFileWeb } from '../utils/webFile';
import { compressPdf } from '../utils/pdfCompress';

export const MAX_MED_FILE = 8 * 1024 * 1024;

export interface PickedMedFile {
  name: string;
  dataUri: string;
  bytes: number;
  /** What was done to it — "compressed 3.1 MB → 420 KB". */
  note?: string;
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const sizeText = kb;

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const bytesOfB64 = (b: string) => Math.floor((b.length * 3) / 4) - (b.endsWith('==') ? 2 : b.endsWith('=') ? 1 : 0);

/** A picture (file, blob or data URI) as a downscaled JPEG data URI — for the AI too (screens/InspectionSc). */
export async function imageToDataUri(uri: string): Promise<string> {
  const small = await downscale(uri);
  if (small.startsWith('data:')) return small;
  if (onWeb) {
    const blob = await (await fetch(small)).blob();
    return await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  return `data:image/jpeg;base64,${await FileSystem.readAsStringAsync(small, { encoding: 'base64' as any })}`;
}

/** A PDF or a picture of the advice, made as small as it sensibly goes. Null when cancelled. */
export async function pickMedFile(): Promise<PickedMedFile | null> {
  if (onWeb) {
    const f = await pickBinaryFileWeb('.pdf,application/pdf,image/*');
    if (!f?.bytes) return null;
    const raw = new Uint8Array(f.bytes);
    if (/\.pdf$/i.test(f.name)) {
      const small = await compressPdf(raw);
      const use = small ?? raw;
      return { name: f.name, dataUri: `data:application/pdf;base64,${b64(use)}`, bytes: use.length, ...(small ? { note: `compressed ${kb(raw.length)} → ${kb(small.length)}` } : {}) };
    }
    const url = URL.createObjectURL(new Blob([raw]));
    const dataUri = await imageToDataUri(url);
    URL.revokeObjectURL(url);
    return { name: f.name.replace(/\.\w+$/, '.jpg'), dataUri, bytes: bytesOfB64(dataUri.slice(dataUri.indexOf(',') + 1)), note: `picture ${kb(raw.length)} → ${kb(bytesOfB64(dataUri.slice(dataUri.indexOf(',') + 1)))}` };
  }
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  if (/\.pdf$/i.test(a.name) || a.mimeType === 'application/pdf') {
    const data = await FileSystem.readAsStringAsync(a.uri, { encoding: 'base64' as any });
    return { name: a.name, dataUri: `data:application/pdf;base64,${data}`, bytes: bytesOfB64(data) };
  }
  const dataUri = await imageToDataUri(a.uri);
  return { name: a.name.replace(/\.\w+$/, '.jpg'), dataUri, bytes: bytesOfB64(dataUri.slice(dataUri.indexOf(',') + 1)) };
}

/**
 * A paper list for the AI to read (services/aiImport): a PDF as it is (the text
 * must stay sharp — no recompressing), a picture downscaled. Null when cancelled.
 */
export async function pickDocForAi(): Promise<PickedMedFile | null> {
  if (onWeb) {
    const f = await pickBinaryFileWeb('.pdf,application/pdf,image/*');
    if (!f?.bytes) return null;
    const raw = new Uint8Array(f.bytes);
    if (/\.pdf$/i.test(f.name)) return { name: f.name, dataUri: `data:application/pdf;base64,${b64(raw)}`, bytes: raw.length };
    const url = URL.createObjectURL(new Blob([raw]));
    const dataUri = await imageToDataUri(url);
    URL.revokeObjectURL(url);
    return { name: f.name, dataUri, bytes: bytesOfB64(dataUri.slice(dataUri.indexOf(',') + 1)) };
  }
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  if (/\.pdf$/i.test(a.name) || a.mimeType === 'application/pdf') {
    const data = await FileSystem.readAsStringAsync(a.uri, { encoding: 'base64' as any });
    return { name: a.name, dataUri: `data:application/pdf;base64,${data}`, bytes: bytesOfB64(data) };
  }
  const dataUri = await imageToDataUri(a.uri);
  return { name: a.name, dataUri, bytes: bytesOfB64(dataUri.slice(dataUri.indexOf(',') + 1)) };
}

/** A photograph of the written advice, downscaled. Null when cancelled. */
export async function photoMedFile(): Promise<PickedMedFile | null> {
  const p = await pickFromCamera();
  if (!p) return null;
  const dataUri = await imageToDataUri(p.uri);
  return { name: `Advice ${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.jpg`, dataUri, bytes: bytesOfB64(dataUri.slice(dataUri.indexOf(',') + 1)) };
}

/** Where the file is kept: a link to the officers-only folder, or (a device on its own) the file itself. */
export async function keepMedFile(vesselImo: string | undefined, synced: boolean, treatmentId: string, fileId: string, f: PickedMedFile): Promise<string> {
  if (f.bytes > MAX_MED_FILE) throw new Error(`${kb(f.bytes)} is too large — at most ${kb(MAX_MED_FILE)}. Photograph the pages instead.`);
  if (!synced) return f.dataUri;
  const imo = (vesselImo ?? '').replace(/\D/g, '');
  if (!imo) throw new Error('The vessel has no IMO number — set it in Settings.');
  return uploadMedical(imo, treatmentId, fileId, f.dataUri);
}

/** An officers-only document's file (types/officerDocs.ts): the restricted folder, or (a device on its own) the file itself. */
export async function keepRestrictedFile(vesselImo: string | undefined, synced: boolean, docId: string, fileId: string, f: PickedMedFile): Promise<string> {
  if (f.bytes > MAX_MED_FILE) throw new Error(`${kb(f.bytes)} is too large — at most ${kb(MAX_MED_FILE)}.`);
  if (!synced) return f.dataUri;
  const imo = (vesselImo ?? '').replace(/\D/g, '');
  if (!imo) throw new Error('The vessel has no IMO number — set it in Settings.');
  return uploadRestricted(imo, docId, fileId, f.dataUri);
}

/** Open a kept file: the link in the browser / viewer, or the file itself. */
export async function openMedFile(url: string, name: string): Promise<void> {
  const { Linking } = await import('react-native');
  if (!url.startsWith('data:')) {
    await Linking.openURL(url);
    return;
  }
  if (onWeb) {
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const mime = /^data:([^;,]+)/.exec(url)?.[1] ?? 'application/octet-stream';
    window.open(URL.createObjectURL(new Blob([bytes], { type: mime })), '_blank');
    return;
  }
  const Sharing = await import('expo-sharing');
  const dest = `${FileSystem.cacheDirectory}${name.replace(/[\\/:*?"<>|]+/g, ' ')}`;
  await FileSystem.writeAsStringAsync(dest, url.slice(url.indexOf(',') + 1), { encoding: 'base64' as any });
  await Sharing.shareAsync(dest);
}

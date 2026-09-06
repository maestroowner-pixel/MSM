// ===================================
// Attachments — pick a photo (camera/library) or a document, persist the file
// into the app's document directory, and open/share/delete it.
// ===================================

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { uid } from '../utils/id';
import { downscale } from './images';

// All item attachments AND certificate files live here. Exported for the
// backup service, which bundles/restores these binaries.
export const ATTACHMENTS_DIR = `${FileSystem.documentDirectory}attachments/`;
const DIR = ATTACHMENTS_DIR;

export async function ensureAttachmentsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}
const ensureDir = ensureAttachmentsDir;

/**
 * Re-base a stored attachment/certificate uri onto the CURRENT document
 * directory. iOS app-container UUIDs change on reinstall (and on simulator
 * rebuilds), which invalidates the absolute `file://…/Application/<UUID>/…`
 * paths saved earlier — the file's name inside `attachments/` is stable, so we
 * recompute the prefix. No-op for uris that aren't under `attachments/`.
 */
export function resolveUri(uri?: string): string | undefined {
  if (!uri) return uri;
  const marker = 'attachments/';
  const idx = uri.lastIndexOf(marker);
  if (idx === -1) return uri;
  return ATTACHMENTS_DIR + uri.slice(idx + marker.length);
}

function extOf(name?: string | null, fallback = 'dat'): string {
  const m = (name || '').match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : fallback;
}

/** Copy a source uri into the persistent attachments dir; returns the new uri. */
async function persist(srcUri: string, ext: string): Promise<string> {
  await ensureDir();
  const dest = `${DIR}${uid('att')}.${ext}`;
  await FileSystem.copyAsync({ from: srcUri, to: dest });
  return dest;
}

/**
 * Photos are downscaled on the way in, not on the way out.
 *
 * Doing it here means every consumer benefits — inspection evidence, item
 * attachments, the `.msm` backup that embeds them as base64 — and, more to the
 * point, means the big original never reaches `attachments/` at all. Shrinking
 * at upload time instead would leave a 3 MB file on a phone with 200 items on
 * it, and would have to be repeated by every other path that moves the file.
 *
 * See services/images.ts for why 1600px, and why the real cost is the vessel's
 * satellite airtime rather than cloud storage.
 */
async function persistPhoto(srcUri: string, ext: string): Promise<string> {
  const smaller = await downscale(srcUri);
  // downscale() re-encodes to JPEG, so the extension follows it.
  return persist(smaller, smaller === srcUri ? ext : 'jpg');
}

export interface PickedFile {
  uri: string;
  name?: string;
  kind: 'photo' | 'document';
}

/** Take a photo with the camera. Returns null if cancelled / denied. */
export async function pickFromCamera(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Camera permission needed', 'Enable camera access in Settings to take photos.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const uriOut = await persistPhoto(a.uri, extOf(a.fileName, 'jpg'));
  return { uri: uriOut, name: a.fileName ?? 'Photo', kind: 'photo' };
}

/** Pick a photo from the library. */
export async function pickFromLibrary(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photos permission needed', 'Enable photo access in Settings to attach images.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const uriOut = await persistPhoto(a.uri, extOf(a.fileName, 'jpg'));
  return { uri: uriOut, name: a.fileName ?? 'Photo', kind: 'photo' };
}

/** Pick a document (PDF, image, etc.). */
export async function pickDocument(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const isImage = (a.mimeType || '').startsWith('image/');
  const uriOut = isImage
    ? await persistPhoto(a.uri, extOf(a.name, 'jpg'))
    : await persist(a.uri, extOf(a.name, 'pdf'));
  return { uri: uriOut, name: a.name ?? 'Document', kind: isImage ? 'photo' : 'document' };
}

/** Open / preview a stored file via the OS share/quick-look sheet. */
/** Extension for a data: URI, so the written file opens in the right app. */
function extFor(dataUri: string): string {
  const m = /^data:([^;,]+)/.exec(dataUri);
  const mime = m ? m[1] : '';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/heic') return 'heic';
  if (mime.startsWith('image/')) return 'jpg';
  return 'bin';
}

export async function openFile(uri: string): Promise<void> {
  try {
    if (!(await Sharing.isAvailableAsync())) return;
    let target = resolveUri(uri) ?? uri;

    // A PHOTO TAKEN IN THE BROWSER IS NOT A FILE. It arrives as a base64 `data:`
    // URI (attachments.web.ts), and iOS refuses to share one — "You don't have
    // access to the provided file", which is true and unhelpful: there is no
    // file. So it is written to a real one first. Cached under a name derived
    // from the content length so opening the same photograph twice does not
    // write it twice.
    if (target.startsWith('data:')) {
      const comma = target.indexOf(',');
      const base64 = target.slice(comma + 1);
      await ensureAttachmentsDir();
      const path = `${DIR}shared_${base64.length}.${extFor(target)}`;
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' });
      }
      target = path;
    }

    await Sharing.shareAsync(target);
  } catch (e: any) {
    Alert.alert('Cannot open file', String(e?.message ?? e));
  }
}

/** Delete every stored attachment/certificate file (best-effort). */
export async function clearAttachmentsDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (info.exists) await FileSystem.deleteAsync(DIR, { idempotent: true });
  } catch {
    /* ignore */
  }
}

/** Delete a stored file (best-effort). */
export async function deleteFile(uri?: string): Promise<void> {
  const target = resolveUri(uri);
  if (!target || !target.startsWith(DIR)) return;
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch {
    /* ignore */
  }
}

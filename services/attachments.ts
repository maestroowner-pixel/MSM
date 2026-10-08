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

/**
 * WHAT AN APP MAY SAY AFTER A REFUSAL — this is the line App Review draws, and
 * these two lines are where it was crossed.
 *
 * They used to read "Enable camera access in Settings to take photos". That is a
 * polite instruction, and guideline 5.1.1(iv) forbids exactly that: pressing the
 * user towards a decision they have already made. Build 20304 was rejected for
 * it on 10 Sep 2026 — "the user is redirected to the Settings app to grant
 * access after tapping Don't Allow" — after 20302 had been rejected for a button
 * that borrowed the system prompt's own verb ("Allow camera").
 *
 * So the rule for anything on this path: state what cannot happen, name the
 * route that still works, and stop. No Settings, no second prompt, no button
 * that leads to either. Both other ways to attach a file need no camera and sit
 * in the same menu, one tap away, so nothing is actually lost by saying yes to
 * the user's no.
 */

/** Take a photo with the camera. Returns null if cancelled / denied. */
export async function pickFromCamera(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      'No camera access',
      'ISMpilot cannot open the camera, so a photo cannot be taken here. Attaching an existing photo ' +
        'or a document works without it.'
    );
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
    Alert.alert(
      'No access to the photo library',
      'ISMpilot cannot open the library, so a photo cannot be chosen from it. Taking a new photo or ' +
        'attaching a document works without it.'
    );
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

/**
 * A file that can be read from THIS device: a local path as it is, a Storage
 * download URL fetched into the cache first.
 *
 * Since attachments moved to Cloud Storage, a file added on another device is a
 * link in the register, and every native reader of files — sharing, the ZIP
 * export, the .msm backup — accepts only local paths. Sharing failed out loud
 * (a customer's PDF on an MOB, 14 Sep 2026); the ZIP and the backup skipped such
 * files in silence, which is worse. Cached per URL, so a second read costs no
 * airtime. Stored objects are named by attachment id with no extension, so the
 * name comes from the attachment, else from the response's Content-Type.
 */
export async function ensureLocalFile(uri: string, name?: string): Promise<{ uri: string; name: string }> {
  const resolved = resolveUri(uri) ?? uri;
  if (!/^https?:/i.test(resolved)) return { uri: resolved, name: safeName(name) || resolved.split('/').pop() || 'file' };
  const dir = `${FileSystem.cacheDirectory}remote/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const key = urlKey(resolved);
  const cached = (await FileSystem.readDirectoryAsync(dir).catch(() => [] as string[])).find((f) => f.startsWith(`${key}_`));
  if (cached) return { uri: `${dir}${cached}`, name: cached.slice(key.length + 1) };

  let fileName = safeName(name) || remoteFileName(resolved);
  const tmp = `${dir}${key}.download`;
  const res = await FileSystem.downloadAsync(resolved, tmp);
  if (res.status < 200 || res.status >= 300) {
    await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
    throw new Error(
      res.status === 403 || res.status === 404
        ? 'This file is no longer available on the vessel.'
        : `The file could not be downloaded (HTTP ${res.status}). Check the connection and try again.`
    );
  }
  if (!/\.[a-z0-9]{2,5}$/i.test(fileName)) {
    const type = String(res.headers?.['Content-Type'] ?? res.headers?.['content-type'] ?? '').split(';')[0].trim();
    const ext = extForMime(type);
    if (ext) fileName = `${fileName}.${ext}`;
  }
  const target = `${dir}${key}_${fileName}`;
  await FileSystem.moveAsync({ from: tmp, to: target });
  return { uri: target, name: fileName };
}

/** `name` — the attachment's own name, when known; it supplies the extension a Storage URL lacks. */
export async function openFile(uri: string, name?: string): Promise<void> {
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

    // A FILE ADDED ON ANOTHER DEVICE IS A LINK. Since attachments moved to Cloud
    // Storage the register carries a download URL, and `shareAsync` accepts only
    // local files: a PDF put on an MOB from the website opened on a phone as
    // "Only local file URLs are supported (expected scheme to be 'file', got
    // 'https')" (14 Sep 2026). So it is downloaded first, under its own name —
    // the extension is what lets Android offer a PDF viewer rather than "open
    // with…" — and kept in the cache, so a second open costs no airtime.
    let mimeType: string | undefined;
    if (/^https?:/i.test(target)) {
      const local = await ensureLocalFile(target, name);
      target = local.uri;
      mimeType = mimeFor(local.name);
    }

    await Sharing.shareAsync(target, mimeType ? { mimeType, UTI: utiFor(mimeType) } : undefined);
  } catch (e: any) {
    Alert.alert('Cannot open file', String(e?.message ?? e));
  }
}

/**
 * "MOB manual.pdf" out of a Storage download URL
 * (…/o/safety_vessels%2F9967093%2Fattachments%2Fatt_x_MOB%20manual.pdf?alt=media&token=…).
 * Anything that cannot be a file name falls back to "file".
 */
function remoteFileName(url: string): string {
  let path = url.split('?')[0];
  const o = path.indexOf('/o/');
  if (o >= 0) path = path.slice(o + 3);
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep it encoded */
  }
  const base = path.split('/').pop() || 'file';
  return base.replace(/[^\w.\- ]+/g, '_').slice(-80) || 'file';
}

function safeName(name?: string): string {
  return (name ?? '').replace(/[^\w.\- ]+/g, '_').trim().slice(-80);
}

function extForMime(mime: string): string | undefined {
  return (
    {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/heic': 'heic',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt',
    } as Record<string, string>
  )[mime];
}

/** A short stable key per URL, so two different files called "manual.pdf" do not collide. */
function urlKey(url: string): string {
  let h = 5381;
  const s = url.split('&token=')[0];
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function mimeFor(name: string): string | undefined {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return (
    {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      heic: 'image/heic',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
    } as Record<string, string>
  )[ext];
}

function utiFor(mime: string): string | undefined {
  if (mime === 'application/pdf') return 'com.adobe.pdf';
  if (mime === 'image/jpeg') return 'public.jpeg';
  if (mime === 'image/png') return 'public.png';
  return undefined;
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

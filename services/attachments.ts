// ===================================
// Attachments — pick a photo (camera/library) or a document, persist the file
// into the app's document directory, and open/share/delete it.
// ===================================

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { uid } from '../utils/id';
import { macOpenFile, macPersistFile, macOpenPath, macDeletePath } from '../utils/MacFileManager';

// macOS: expo-image/document-picker + expo-file-system are mocked, so attachments
// are picked via the native Open panel and stored in the app container natively.
const onMacOS = Platform.OS === 'macos';
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'heic', 'heif', 'gif', 'webp', 'bmp', 'tiff'];
const DOC_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'rtf', ...IMAGE_EXTS];
const isImageName = (name: string) => IMAGE_EXTS.some((e) => name.toLowerCase().endsWith('.' + e));

// All item attachments AND certificate files live here. Exported for the
// backup service, which bundles/restores these binaries.
export const ATTACHMENTS_DIR = `${FileSystem.documentDirectory}attachments/`;
const DIR = ATTACHMENTS_DIR;

export async function ensureAttachmentsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}
const ensureDir = ensureAttachmentsDir;

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

export interface PickedFile {
  uri: string;
  name?: string;
  kind: 'photo' | 'document';
}

/** macOS: pick a file via the native Open panel and persist it; returns a PickedFile. */
async function macPick(extensions: string[]): Promise<PickedFile | null> {
  const picked = await macOpenFile(extensions);
  if (!picked) return null;
  const uri = await macPersistFile(picked.name, picked.content);
  if (!uri) return null;
  return { uri, name: picked.name, kind: isImageName(picked.name) ? 'photo' : 'document' };
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
  const uriOut = await persist(a.uri, extOf(a.fileName, 'jpg'));
  return { uri: uriOut, name: a.fileName ?? 'Photo', kind: 'photo' };
}

/** Pick a photo from the library. */
export async function pickFromLibrary(): Promise<PickedFile | null> {
  if (onMacOS) return macPick(IMAGE_EXTS);
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photos permission needed', 'Enable photo access in Settings to attach images.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const uriOut = await persist(a.uri, extOf(a.fileName, 'jpg'));
  return { uri: uriOut, name: a.fileName ?? 'Photo', kind: 'photo' };
}

/** Pick a document (PDF, image, etc.). */
export async function pickDocument(): Promise<PickedFile | null> {
  if (onMacOS) return macPick(DOC_EXTS);
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const isImage = (a.mimeType || '').startsWith('image/');
  const uriOut = await persist(a.uri, extOf(a.name, isImage ? 'jpg' : 'pdf'));
  return { uri: uriOut, name: a.name ?? 'Document', kind: isImage ? 'photo' : 'document' };
}

/** Open / preview a stored file via the OS share/quick-look sheet. */
export async function openFile(uri: string): Promise<void> {
  if (onMacOS) {
    await macOpenPath(uri);
    return;
  }
  try {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
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
  if (!uri) return;
  if (onMacOS) {
    await macDeletePath(uri);
    return;
  }
  if (!uri.startsWith(DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* ignore */
  }
}

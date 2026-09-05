// ===================================
// Inspection photos in Cloud Storage.
//
// THE PATH IS DERIVED, NOT STORED. A photo lives at
//
//     safety_vessels/{vessel}/inspections/{inspectionId}/{photoId}.jpg
//
// built from ids the record already carries. That is deliberate and it is the
// crux of making this work at all: a signed inspection is IMMUTABLE (see
// types/inspection.ts, and firestore.rules, which now permits an update only to
// the `defect` field). If the upload had to write a download URL back onto the
// record afterwards, either the record would stop being immutable or the rules
// would have to allow a write they should not. Deriving the location instead
// means every device can find the file from the record it already has, and
// nothing is ever written back.
//
// UPLOADS GO AS BASE64, not as a Blob. `fetch(file://…).blob()` is unreliable on
// React Native; reading through expo-file-system and handing Firebase a base64
// string is the path that actually works on a device.
//
// The local file is the original and stays. Storage is for the OTHER devices —
// the phone that took the photo already has it, and `resolveUri` keeps finding
// it across reinstalls.
// ===================================

import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';

import { Attachment } from '../types/equipment';
import { Inspection } from '../types/inspection';
import * as fb from './firebaseService';
import { ATTACHMENTS_DIR, ensureAttachmentsDir, resolveUri } from './attachments';

const ROOT = 'safety_vessels';

function bucket() {
  const app = fb.firebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  return getStorage(app);
}

/** Where this photo belongs. Pure — no I/O, no state. */
export function photoPath(vessel: string, inspectionId: string, photoId: string): string {
  return `${ROOT}/${vessel.replace(/\D/g, '')}/inspections/${inspectionId}/${photoId}.jpg`;
}

/** Local cache name for a fetched remote photo — stable, so it is fetched once. */
function cacheName(inspectionId: string, photoId: string): string {
  return `insp_${inspectionId}_${photoId}.jpg`;
}

/** Upload one photo. Throws on failure so the queue can retry. */
export async function uploadPhoto(
  vessel: string,
  inspectionId: string,
  photoId: string,
  localUri: string
): Promise<void> {
  const uri = resolveUri(localUri);
  if (!uri) throw new Error('Photo file is missing on this device.');
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error('Photo file is missing on this device.');

  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  await uploadString(storageRef(bucket(), photoPath(vessel, inspectionId, photoId)), base64, 'base64', {
    contentType: 'image/jpeg',
  });
}

/**
 * Make a photo viewable on THIS device: return the local file if it is here,
 * otherwise fetch it from Storage into the attachments dir and return that.
 *
 * Returns null when the photo is neither here nor uploaded yet — which is a
 * normal state, not an error: the queue may still be holding it on the other
 * phone, waiting for a connection worth spending.
 */
export async function ensureLocalPhoto(
  vessel: string,
  inspectionId: string,
  photo: Attachment
): Promise<string | null> {
  const local = resolveUri(photo.uri);
  if (local) {
    const info = await FileSystem.getInfoAsync(local);
    if (info.exists) return local;
  }

  const cached = `${ATTACHMENTS_DIR}${cacheName(inspectionId, photo.id)}`;
  const cachedInfo = await FileSystem.getInfoAsync(cached);
  if (cachedInfo.exists) return cached;

  try {
    const url = await getDownloadURL(storageRef(bucket(), photoPath(vessel, inspectionId, photo.id)));
    await ensureAttachmentsDir();
    const res = await FileSystem.downloadAsync(url, cached);
    return res.status === 200 ? cached : null;
  } catch {
    // Not uploaded yet, no signal, or no bucket. Nothing to show, nothing broken.
    return null;
  }
}

/** Every photo of a record, as queue work. */
export function photosOf(insp: Inspection): Attachment[] {
  return insp.photos ?? [];
}

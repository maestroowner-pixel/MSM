// ===================================
// Item and certificate attachments in Cloud Storage.
//
// WHY THIS EXISTS. In a browser an attachment IS its data: there is no writable
// files directory, so `services/attachments.web.ts` keeps each file as a base64
// `data:` URI inside the item itself. The register then travels to Firestore as
// ONE document, and a Firestore document stops at 1 MiB. On 6 Sep 2026 a vessel
// added two photographs and sync died for every device on board with an error
// that named only a byte count. The register is what the crew cannot lose; it
// must not be held hostage by an image.
//
// SO THE BYTES GO TO A BUCKET and the register carries a reference. The
// reference is the file's **download URL**, not its path, and that is a
// deliberate trade:
//
//   • A URL is a plain string that every existing render site already handles.
//     `resolveUri` stays synchronous, `<Image source={{uri}}>` keeps working, and
//     no screen has to learn to await anything. A path would have to be resolved
//     through `getDownloadURL` at render time — asynchronous, in half a dozen
//     places, for no gain the user can see.
//   • The cost: a download URL carries its own access token, so anyone holding
//     the string can fetch the file without a session. It lives only inside the
//     vessel's register, which only an approved device of that vessel can read —
//     so the URL is exactly as exposed as the register itself, and if the
//     register leaks the photographs were lost anyway.
//
// UPLOAD FAILURE IS NOT FATAL. If a file cannot be uploaded — no signal, a
// bucket that is not there yet — the caller leaves a marker in its place and the
// records still go up whole. Dates, positions and expiries are the part the ship
// is inspected on; a photograph that arrives on the next connection has cost
// nobody anything.
// ===================================

import { getStorage, ref as storageRef, uploadString, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

import * as fb from './firebaseService';

const ROOT = 'safety_vessels';

function bucket() {
  const app = fb.firebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  return getStorage(app);
}

/** Is this string a file we are still carrying inline, rather than a reference? */
export function isInline(uri?: string): boolean {
  return typeof uri === 'string' && uri.startsWith('data:');
}

/** Is it already somewhere else — uploaded, or marked as not-yet-uploaded? */
export function isRemote(uri?: string): boolean {
  return typeof uri === 'string' && (uri.startsWith('http://') || uri.startsWith('https://'));
}

/**
 * Where a file lives. Derived from ids the record already carries, so a device
 * cannot smuggle a file in under a name that means something else, and any
 * device can name the same object without being told.
 */
export function attachmentPath(vessel: string, ownerId: string, fileId: string): string {
  return `${ROOT}/${vessel.replace(/\D/g, '')}/attachments/${ownerId}/${fileId}`;
}

/**
 * A short tag of a file's content, for its path: a replaced file goes to a new
 * object, never over the old one (storage.rules lets only officers change a file).
 * Length plus an FNV-1a over every 61st character — enough to tell two files apart.
 */
export function fileTag(dataUri: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < dataUri.length; i += 61) {
    h ^= dataUri.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${dataUri.length.toString(36)}${h.toString(36)}`;
}

/** MIME type out of a data: URI — `data:image/jpeg;base64,…`. */
function mimeOf(dataUri: string): string {
  const m = /^data:([^;,]+)/.exec(dataUri);
  return m ? m[1] : 'application/octet-stream';
}

/**
 * Put one inline file in the bucket and hand back its URL.
 *
 * Throws on failure so the caller can decide — the register push does not stop
 * for a photograph.
 */
export async function uploadInline(
  vessel: string,
  ownerId: string,
  fileId: string,
  dataUri: string
): Promise<string> {
  const path = attachmentPath(vessel, ownerId, fileId);
  const ref = storageRef(bucket(), path);
  // 'data_url' hands Firebase the whole `data:` string and lets it do the
  // decoding — the same string the browser already holds, with no round trip
  // through a Blob that React Native would not survive.
  try {
    await uploadString(ref, dataUri, 'data_url', { contentType: mimeOf(dataUri) });
  } catch (e) {
    // Refused over a file already there (a crew device may not change one —
    // storage.rules): the file in the cloud stands, as an older upload of it.
    const url = await getDownloadURL(ref).catch(() => null);
    if (!url) throw e;
    return url;
  }
  return await getDownloadURL(ref);
}

/**
 * A PMS machine's manual (services/manualFile): a Blob sent in chunks, with progress
 * 0–1, so a 150 MB book neither becomes a JS string nor starts again from nothing
 * on a dropped chunk. The file id must start with `man_` — storage.rules lets only
 * those, from an officer or the office, go above 12 MB (up to 200).
 */
export async function uploadManual(
  vessel: string, ownerId: string, fileId: string, blob: Blob, contentType: string, onProgress?: (part: number) => void,
): Promise<string> {
  if (!fileId.startsWith('man_')) throw new Error('A manual\'s file id starts with man_.');
  const ref = storageRef(bucket(), attachmentPath(vessel, ownerId, fileId));
  const task = uploadBytesResumable(ref, blob, { contentType });
  await new Promise<void>((resolve, reject) => {
    task.on('state_changed', (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve());
  });
  return await getDownloadURL(ref);
}

/**
 * A medical log file (services/medFiles.ts) — its own folder, which only the
 * Master and the officers may read (storage.rules).
 */
export async function uploadMedical(vessel: string, ownerId: string, fileId: string, dataUri: string): Promise<string> {
  const ref = storageRef(bucket(), `${ROOT}/${vessel.replace(/\D/g, '')}/medical/${ownerId}/${fileId}`);
  await uploadString(ref, dataUri, 'data_url', { contentType: mimeOf(dataUri) });
  return await getDownloadURL(ref);
}

/** The scan of a passport, visa or medical (types/certificate.ts CertPrivate): Officers and the Master only (storage.rules `crew_docs/`). */
export async function uploadCrewDoc(vessel: string, certId: string, dataUri: string): Promise<string> {
  const ref = storageRef(bucket(), `${ROOT}/${vessel.replace(/\D/g, '')}/crew_docs/${certId}/scan`);
  await uploadString(ref, dataUri, 'data_url', { contentType: mimeOf(dataUri) });
  return await getDownloadURL(ref);
}

export async function deleteCrewDoc(vessel: string, certId: string): Promise<void> {
  await deleteObject(storageRef(bucket(), `${ROOT}/${vessel.replace(/\D/g, '')}/crew_docs/${certId}/scan`));
}

/** An officers-only document's file (types/officerDocs.ts) — its own folder (storage.rules `restricted/`). */
export async function uploadRestricted(vessel: string, ownerId: string, fileId: string, dataUri: string): Promise<string> {
  const ref = storageRef(bucket(), `${ROOT}/${vessel.replace(/\D/g, '')}/restricted/${ownerId}/${fileId}`);
  await uploadString(ref, dataUri, 'data_url', { contentType: mimeOf(dataUri) });
  return await getDownloadURL(ref);
}

/** Remove a file. Best-effort: a missing object is already the desired state. */
export async function removeAttachment(vessel: string, ownerId: string, fileId: string): Promise<void> {
  try {
    await deleteObject(storageRef(bucket(), attachmentPath(vessel, ownerId, fileId)));
  } catch {
    /* gone, or never arrived */
  }
}

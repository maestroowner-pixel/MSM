// ===================================
// Evidence photos out of the record's cloud copy — pure, no I/O.
//
// In a browser a photo IS a base64 `data:` URI inside the record
// (services/attachments.web.ts has no files directory). A signed record — an
// inspection, a machinery defect and its closing, a PMS job done, a rope entry,
// a yard job, an oil sample — travels as ONE Firestore document, and Firestore
// caps a document at 1 MiB: three or four photographs and the write is refused,
// the record stays in the queue for good and nobody ashore ever sees it.
//
// The photo itself does not need the document: the photo queue already sends
// every `kind: 'photo'` of the record to Storage under a path built from the ids
// (services/photoStorage.ts), and EvidencePhoto finds it there. So the cloud copy
// keeps the attachment with the marker in place of the bytes, as the register
// does (firebaseService `stripInlineFiles`), and the device that took it puts its
// own bytes back over the marker when the record comes round again.
//
// Documents (`kind: 'document'`) are not queued, so they stay as they are.
// ===================================

/** Left where the bytes were. The same marker the register uses; attachments.web.ts reads it as "not here". */
export const INLINE_ELSEWHERE = 'msm:inline-not-synced';

type Photo = { id?: string; kind?: string; uri?: string };

const isInlinePhoto = (p: Photo) => p?.kind === 'photo' && typeof p.uri === 'string' && p.uri.startsWith('data:');

/** Every `photos` list in a record, however deep (a defect's `closed`, a yard job's `accepted`). */
function walk(v: any, fn: (photos: Photo[]) => Photo[] | null): any {
  if (Array.isArray(v)) {
    let changed = false;
    const out = v.map((x) => {
      const y = walk(x, fn);
      if (y !== x) changed = true;
      return y;
    });
    return changed ? out : v;
  }
  if (!v || typeof v !== 'object') return v;
  let out: any = v;
  for (const [k, x] of Object.entries(v)) {
    const y = k === 'photos' && Array.isArray(x) ? fn(x as Photo[]) ?? walk(x, fn) : walk(x, fn);
    if (y !== x) {
      if (out === v) out = { ...v };
      out[k] = y;
    }
  }
  return out;
}

/** The record as it goes to the cloud: an inline photo's bytes replaced by the marker. Unchanged records come back as they were. */
export function photosToCloud<T>(r: T): T {
  return walk(r, (photos) =>
    photos.some(isInlinePhoto) ? photos.map((p) => (isInlinePhoto(p) ? { ...p, uri: INLINE_ELSEWHERE } : p)) : null
  );
}

/** The photo uris this device holds for a record, by photo id. */
function localUris(r: any): Map<string, string> {
  const m = new Map<string, string>();
  walk(r, (photos) => {
    for (const p of photos) if (p?.id && p.uri && p.uri !== INLINE_ELSEWHERE) m.set(p.id, p.uri);
    return null;
  });
  return m;
}

/** A record from the cloud, with this device's own bytes put back where the cloud has only the marker. */
export function photosFromCloud<T>(local: T | undefined, remote: T): T {
  if (!local) return remote;
  const mine = localUris(local);
  if (!mine.size) return remote;
  return walk(remote, (photos) =>
    photos.some((p) => p?.uri === INLINE_ELSEWHERE && p.id && mine.has(p.id))
      ? photos.map((p) => (p?.uri === INLINE_ELSEWHERE && p.id && mine.has(p.id) ? { ...p, uri: mine.get(p.id) } : p))
      : null
  );
}

/** The same for a batch of records against what this device holds. */
export function keepLocalPhotos<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map(local.map((x) => [x.id, x]));
  return remote.map((r) => photosFromCloud(byId.get(r.id), r));
}

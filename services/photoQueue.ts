// ===================================
// The deferred photo queue — what keeps evidence off the satellite bill.
//
// An inspection record is a few hundred bytes and goes up the moment it is
// signed; its photographs are a few hundred kilobytes each and wait here until
// the connection is worth spending. That asymmetry is the whole design: the
// vessel's compliance data is current within seconds, while the pictures ride
// along later, in port, over somebody's Wi-Fi.
//
// WHY A PERSISTED QUEUE AND NOT "UPLOAD WHEN ONLINE". Because the round happens
// at sea and the app gets killed before the ship ever sees Wi-Fi. Anything held
// in memory, and anything relying on Firebase's own retry, is gone by then —
// the same reason SyncContext force-pushes on launch. The queue survives in
// AsyncStorage and is drained days later.
//
// THE POLICY IS THE FEATURE. `wifi` (the default) is the honest setting for a
// vessel: uploads wait for an unmetered link. `always` suits a coastal boat on
// a normal SIM. `never` matches what DEM chose for itself — photos stay on the
// device and travel only in a `.msm` backup. A crew that cannot control this
// will eventually be handed a satellite bill and switch the feature off wholesale.
//
// FAILURES ARE COUNTED, NOT FATAL. An entry that keeps failing backs off and is
// eventually parked with its error rather than retried forever — a photo of a
// file that no longer exists must not block the twenty behind it.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { Attachment } from '../types/equipment';
import { Inspection } from '../types/inspection';
import { uploadPhoto } from './photoStorage';
import { uploadAllowance } from './trial';
import { addUploadsUsed, uploadsUsedFor } from './firebaseService';

export const PHOTO_QUEUE_KEY = 'msm:photo_queue';

/** How photos are allowed to leave the vessel. */
export type UploadPolicy = 'wifi' | 'always' | 'never';

export const POLICY_LABEL: Record<UploadPolicy, string> = {
  wifi: 'Wi-Fi only',
  always: 'Any connection',
  never: 'Never upload',
};

export const POLICY_HINT: Record<UploadPolicy, string> = {
  wifi: 'Photos wait for an unmetered connection — usually in port. Records still sync at once.',
  always: 'Photos upload over mobile data and satellite too. Watch the airtime bill.',
  never: 'Photos stay on this device. They still travel in a .msm backup.',
};

/** Give up after this many tries; the entry is kept with its error for the UI. */
const MAX_ATTEMPTS = 6;

export interface QueueEntry {
  /** `${inspectionId}:${photoId}` — one entry per photo, so a re-queue is a no-op. */
  id: string;
  vessel: string;
  inspectionId: string;
  photoId: string;
  localUri: string;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

export interface FlushResult {
  uploaded: number;
  remaining: number;
  /** Why nothing was sent, when nothing was. */
  skipped?: 'policy' | 'offline' | 'metered' | 'empty';
}

async function load(): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(PHOTO_QUEUE_KEY);
    const list = raw ? (JSON.parse(raw) as QueueEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function save(list: QueueEntry[]): Promise<void> {
  await AsyncStorage.setItem(PHOTO_QUEUE_KEY, JSON.stringify(list));
}

export async function pending(): Promise<QueueEntry[]> {
  return load();
}

export async function pendingCount(): Promise<number> {
  return (await load()).length;
}

/** Queue every photo of a freshly signed record. Idempotent. */
export async function enqueueInspection(vessel: string, insp: Inspection): Promise<void> {
  const photos: Attachment[] = (insp.photos ?? []).filter((p) => p.kind === 'photo');
  if (!photos.length) return;

  const list = await load();
  const known = new Set(list.map((e) => e.id));
  const now = Date.now();

  for (const p of photos) {
    const id = `${insp.id}:${p.id}`;
    if (known.has(id)) continue;
    list.push({
      id,
      vessel,
      inspectionId: insp.id,
      photoId: p.id,
      localUri: p.uri,
      queuedAt: now,
      attempts: 0,
    });
  }
  await save(list);
}

/** Is the current connection one we are willing to spend? */
async function allowed(policy: UploadPolicy): Promise<FlushResult['skipped'] | null> {
  if (policy === 'never') return 'policy';
  const state = await NetInfo.fetch();
  if (!state.isConnected) return 'offline';
  if (policy === 'always') return null;
  // `wifi`: an unmetered link. `isConnectionExpensive` is the honest signal
  // where the platform provides it — a metered hotspot is not free just because
  // it reports itself as Wi-Fi.
  const expensive = (state.details as { isConnectionExpensive?: boolean } | null)?.isConnectionExpensive;
  if (state.type === 'wifi' && expensive !== true) return null;
  if (state.type === 'ethernet') return null;
  return 'metered';
}

/**
 * Try to send what is queued. Safe to call often — on launch, on foreground,
 * after a round, from a button in Settings.
 */
export async function flush(policy: UploadPolicy): Promise<FlushResult> {
  const list = await load();
  if (!list.length) return { uploaded: 0, remaining: 0, skipped: 'empty' };

  const block = await allowed(policy);
  if (block) return { uploaded: 0, remaining: list.length, skipped: block };

  // The vessel's shared upload allowance. An unlicensed vessel gets a fixed
  // number of files in total, because every one of them is storage and egress on
  // OUR bill for a ship that has not paid. Nothing is deleted and nothing is
  // refused locally: photographs beyond the allowance stay queued, visible in
  // Settings, and go up the moment the vessel is licensed.
  let allowance = await uploadAllowance(await uploadsUsedFor(list[0].vessel));

  let uploaded = 0;
  const keep: QueueEntry[] = [];

  for (const entry of list) {
    if (entry.attempts >= MAX_ATTEMPTS) {
      keep.push(entry); // parked, visible in Settings, not retried
      continue;
    }
    if (allowance <= 0) {
      keep.push(entry); // waiting for a licence, not for a connection
      continue;
    }
    try {
      await uploadPhoto(entry.vessel, entry.inspectionId, entry.photoId, entry.localUri);
      uploaded++;
      allowance--;
    } catch (e: any) {
      keep.push({ ...entry, attempts: entry.attempts + 1, lastError: String(e?.message ?? e) });
    }
  }

  await save(keep);
  if (uploaded) await addUploadsUsed(list[0].vessel, uploaded);
  return { uploaded, remaining: keep.length };
}

/** Forget a parked entry — a photo whose file is genuinely gone. */
export async function drop(id: string): Promise<void> {
  await save((await load()).filter((e) => e.id !== id));
}

/** Give the parked entries another go (after fixing whatever was wrong). */
export async function retryAll(): Promise<void> {
  await save((await load()).map((e) => ({ ...e, attempts: 0, lastError: undefined })));
}

export async function clear(): Promise<void> {
  await AsyncStorage.removeItem(PHOTO_QUEUE_KEY);
}

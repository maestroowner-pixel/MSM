// ===================================
// Writing the vessel's signing policy — one path, used by every screen that sets it.
//
// The rule lives in two places on purpose: on THIS device, so it holds the moment
// it is set and holds offline, and on the vessel, which every other device
// listens to. The order matters — local first, then the vessel — because a rule
// that waited for a connection would be off exactly when the ship has no signal,
// which is most of the time.
//
// It was inline in SettingsSc while the rule was two switches. It stopped being
// only Settings' business when the scan rule gained per-category exceptions
// (services/signingPolicy `scanExempt`), which are set on their own screen: two
// copies of "store it, then push it, then explain a failed push" would have
// drifted, and the half that drifted would have been the error handling.
// ===================================

import { SigningPolicy } from './signingPolicy';
import { DEFAULT_ARCHIVE, PhotoArchiveState } from './photoArchive';
import * as fb from './firebaseService';

export type PolicyPatch = Partial<Omit<SigningPolicy, 'updatedAt' | 'setBy'>>;

export interface PolicyWriteResult {
  /** The rule now in force on this device — always written, whatever the vessel did. */
  policy: SigningPolicy;
  /** Set when the vessel refused or could not be reached; the local copy still holds. */
  error?: string;
}

/**
 * Apply a change to the vessel's rule.
 *
 * `updatedAt` is stamped here and nowhere else: it is the key `newerPolicy` uses
 * to settle a device's copy against the vessel's, so every writer must move it.
 */
export async function writeSigningPolicy(
  current: SigningPolicy,
  patch: PolicyPatch,
  store: (policy: SigningPolicy) => Promise<void>,
  opts: { synced: boolean; isMaster: boolean }
): Promise<PolicyWriteResult> {
  const policy: SigningPolicy = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
    setBy: opts.isMaster ? 'Master' : current.setBy,
  };
  await store(policy);
  if (!opts.synced) return { policy };
  try {
    const uid = await fb.currentVesselKey();
    if (uid) await fb.saveSigningPolicy(uid, policy);
  } catch (e: any) {
    return { policy, error: e?.message ?? String(e) };
  }
  return { policy };
}

// ---- the photo archive watermark -------------------------------------------

export type ArchivePatch = Partial<Omit<PhotoArchiveState, 'updatedAt' | 'setBy'>>;

export interface ArchiveWriteResult {
  state: PhotoArchiveState;
  error?: string;
}

/**
 * Record what the vessel has archived (services/photoArchive.ts).
 *
 * Same local-first shape as the signing rule, and the failure case matters more
 * here than anywhere else in the app: if the vessel does not take the change,
 * the local copy still holds — but the SWEEP reads the vessel's copy, so a write
 * that did not arrive simply means nothing is deleted yet. Failing safe in this
 * direction is the reason the watermark lives on the vessel and not on a device.
 */
export async function writePhotoArchive(
  current: PhotoArchiveState,
  patch: ArchivePatch,
  store: (state: PhotoArchiveState) => Promise<void>,
  opts: { synced: boolean; isMaster: boolean }
): Promise<ArchiveWriteResult> {
  const state: PhotoArchiveState = {
    ...(current ?? DEFAULT_ARCHIVE),
    ...patch,
    updatedAt: Date.now(),
    setBy: opts.isMaster ? 'Master' : current?.setBy,
  };
  await store(state);
  if (!opts.synced) return { state };
  try {
    const uid = await fb.currentVesselKey();
    if (uid) await fb.savePhotoArchive(uid, state);
  } catch (e: any) {
    return { state, error: e?.message ?? String(e) };
  }
  return { state };
}

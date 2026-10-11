// ===================================
// Automatic local snapshots — the net under the trapeze.
//
// A snapshot is taken when the app opens and kept ON THE DEVICE. It exists for
// the accidents nobody plans for: a restore of the wrong file, a reset pressed
// on a syncing device, a cloud pull that arrived wrong, a register somebody
// emptied at 0300. Every one of those is instant, and every one of them is only
// recoverable if a copy was already made BEFORE it happened — which is exactly
// what nobody remembers to do.
//
// THREE DECISIONS WORTH KEEPING:
//
// 1. NO BINARIES. The `.msm` export embeds every photo and document as base64,
//    which is right for a file the user carries away and wrong for something
//    written on every launch: a register with a few hundred photos is tens of
//    megabytes, and writing that on open would be felt. The snapshot carries the
//    RECORDS — items, certificates, inspections, crew, vessel, compressor — and
//    the attachment files stay where they already are, on disk, referenced by
//    the same uris. Restoring a snapshot therefore relinks to files that are
//    still there; it is not a substitute for a real backup taken to another
//    machine, and the UI says so.
//
// 2. NEVER OVERWRITE A GOOD SNAPSHOT WITH AN EMPTY ONE. If the app opens onto an
//    emptied register, the automatic snapshot would happily record the emptiness
//    and, with three slots, three launches would erase the last good copy. That
//    is the accident this whole file exists to survive, so an empty register is
//    refused while any slot still holds items. The same reasoning already guards
//    `pullAll` in firebaseService, and for the same reason: a recoverable glitch
//    must not be allowed to become permanent.
//
// 3. THREE SLOTS, NOT ONE. A single slot is overwritten by the next launch —
//    including the launch that follows the mistake, which is usually when the
//    mistake is noticed. Three gives a person time to notice.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as storage from './storage';
import { BackupFile, restoreBackup } from './backup';
import { VesselInfo } from './storage';

const SLOTS = 3;
/**
 * Two shelves. `launch` — the three copies taken as the app opens, rotated by
 * every launch that changed something. `import` — a copy taken just before an
 * Excel import, rotated ONLY by imports: on DreamBoat (5 Oct 2026) a register
 * replaced from Excel had its old copy pushed off the launch shelf by three days
 * of rounds, and with it the only way to link 229 inspections back.
 */
export type SnapshotKind = 'launch' | 'import';
const KEY = (i: number, kind: SnapshotKind = 'launch') => (kind === 'import' ? `msm:snapshot:import:${i}` : `msm:snapshot:${i}`);
const BACKUP_MAGIC = 'MarineSafetyManager';
const BACKUP_VERSION = 3;

export interface SnapshotInfo {
  slot: number;
  kind: SnapshotKind;
  /** For an import copy: what was being imported. */
  note?: string;
  at: number;
  items: number;
  certificates: number;
  inspections: number;
  crew: number;
  bytes: number;
}

function countItems(b: BackupFile): number {
  return Object.values(b.categories ?? {}).reduce((n, list) => n + (list?.length ?? 0), 0);
}

/** Build the snapshot body: everything the `.msm` carries except the binaries. */
async function collect(vessel: VesselInfo | null): Promise<BackupFile> {
  return {
    app: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    vessel: vessel ?? (await storage.loadVessel()),
    // Including buckets this build cannot name — see storage.loadAllWithForeign.
    categories: await storage.loadAllWithForeign(),
    certificates: await storage.loadCertificates(),
    compressor: await storage.loadCompressor(),
    inspections: await storage.loadInspections(),
    crew: await storage.loadCrew(),
    files: {},
  };
}

async function read(slot: number, kind: SnapshotKind = 'launch'): Promise<BackupFile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY(slot, kind));
    if (!raw) return null;
    const b = JSON.parse(raw) as BackupFile;
    return b && b.app === BACKUP_MAGIC && b.categories ? b : null;
  } catch {
    return null;
  }
}

/** Newest first. Slot 0 is always the newest. `kind` picks the shelf (launch by default). */
export async function listSnapshots(kind: SnapshotKind = 'launch'): Promise<SnapshotInfo[]> {
  const out: SnapshotInfo[] = [];
  for (let i = 0; i < SLOTS; i++) {
    const raw = await AsyncStorage.getItem(KEY(i, kind)).catch(() => null);
    if (!raw) continue;
    const b = await read(i, kind);
    if (!b) continue;
    out.push({
      slot: i,
      kind,
      ...((b as any).note ? { note: (b as any).note } : {}),
      at: b.exportedAt,
      items: countItems(b),
      certificates: b.certificates?.length ?? 0,
      inspections: b.inspections?.length ?? 0,
      crew: b.crew?.length ?? 0,
      bytes: raw.length,
    });
  }
  return out;
}

/**
 * Take a snapshot if it is worth taking.
 *
 * Returns what happened, so the caller can log it and a test can assert it.
 * Skips silently when there is nothing new to record — a launch that changes
 * nothing should not push a good older copy one slot further towards deletion.
 */
export async function takeSnapshot(
  vessel: VesselInfo | null
): Promise<'saved' | 'unchanged' | 'refused-empty' | 'nothing-to-save' | 'failed'> {
  try {
    const fresh = await collect(vessel);
    const items = countItems(fresh);
    const trail = fresh.inspections?.length ?? 0;

    // An empty device with no history has nothing to protect yet.
    if (items === 0 && trail === 0 && (fresh.certificates?.length ?? 0) === 0) {
      const existing = await listSnapshots();
      if (!existing.length) return 'nothing-to-save';
      // …but if we HAVE saved something before, an empty register is the very
      // accident this file exists for. Keep what we have.
      return 'refused-empty';
    }

    const newest = await read(0);
    if (newest) {
      // Compare everything except the timestamp, which always differs.
      const a = JSON.stringify({ ...newest, exportedAt: 0 });
      const b = JSON.stringify({ ...fresh, exportedAt: 0 });
      if (a === b) return 'unchanged';
      // Losing items is not automatically wrong — things get deleted on purpose —
      // but going to ZERO while a good copy exists is the failure mode, not an edit.
      if (items === 0 && countItems(newest) > 0) return 'refused-empty';
    }

    // Rotate: 1 -> 2, 0 -> 1, then write the new 0.
    for (let i = SLOTS - 1; i > 0; i--) {
      const prev = await AsyncStorage.getItem(KEY(i - 1)).catch(() => null);
      if (prev) await AsyncStorage.setItem(KEY(i), prev);
    }
    await AsyncStorage.setItem(KEY(0), JSON.stringify(fresh));
    return 'saved';
  } catch (e: any) {
    // A snapshot is a safety net, never a reason to stop the app starting.
    console.warn('[snapshot] not taken:', e?.message ?? e);
    return 'failed';
  }
}

/** Put a snapshot back. Same path as restoring a `.msm`, minus the binaries. */
export async function restoreSnapshot(slot: number, kind: SnapshotKind = 'launch'): Promise<SnapshotInfo> {
  const b = await read(slot, kind);
  if (!b) throw new Error('That snapshot is no longer on this device.');
  await restoreBackup(b);
  return {
    slot,
    kind,
    at: b.exportedAt,
    items: countItems(b),
    certificates: b.certificates?.length ?? 0,
    inspections: b.inspections?.length ?? 0,
    crew: b.crew?.length ?? 0,
    bytes: 0,
  };
}

/**
 * The copy taken right before an Excel import, on its own shelf. Always saved
 * when there is a register to protect — even if unchanged since launch, since
 * this is the copy that must outlive the days after the import.
 */
export async function takeImportSnapshot(vessel: VesselInfo | null, note: string): Promise<'saved' | 'nothing-to-save' | 'failed'> {
  try {
    const fresh = { ...(await collect(vessel)), note } as BackupFile & { note: string };
    if (countItems(fresh) === 0) return 'nothing-to-save';
    for (let i = SLOTS - 1; i > 0; i--) {
      const prev = await AsyncStorage.getItem(KEY(i - 1, 'import')).catch(() => null);
      if (prev) await AsyncStorage.setItem(KEY(i, 'import'), prev);
    }
    await AsyncStorage.setItem(KEY(0, 'import'), JSON.stringify(fresh));
    return 'saved';
  } catch (e: any) {
    console.warn('[snapshot] import copy not taken:', e?.message ?? e);
    return 'failed';
  }
}

/** A copy's records as a backup file body — to save it off the device without rolling back to it. */
export async function snapshotBody(slot: number, kind: SnapshotKind = 'launch'): Promise<BackupFile> {
  const b = await read(slot, kind);
  if (!b) throw new Error('That copy is no longer on this device.');
  return b;
}

/** Used by "Reset all data": a wipe must not leave the old register recoverable. */
export async function clearSnapshots(): Promise<void> {
  for (let i = 0; i < SLOTS; i++) {
    await AsyncStorage.removeItem(KEY(i)).catch(() => {});
    await AsyncStorage.removeItem(KEY(i, 'import')).catch(() => {});
  }
}

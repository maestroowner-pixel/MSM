// ===================================
// Photo retention — what the vessel keeps in the cloud, and what it keeps itself.
//
// THE RULE. Cloud Storage holds inspection photographs for **90 days**. Older
// ones are swept out by a scheduled function (`functions/index.js sweepPhotos`)
// and live on only in the vessel's own archive — a ZIP per calendar month that a
// Master saves wherever the ship keeps its files.
//
// WHY THERE IS A GATE. A photograph is evidence for a signed record, and after a
// sweep the only copies left are the archive and whatever devices happen to hold
// locally. So nothing is ever deleted merely for being old: the sweep removes a
// photo only when it is BOTH older than the window AND inside a period the
// Master has said is archived (`archivedThrough`). A vessel that never archives
// keeps everything — its bucket grows, which is a bill; the alternative is
// deleting evidence nobody has a copy of, which is not a trade to make. The app
// asks for the archive instead of assuming it.
//
// WHY WHOLE MONTHS. Partly because a surveyor asks "where are September's
// photos" and not "where is the photo from the 14th", and partly because a
// browser cannot hold a year of JPEGs in memory to zip them: a month is one file
// of tens of megabytes, which the office PC can save in port and a phone can
// usually manage too.
//
// WHAT IS NOT DELETED, ANYWHERE. The local copies. The device that took a photo
// keeps the original, and a device that once viewed somebody else's keeps the
// fetched copy in `attachments/`. After a sweep those are real copies of
// evidence, not a cache, so nothing in the app clears them.
//
// Pure: no storage, no React Native, no Firebase — scripts/check-inspections.ts
// runs it. The bytes-and-zip half is services/photoArchiveExport.ts.
// ===================================

import { Inspection } from '../types/inspection';

/** How long a photograph stays in the vessel's cloud storage. */
export const RETENTION_DAYS = 90;

const DAY_MS = 86_400_000;

/**
 * What this vessel has archived, and what the last sweep did.
 *
 * Mirrored between the vessel document (`photoArchive`) and this device
 * (`msm:photo_archive`) exactly like the signing policy, and settled the same
 * way — the newer `updatedAt` wins — so a Master who marks a month archived at
 * sea does not lose it to an older copy coming back from the vessel.
 */
export interface PhotoArchiveState {
  /**
   * Photographs signed up to this moment are in the vessel's own archive.
   * Set by a Master when the month's ZIP has been saved; it is the permission
   * the sweep runs on. Absent = nothing archived yet, so nothing may be swept.
   */
  archivedThrough?: number;
  /** Who said so ("Master"), for the next person reading the screen. */
  setBy?: string;
  /** Stamped by the sweep itself (server side) — shown, never acted on. */
  lastSweepAt?: number;
  lastSweepDeleted?: number;
  /**
   * How far the sweep has already looked (server side).
   *
   * Written only by the job, so that each night reads the new band instead of
   * every record ever signed. The app carries it through untouched — a device
   * that writes an older copy back only makes the next sweep re-check a period
   * it has already cleared, which costs a little and breaks nothing.
   */
  sweptThrough?: number;
  /** Epoch ms. The newer copy wins between a device and the vessel. */
  updatedAt: number;
}

export const DEFAULT_ARCHIVE: PhotoArchiveState = { updatedAt: 0 };

/** The newer of two copies — a device's and the vessel's. Mirrors `newerPolicy`. */
export function newerArchive(
  a: PhotoArchiveState | null | undefined,
  b: PhotoArchiveState | null | undefined
): PhotoArchiveState {
  if (!a) return b ?? DEFAULT_ARCHIVE;
  if (!b) return a;
  return (b.updatedAt ?? 0) > (a.updatedAt ?? 0) ? b : a;
}

/** The moment before which a photograph is out of the cloud window. */
export function retentionCutoff(now: number = Date.now()): number {
  return now - RETENTION_DAYS * DAY_MS;
}

/**
 * What the sweep is allowed to remove: old enough AND archived.
 *
 * The whole safety property of this feature is this one `Math.min`. Returns 0
 * when nothing has been archived, and 0 means "delete nothing" — never "delete
 * everything", which is the mistake this shape exists to make impossible.
 */
export function sweepCutoff(state: PhotoArchiveState | null | undefined, now: number = Date.now()): number {
  const archived = state?.archivedThrough ?? 0;
  if (archived <= 0) return 0;
  return Math.min(archived, retentionCutoff(now));
}

/** Is this record's evidence gone from the cloud — and therefore archive-only? */
export function isArchived(
  insp: Pick<Inspection, 'at'>,
  state: PhotoArchiveState | null | undefined,
  now: number = Date.now()
): boolean {
  const cutoff = sweepCutoff(state, now);
  return cutoff > 0 && insp.at < cutoff;
}

// ---- Months ----------------------------------------------------------------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface ArchiveMonth {
  /** `2026-09` — sorts correctly as a string, and names the ZIP. */
  key: string;
  /** "September 2026" — what the screen and the confirmation say. */
  label: string;
  /** Local-time month bounds, `[from, to)`. */
  from: number;
  to: number;
  photos: number;
  inspections: number;
  /** Rough size, for the button. Photos carry no stored size — see below. */
  approxBytes: number;
}

/**
 * A downscaled inspection photo is 200–450 KB (services/images.ts), and an
 * Attachment does not store its size. 350 KB is the middle of that range: enough
 * to tell "about 50 MB" from "about half a gigabyte", which is all the number on
 * the button is for. It is labelled as approximate wherever it is shown.
 */
export const APPROX_PHOTO_BYTES = 350 * 1024;

function monthKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(at: number): { from: number; to: number; label: string } {
  const d = new Date(at);
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { from: from.getTime(), to: to.getTime(), label: `${MONTHS[from.getMonth()]} ${from.getFullYear()}` };
}

/** Records that carry photographs, in the local month containing `at`. */
export function photosInMonth(trail: Inspection[], from: number, to: number): Inspection[] {
  return trail
    .filter((i) => i.at >= from && i.at < to && (i.photos?.length ?? 0) > 0)
    .sort((a, b) => a.at - b.at);
}

/**
 * The months this vessel still owes an archive for, oldest first.
 *
 * A month qualifies when it is COMPLETELY past the retention window — its last
 * day is older than 90 days — so an archive, once saved, never needs to be saved
 * again for the same month. Months already covered by `archivedThrough` are not
 * offered, and neither are months with no photographs at all: an empty ZIP tells
 * nobody anything.
 */
export function monthsToArchive(
  trail: Inspection[],
  state: PhotoArchiveState | null | undefined,
  now: number = Date.now()
): ArchiveMonth[] {
  const cutoff = retentionCutoff(now);
  const archived = state?.archivedThrough ?? 0;
  const byKey = new Map<string, ArchiveMonth>();

  for (const insp of trail) {
    const photos = insp.photos?.length ?? 0;
    if (!photos) continue;
    const key = monthKey(insp.at);
    const { from, to, label } = monthBounds(insp.at);
    // The whole month must be out of the window, and not already archived.
    if (to > cutoff) continue;
    if (to <= archived) continue;
    const row = byKey.get(key) ?? { key, label, from, to, photos: 0, inspections: 0, approxBytes: 0 };
    row.photos += photos;
    row.inspections += 1;
    row.approxBytes = row.photos * APPROX_PHOTO_BYTES;
    byKey.set(key, row);
  }

  return [...byKey.values()].sort((a, b) => a.from - b.from);
}

/**
 * How many photographs are still inside the cloud window — what the vessel is
 * paying for right now, and the number that makes the screen's promise checkable.
 */
export function photosInWindow(trail: Inspection[], now: number = Date.now()): number {
  const cutoff = retentionCutoff(now);
  return trail.reduce((n, i) => n + (i.at >= cutoff ? i.photos?.length ?? 0 : 0), 0);
}

/**
 * Photographs older than the window that are NOT yet archived — the ones with
 * one copy in the cloud, one on whichever device took them, and no third.
 * This is the number the reminder counts.
 */
export function photosAwaitingArchive(
  trail: Inspection[],
  state: PhotoArchiveState | null | undefined,
  now: number = Date.now()
): number {
  return monthsToArchive(trail, state, now).reduce((n, m) => n + m.photos, 0);
}

/** `MSM_photos_2026-09_IMO9123456.zip` — names itself in whatever folder it lands. */
export function archiveFileName(month: ArchiveMonth, imo?: string | null): string {
  const yard = (imo ?? '').replace(/\D/g, '');
  return `MSM_photos_${month.key}${yard ? `_IMO${yard}` : ''}.zip`;
}

/**
 * The moment `archivedThrough` moves to when a month's ZIP has been saved.
 *
 * Never backwards: a Master who saves September and then, out of curiosity,
 * re-saves July must not hand the sweep permission to delete August as well —
 * `archivedThrough` is a watermark, not a cursor.
 */
export function archivedThroughFor(month: ArchiveMonth, state?: PhotoArchiveState | null): number {
  return Math.max(month.to, state?.archivedThrough ?? 0);
}

/**
 * May this month be marked archived yet?
 *
 * Only the OLDEST outstanding one, because `archivedThrough` is a single moment:
 * marking October while September is still unsaved would tell the sweep that
 * September is safe to delete, and it is not. So the months are archived in
 * order, which is also the order anybody would do it in.
 */
export function canMarkArchived(months: ArchiveMonth[], month: ArchiveMonth): boolean {
  return months.length > 0 && months[0].key === month.key;
}

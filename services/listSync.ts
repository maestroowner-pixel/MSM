// ===================================
// Where a synced list's pull starts — pure, so check:listsync can hold it.
//
// `updatedAt` is written when a record is made, not when it reaches the vessel:
// a record made offline, or a log's history sent for the first time, goes up
// behind the mark of every device that has pulled since, and asking only for
// what is newer never finds it (seen live on the test vessel, 5 Nov 2026). So
// once a day the whole list is read. Merging by id, newest updatedAt, makes
// reading a record again harmless.
// ===================================

export const FULL_PULL_MS = 86_400_000;

export function pullWindow(now: number, pulledAt: number, fullAt: number, cutoff: number): { since: number; full: boolean } {
  const full = now - fullAt >= FULL_PULL_MS;
  return { since: Math.max(full ? 0 : pulledAt, cutoff), full };
}

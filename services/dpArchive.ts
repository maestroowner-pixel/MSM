// ===================================
// DP checklists older than a device keeps (firebaseService DP_KEEP_DAYS): read
// from the cloud when asked for, held here for the session only — opened and
// printed like any other, never stored on the device.
// ===================================

import { DpCheck } from '../types/dp';
import { DP_KEEP_DAYS, olderRecords } from './firebaseService';

const held = new Map<string, DpCheck>();

export const archived = (id?: string) => (id ? held.get(id) : undefined);

/** The next page of older checklists, newest first, before `before` (ms; default: the cutoff). */
export async function loadOlder(before = Date.now() - DP_KEEP_DAYS * 86_400_000): Promise<DpCheck[]> {
  const page = await olderRecords<DpCheck>('dp_checks', before);
  for (const c of page) held.set(c.id, c);
  return page;
}

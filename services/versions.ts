// ===================================
// Record versions — how a signed log entry is changed or deleted (10–11 Oct
// 2026: "edit with the reason and the signature of whoever edited it; only
// the Master; the same in every log").
//
// Nothing is overwritten. A change is a NEW record that `supersedes` the old
// one, carrying `editReason` and who signed it; a deletion is such a version
// marked `cancelled`. The book shows the latest version of each record — the
// cancelled ones struck through — and everything that counts (totals, who is
// on board, last check) reads only the live ones.
// ===================================

import type { SignProof } from './signature';

export interface Versioned {
  id: string;
  supersedes?: string;
  cancelled?: boolean;
  editReason?: string;
  editedBy?: string;
  editedByRank?: string;
  editedAt?: number;
  editedWith?: SignProof;
}

/** The latest version of every record (cancelled ones included, to be shown struck through). */
export function current<T extends Versioned>(list: T[]): T[] {
  const replaced = new Set(list.map((r) => r.supersedes).filter(Boolean) as string[]);
  return list.filter((r) => !replaced.has(r.id));
}

/** What counts: the latest versions, without the cancelled ones. */
export function live<T extends Versioned>(list: T[]): T[] {
  return current(list).filter((r) => !r.cancelled);
}

/** Earlier versions of a record, newest first. */
export function previous<T extends Versioned>(list: T[], r: T): T[] {
  const byId = new Map(list.map((x) => [x.id, x]));
  const out: T[] = [];
  let id = r.supersedes;
  while (id && byId.has(id) && out.length < 50) {
    const p = byId.get(id)!;
    out.push(p);
    id = p.supersedes;
  }
  return out;
}

/** A new version of `r` with `changes`, signed by the editor. */
export function amended<T extends Versioned>(r: T, changes: Partial<T>, newId: string, reason: string, by: { name: string; rank?: string; proof?: SignProof }, at = Date.now()): T {
  return {
    ...r,
    ...changes,
    id: newId,
    supersedes: r.id,
    editReason: reason,
    editedBy: by.name,
    ...(by.rank ? { editedByRank: by.rank } : {}),
    editedAt: at,
    ...(by.proof ? { editedWith: by.proof } : {}),
    updatedAt: at,
  } as T;
}

/** A cancelling version of `r`. */
export function cancelled<T extends Versioned>(r: T, newId: string, reason: string, by: { name: string; rank?: string; proof?: SignProof }, at = Date.now()): T {
  return { ...amended(r, {} as Partial<T>, newId, reason, by, at), cancelled: true };
}

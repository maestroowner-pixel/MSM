// ===================================
// A record filled in and left for someone to sign (5 Nov 2026): on a shared tablet,
// say, for the officer to open on their own device and sign there. Kept apart from
// the signed books on purpose. Those are append-only and their copies on older
// builds would read a draft as a signed entry, so the signed record is still made
// once, at the signature, and this one is then marked done.
// ===================================

export type SignDraftKind = 'watch' | 'check' | 'toolbox';

export interface SignDraft {
  id: string;
  kind: SignDraftKind;
  /** What the Board calls it: the checklist's or the round's own name. */
  title: string;
  /** The engine room template, the checklist template, or the permit. */
  refId: string;
  /** What was filled in, as the form holds it. */
  data: Record<string, any>;
  at: number;
  /** Signed, or dropped: the list syncs as a union, so nothing is removed. */
  done?: boolean;
  updatedAt: number;
}

export const liveDrafts = (list: SignDraft[] | undefined) => (list ?? []).filter((d) => !d.done);

/** Firestore takes no `undefined`, and a form's state may hold it. */
export const draftData = (o: Record<string, any>): Record<string, any> => JSON.parse(JSON.stringify(o));

/** Where the Board sends the officer to sign it. */
export function draftRoute(d: Pick<SignDraft, 'id' | 'kind' | 'refId'>): { route: string; params: Record<string, unknown> } {
  if (d.kind === 'watch') return { route: 'WatchEntry', params: { templateId: d.refId, signDraft: d.id } };
  if (d.kind === 'check') return { route: 'DpCheck', params: { templateId: d.refId, signDraft: d.id } };
  return { route: 'Permit', params: { id: d.refId, signDraft: d.id } };
}

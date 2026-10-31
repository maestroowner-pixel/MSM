// ===================================
// Requisitions through the Master and the office (plan item 35, flag poApproval).
// Pure functions, no side effects.
//
// How it goes aboard a managed vessel: an officer raises the requisition, the
// Master approves sending it to the office, and the office decides — on whether
// it is needed, not on its price: a cheap order nobody needs is cut, a dear one
// that matters is approved. Only then is it placed with the supplier.
//
// The way is kept as append-only STEPS on the order (`approval`), and the stage
// is read from them; `status` (draft → sent → partial → received) is untouched,
// so a 2.69 device that does not know any of this still reads the order right.
//
//   submit        an officer → the Master
//   master        the Master approves → the office          "Sent to the office"
//   masterReturn  the Master returns it to the officer, with the reason
//   review        the office opened it                      "Under review"
//   approve       the office approves; lines may be cut      "Approved by the office"
//   return        the office returns it for rework, with the reason
//   reject        the office rejects it, with the reason
//   ordered       the office placed it itself (status → sent) "In work"
//   emergency     the Master sends it to the supplier at once, with the reason;
//                 the office approves or rejects it afterwards
//
// A return starts a new round: the officer edits and submits again. The office
// cuts a line by changing its quantity (0 = struck out) with the reason; the
// line keeps what was asked (`cut`), so the order shows what was taken out.
// ===================================

import type { OrderLine, PoCut, PoStep, PoStepKind, PurchaseOrder } from '../types/orders';

export type PoStage = 'draft' | 'master' | 'office' | 'review' | 'approved' | 'rejected' | 'returned' | 'inWork' | 'partial' | 'delivered' | 'cancelled';

export const VESSEL_STEPS: PoStepKind[] = ['submit', 'master', 'masterReturn', 'emergency'];
export const OFFICE_STEPS: PoStepKind[] = ['review', 'approve', 'return', 'reject', 'ordered'];
/** Steps that need a reason (rules: ≥ 3 characters). */
export const NEEDS_NOTE: PoStepKind[] = ['masterReturn', 'emergency', 'return', 'reject'];

const steps = (o: Pick<PurchaseOrder, 'approval'>): PoStep[] => o.approval ?? [];
const last = (o: Pick<PurchaseOrder, 'approval'>): PoStep | undefined => steps(o)[steps(o).length - 1];

/** The current round: the steps since the last return (the officer's next try). */
export function round(o: Pick<PurchaseOrder, 'approval'>): PoStep[] {
  const s = steps(o);
  let i = s.length;
  while (i > 0 && s[i - 1].kind !== 'return' && s[i - 1].kind !== 'masterReturn') i -= 1;
  return s.slice(i);
}

export function poStage(o: Pick<PurchaseOrder, 'status' | 'approval'>): PoStage {
  if (o.status === 'cancelled') return 'cancelled';
  if (o.status === 'received') return 'delivered';
  if (o.status === 'partial') return 'partial';
  if (o.status === 'sent') return 'inWork';
  switch (last(o)?.kind) {
    case 'submit': return 'master';
    case 'master': return 'office';
    case 'review': return 'review';
    case 'approve': return 'approved';
    case 'reject': return 'rejected';
    case 'return':
    case 'masterReturn': return 'returned';
    default: return 'draft';
  }
}

/** With the flag on, an order goes to the supplier only once the office approved it (or the Master sent it as an emergency). */
export function mayOrder(o: Pick<PurchaseOrder, 'status' | 'approval'>): boolean {
  const s = poStage(o);
  return s === 'approved' || s === 'inWork' || s === 'partial' || s === 'delivered';
}

/** Lines may be changed aboard only before the Master sends it on, or after it came back. */
export function linesEditable(o: Pick<PurchaseOrder, 'status' | 'approval'>): boolean {
  const s = poStage(o);
  return s === 'draft' || s === 'returned' || s === 'master';
}

/** Sent to the supplier without the office and not yet answered by it. */
export function emergencyOpen(o: Pick<PurchaseOrder, 'approval'>): boolean {
  const s = steps(o);
  const e = s.map((x) => x.kind).lastIndexOf('emergency');
  return e >= 0 && !s.slice(e + 1).some((x) => x.kind === 'approve' || x.kind === 'reject');
}

/** The office rejected an order already sent as an emergency. */
export function emergencyRejected(o: Pick<PurchaseOrder, 'approval'>): boolean {
  const s = steps(o);
  const e = s.map((x) => x.kind).lastIndexOf('emergency');
  return e >= 0 && s.slice(e + 1).some((x) => x.kind === 'reject');
}

/** What waits for the office: sent to it (not yet decided), and emergencies to look at afterwards — oldest first. */
export function officeQueue(orders: PurchaseOrder[]): PurchaseOrder[] {
  const since = (o: PurchaseOrder) => round(o).find((x) => x.kind === 'master' || x.kind === 'emergency')?.at ?? o.at;
  return orders
    .filter((o) => !o.deleted && o.status !== 'cancelled' && ((['office', 'review'] as PoStage[]).includes(poStage(o)) || emergencyOpen(o)))
    .sort((a, b) => since(a) - since(b));
}

/** Approved by the office and not yet placed with the supplier. */
export function approvedNotPlaced(orders: PurchaseOrder[]): PurchaseOrder[] {
  return orders.filter((o) => !o.deleted && poStage(o) === 'approved');
}

// ---- steps ------------------------------------------------------------------

export interface Who {
  name: string;
  rank?: string;
}

function step(kind: PoStepKind, by: Who, now: number, note?: string, cuts?: PoCut[]): PoStep {
  if (NEEDS_NOTE.includes(kind) && (note ?? '').trim().length < 3) throw new Error('A reason is required');
  return {
    kind,
    by: by.name,
    ...(by.rank ? { byRank: by.rank } : {}),
    at: now,
    ...(note?.trim() ? { note: note.trim() } : {}),
    ...(cuts?.length ? { cuts } : {}),
  };
}

const push = (o: PurchaseOrder, s: PoStep): PurchaseOrder => ({ ...o, approval: [...steps(o), s], updatedAt: s.at });

/** Which vessel step the stage allows: `master` from draft too — a Master raising it sends it straight on. */
const ALLOWED: Record<PoStepKind, PoStage[]> = {
  submit: ['draft', 'returned'],
  master: ['draft', 'returned', 'master'],
  masterReturn: ['master'],
  emergency: ['draft', 'returned', 'master', 'office', 'review', 'approved', 'rejected'],
  review: ['office'],
  approve: ['office', 'review'],
  return: ['office', 'review'],
  reject: ['office', 'review'],
  ordered: ['approved'],
};

function guard(o: PurchaseOrder, kind: PoStepKind) {
  if (!ALLOWED[kind].includes(poStage(o))) throw new Error(`Not now: ${kind} at ${poStage(o)}`);
}

export function submit(o: PurchaseOrder, by: Who, now: number, note?: string): PurchaseOrder {
  guard(o, 'submit');
  return push(o, step('submit', by, now, note));
}

export function masterApprove(o: PurchaseOrder, by: Who, now: number, note?: string): PurchaseOrder {
  guard(o, 'master');
  return push(o, step('master', by, now, note));
}

export function masterReturn(o: PurchaseOrder, by: Who, note: string, now: number): PurchaseOrder {
  guard(o, 'masterReturn');
  return push(o, step('masterReturn', by, now, note));
}

/** The Master sends it to the supplier at once — status sent, the office answers afterwards. */
export function emergencySend(o: PurchaseOrder, by: Who, note: string, now: number, today: string): PurchaseOrder {
  guard(o, 'emergency');
  if (o.urgency !== 'emergency') throw new Error('Only an emergency order');
  const n = push(o, step('emergency', by, now, note));
  return { ...n, status: 'sent', sentAt: o.sentAt ?? today, sentBy: o.sentBy ?? by.name };
}

/** The office opened it — recorded once, so the vessel sees it is being looked at. */
export function markReview(o: PurchaseOrder, by: Who, now: number): PurchaseOrder {
  return poStage(o) === 'office' ? push(o, step('review', by, now)) : o;
}

/**
 * The office approves; `qty` gives a new quantity per line id (0 = struck out),
 * each change with its reason. An emergency already sent is approved the same way,
 * but its lines are no longer cut — it has been ordered.
 */
export function officeApprove(o: PurchaseOrder, by: Who, now: number, note = '', qty: Record<string, { to: number; note: string }> = {}): PurchaseOrder {
  const late = emergencyOpen(o);
  if (!late) guard(o, 'approve');
  const cuts: PoCut[] = [];
  const lines: OrderLine[] = o.lines.map((l) => {
    const c = late ? undefined : qty[l.id];
    if (!c || c.to === l.qty) return l;
    if (!(c.to >= 0) || c.to > l.qty) throw new Error('The office can only reduce a quantity');
    if (c.note.trim().length < 3) throw new Error('A reason is required for each line changed');
    cuts.push({ lineId: l.id, from: l.qty, to: c.to, note: c.note.trim() });
    return { ...l, qty: c.to, cut: { asked: l.cut?.asked ?? l.qty, note: c.note.trim(), by: by.name } };
  });
  if (lines.length && lines.every((l) => l.qty === 0)) throw new Error('Every line struck out — reject it instead');
  return { ...push(o, step('approve', by, now, note, cuts)), lines };
}

export function officeReturn(o: PurchaseOrder, by: Who, note: string, now: number): PurchaseOrder {
  guard(o, 'return');
  return push(o, step('return', by, now, note));
}

export function officeReject(o: PurchaseOrder, by: Who, note: string, now: number): PurchaseOrder {
  if (!emergencyOpen(o)) guard(o, 'reject');
  return push(o, step('reject', by, now, note));
}

/** The office placed the order with the supplier itself. */
export function officeOrdered(o: PurchaseOrder, by: Who, now: number, today: string, note?: string): PurchaseOrder {
  guard(o, 'ordered');
  return { ...push(o, step('ordered', by, now, note)), status: 'sent', sentAt: o.sentAt ?? today, sentBy: o.sentBy ?? by.name };
}

// ---- the progress line ----------------------------------------------------------

export type MileKey = 'sent' | 'review' | 'approved' | 'inWork' | 'delivered';
export interface Mile {
  key: MileKey;
  state: 'done' | 'now' | 'todo' | 'bad';
  /** Epoch ms or yyyy-mm-dd. */
  at?: number | string;
  by?: string;
  note?: string;
}

/**
 * Sent to the office → Under review → Approved by the office → In work → Delivered,
 * for the current round. A rejection shows as a bad "approved" step; an emergency
 * shows "sent" as the Master's send and the office's steps when they come.
 */
export function progress(o: PurchaseOrder): Mile[] {
  const r = round(o);
  const find = (...k: PoStepKind[]) => [...r].reverse().find((x) => k.includes(x.kind));
  const sent = find('master', 'emergency');
  const review = find('review');
  const decided = find('approve', 'reject');
  const ordered = find('ordered');
  const stage = poStage(o);
  const who = (s?: PoStep) => (s ? (s.byRank ? `${s.by} (${s.byRank})` : s.by) : undefined);
  const delivered = o.status === 'received';
  const inWork = o.status === 'sent' || o.status === 'partial' || delivered;
  const miles: Mile[] = [
    { key: 'sent', state: sent ? 'done' : stage === 'master' ? 'now' : 'todo', at: sent?.at, by: who(sent), note: sent?.kind === 'emergency' ? sent.note : undefined },
    { key: 'review', state: review || decided ? 'done' : sent && !inWork ? 'now' : 'todo', at: review?.at ?? decided?.at, by: who(review ?? decided) },
    { key: 'approved', state: decided?.kind === 'reject' ? 'bad' : decided ? 'done' : 'todo', at: decided?.at, by: who(decided), note: decided?.note },
    { key: 'inWork', state: inWork ? (o.status === 'sent' ? 'now' : 'done') : 'todo', at: o.sentAt, by: ordered ? who(ordered) : o.sentBy },
    { key: 'delivered', state: delivered ? 'done' : o.status === 'partial' ? 'now' : 'todo', at: o.receivedAt ?? o.deliveries?.[o.deliveries.length - 1]?.date, by: o.receivedBy },
  ];
  return miles;
}

/** The latest reason the order came back to the officer (Master's or office's). */
export function returnedBy(o: Pick<PurchaseOrder, 'approval' | 'status'>): PoStep | undefined {
  const l = last(o);
  return poStage(o) === 'returned' && l ? l : undefined;
}

/** The office's cuts in the last approval. */
export function lastCuts(o: Pick<PurchaseOrder, 'approval'>): PoCut[] {
  return [...steps(o)].reverse().find((x) => x.kind === 'approve')?.cuts ?? [];
}

/** For the Fleet card: waiting for the office, emergencies to answer, since when the oldest waits (epoch ms). */
export function poSummary(orders: PurchaseOrder[]): { waiting: number; emergency: number; oldest?: number } {
  const q = officeQueue(orders);
  const emergency = q.filter(emergencyOpen).length;
  const first = q[0] ? round(q[0]).find((x) => x.kind === 'master' || x.kind === 'emergency')?.at : undefined;
  return { waiting: q.length - emergency, emergency, ...(first ? { oldest: first } : {}) };
}

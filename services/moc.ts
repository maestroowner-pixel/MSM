// ===================================
// Management of Change (types/moc.ts, plan item 38) — the pure part: the number,
// the stage read from the steps, who may take which step, what an approval and
// a closure need, and what waits for the office. Tested by `npm run check:moc`.
//
//   draft / returned  →  submit  →  master  ─┬→ (office in the loop) office → approved
//                                            └→ approved
//   the Master: master | masterReturn | reject      the office: office | officeReturn | reject
//   before approval: cancel (aboard)                 approved: close (the Master, signed)
//
// The Master raising it approves it straight away (no submit to himself).
// ===================================

import { ManagementOfChange, MocAction, MocStep, MocStepKind } from '../types/moc';
import { RiskAssessment } from '../types/permits';
import { IsmDoc } from '../types/docs';

export type MocStage = 'draft' | 'master' | 'office' | 'approved' | 'returned' | 'rejected' | 'cancelled' | 'closed';

/** Steps that need a reason (rules: ≥ 3 characters). */
export const MOC_NEEDS_NOTE: MocStepKind[] = ['masterReturn', 'officeReturn', 'reject', 'cancel', 'close'];
/** The Master's steps aboard; an officer only submits and cancels. */
export const MOC_MASTER_STEPS: MocStepKind[] = ['master', 'masterReturn', 'reject', 'cancel', 'close'];
export const MOC_OFFICER_STEPS: MocStepKind[] = ['submit', 'cancel'];
export const MOC_OFFICE_STEPS: MocStepKind[] = ['office', 'officeReturn', 'reject'];
/** After these nothing changes. */
export const MOC_FINAL: MocStepKind[] = ['reject', 'cancel', 'close'];

const last = (m: Pick<ManagementOfChange, 'steps'>): MocStep | undefined => m.steps[m.steps.length - 1];

export function mocStage(m: Pick<ManagementOfChange, 'steps' | 'needsOffice'>): MocStage {
  const s = last(m);
  switch (s?.kind) {
    case 'submit': return 'master';
    case 'master': return m.needsOffice ? 'office' : 'approved';
    case 'office': return 'approved';
    case 'masterReturn':
    case 'officeReturn': return 'returned';
    case 'reject': return 'rejected';
    case 'cancel': return 'cancelled';
    case 'close': return 'closed';
    default: return 'draft';
  }
}

export const mocFinal = (m: Pick<ManagementOfChange, 'steps'>): boolean => MOC_FINAL.includes(last(m)?.kind as MocStepKind);

/** Which steps the stage allows next. */
export function nextSteps(stage: MocStage): MocStepKind[] {
  switch (stage) {
    case 'draft':
    case 'returned': return ['submit', 'master', 'cancel'];
    case 'master': return ['master', 'masterReturn', 'reject', 'cancel'];
    case 'office': return ['office', 'officeReturn', 'reject'];
    case 'approved': return ['close'];
    default: return [];
  }
}

/** The change, why and the documents are written before the Master approves it; after that only the actions move. */
export const mocEditable = (m: Pick<ManagementOfChange, 'steps' | 'needsOffice'>): boolean => ['draft', 'returned', 'master'].includes(mocStage(m));

/** MOC-2026-01, -02… */
export function nextMocNo(list: Pick<ManagementOfChange, 'no'>[], date: string): string {
  const y = date.slice(0, 4);
  const re = new RegExp(`^MOC-${y}-(\\d+)$`);
  const top = list.reduce((m, x) => Math.max(m, Number(re.exec(x.no)?.[1] ?? 0)), 0);
  return `MOC-${y}-${String(top + 1).padStart(2, '0')}`;
}

export interface Who {
  name: string;
  rank?: string;
}

/** The record with one more step; throws when the stage does not allow it or a reason is missing. */
export function withStep(m: ManagementOfChange, kind: MocStepKind, by: Who, now: number, note?: string, signedWith?: MocStep['signedWith']): ManagementOfChange {
  if (!nextSteps(mocStage(m)).includes(kind)) throw new Error(`${kind} is not possible at ${mocStage(m)}`);
  if (MOC_NEEDS_NOTE.includes(kind) && (note ?? '').trim().length < 3) throw new Error('A reason is required');
  const step: MocStep = {
    kind,
    by: by.name,
    ...(by.rank ? { byRank: by.rank } : {}),
    at: now,
    ...(note?.trim() ? { note: note.trim() } : {}),
    ...(signedWith ? { signedWith } : {}),
  };
  return { ...m, steps: [...m.steps, step], updatedAt: now };
}

/** The approved risk assessment made for this change (the newest), if any. */
export function mocRa(m: Pick<ManagementOfChange, 'id' | 'raId'>, risks: RiskAssessment[]): RiskAssessment | undefined {
  return risks
    .filter((r) => !r.deleted && !r.generic && r.approved && (r.mocId === m.id || r.id === m.raId))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

export type ApproveProblem = 'what' | 'why' | 'ra' | 'actions';

/** What stops the Master approving it: the change and why written, an approved risk assessment (when risk assessments are on), an action to carry it out. */
export function approveProblem(m: ManagementOfChange, risks: RiskAssessment[], raOn: boolean): ApproveProblem | null {
  if (!m.what.trim()) return 'what';
  if (!m.why.trim()) return 'why';
  if (raOn && !mocRa(m, risks)) return 'ra';
  if (!m.actions.length) return 'actions';
  return null;
}

/** Every action signed done. */
export const actionsDone = (m: Pick<ManagementOfChange, 'actions'>): boolean => m.actions.length > 0 && m.actions.every((a) => a.doneAt);

/** Approved and every action done — the Master's to close. */
export const readyToClose = (m: ManagementOfChange): boolean => mocStage(m) === 'approved' && actionsDone(m);

/** The documents named on it that have not been issued in a new revision since. */
export function docsNotRevised(m: Pick<ManagementOfChange, 'docs'>, docs: IsmDoc[]): IsmDoc[] {
  return (m.docs ?? [])
    .map((d) => ({ d, now: docs.find((x) => x.id === d.id && !x.deleted) }))
    .filter((x): x is { d: (typeof x)['d']; now: IsmDoc } => !!x.now && x.now.revision <= x.d.rev)
    .map((x) => x.now);
}

export const overdueActions = (m: Pick<ManagementOfChange, 'actions'>, today: string): MocAction[] => m.actions.filter((a) => !a.doneAt && a.due < today);

export function nextActionDue(m: Pick<ManagementOfChange, 'actions'>): string | undefined {
  return m.actions.filter((a) => !a.doneAt).map((a) => a.due).sort()[0];
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** A temporary change in force: past its end date (`over`), ending within a week (`soon`), else null. */
export function tempState(m: ManagementOfChange, today: string): 'over' | 'soon' | null {
  if (!m.until || mocStage(m) !== 'approved') return null;
  if (m.until < today) return 'over';
  if (m.until <= addDays(today, 7)) return 'soon';
  return null;
}

/** Since when it waits for the office: the Master's approval that sent it there. */
export function sentToOffice(m: ManagementOfChange): MocStep | undefined {
  return mocStage(m) === 'office' ? last(m) : undefined;
}

/** What waits for the office's answer, oldest first. */
export function mocsToAnswer(list: ManagementOfChange[]): ManagementOfChange[] {
  return list.filter((m) => mocStage(m) === 'office').sort((a, b) => sentToOffice(a)!.at - sentToOffice(b)!.at);
}

/** The last return, with its reason — shown to the officer who reworks it. */
export function returnedBy(m: ManagementOfChange): MocStep | undefined {
  const s = last(m);
  return s && (s.kind === 'masterReturn' || s.kind === 'officeReturn') ? s : undefined;
}

const ORDER: Record<MocStage, number> = { returned: 0, master: 1, office: 2, draft: 3, approved: 4, closed: 5, rejected: 6, cancelled: 7 };

/** The list: what needs someone first, then in work (overdue first), then the finished history, newest first. */
export function sortMocs(list: ManagementOfChange[], today: string): ManagementOfChange[] {
  const late = (m: ManagementOfChange) => Number(overdueActions(m, today).length > 0 || tempState(m, today) === 'over');
  return [...list].sort((a, b) => ORDER[mocStage(a)] - ORDER[mocStage(b)] || late(b) - late(a) || b.at - a.at);
}

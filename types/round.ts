// ===================================
// An inspection round — "the monthly fire-extinguisher round", worked through
// by any number of crew on any number of devices until it is done (Jez, 11 Oct
// 2026). A round is one period's window and a set of categories; only the
// inspections signed WITHIN it (Inspection.roundId) count towards it — an item
// checked outside the round stays outstanding on it. Nothing is removed from the
// register: done items are simply off the outstanding list.
// ===================================

import type { CategoryKey } from './equipment';
import type { InspectionPeriod } from './inspection';

export interface InspectionRound {
  id: string;
  period: InspectionPeriod;
  categories: CategoryKey[];
  /** The period's window when the round was started (epoch ms) and its name, "October 2026", "Week 41 · …". */
  from: number;
  to: number;
  label: string;
  startedBy: string;
  startedByRank?: string;
  startedAt: number;
  /** Closed rounds stay, with their report; a closed round takes no more inspections. */
  closedAt?: number;
  closedBy?: string;
  updatedAt: number;
}

// ===================================
// The crew roll on paper (services/crewRoll.ts) — onboard list, details, five
// years' history. PDF, saved or shared. English always.
// ===================================

import { VesselInfo } from './storage';
import { sharePmsHistory } from './pmsHistoryReport';
import { RollInput, detailsSheets, historySheet, onboardSheet } from './crewRoll';

export type RollKind = 'onboard' | 'details' | 'history';

const TITLE: Record<RollKind, string> = {
  onboard: 'Crew roll — onboard crew list',
  details: 'Crew roll — crew details',
  history: 'Crew roll — historic crews',
};

export async function shareCrewRoll(kind: RollKind, i: RollInput, vessel: VesselInfo | null) {
  const sheets = kind === 'onboard' ? [onboardSheet(i)] : kind === 'details' ? detailsSheets(i) : [historySheet(i)];
  const stamp = i.today.split('-').reverse().join('');
  return sharePmsHistory(TITLE[kind], `${TITLE[kind].replace(' — ', ' ')} ${stamp}`, vessel, sheets);
}

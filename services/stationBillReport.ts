// ===================================
// The muster list on paper (services/stationBillRows.ts) — one alarm, or the
// whole list. PDF, saved or shared. English always.
// ===================================

import { VesselInfo } from './storage';
import { sharePmsHistory } from './pmsHistoryReport';
import { ALARM_EN, alarmSheet, billSheets } from './stationBillRows';
import { AlarmKind, StationBill } from '../types/stationBill';

export async function shareAlarm(b: StationBill, kind: AlarmKind, vessel: VesselInfo | null, today: string, current: boolean) {
  return sharePmsHistory(`Muster list — ${ALARM_EN[kind]}`, `Muster list ${ALARM_EN[kind]} Rev ${b.rev}`, vessel, [alarmSheet(b, kind, today, current)]);
}

export async function shareBill(b: StationBill, vessel: VesselInfo | null, today: string, current: boolean) {
  return sharePmsHistory('Muster list', `Muster list Rev ${b.rev}`, vessel, billSheets(b, today, current));
}

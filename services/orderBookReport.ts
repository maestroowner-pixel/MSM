// ===================================
// The Master's orders on paper — the Night Order Book for a period, one
// night, and a revision of standing orders with who has read it. PDF, saved or
// shared. English always.
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory, sharePmsHistory } from './pmsHistoryReport';
import { KIND_EN, nightBook, nightSheet, standingSheet } from './orderBookRows';
import { CrewMember } from '../types/crew';
import { NightOrder, OrderAck, StandingOrder } from '../types/orderBook';

export async function exportNightBook(list: NightOrder[], acks: OrderAck[], vessel: VesselInfo | null, from: string, to: string, now: string) {
  return exportPmsHistory('Night Order Book', 'Night Order Book', vessel, [nightBook(list, acks, from, to, now)]);
}

export async function shareNightBook(list: NightOrder[], acks: OrderAck[], vessel: VesselInfo | null, from: string, to: string, now: string) {
  return sharePmsHistory('Night Order Book', 'Night Order Book', vessel, [nightBook(list, acks, from, to, now)]);
}

export async function shareNight(o: NightOrder, acks: OrderAck[], vessel: VesselInfo | null, now: string) {
  return sharePmsHistory(`Night orders ${o.date}`, `Night orders ${o.date}`, vessel, [nightSheet(o, acks, now)]);
}

export async function exportStanding(s: StandingOrder, all: StandingOrder[], acks: OrderAck[], crew: CrewMember[], vessel: VesselInfo | null, today: string, current: boolean) {
  return exportPmsHistory(KIND_EN[s.kind], `${KIND_EN[s.kind]} Rev ${s.rev}`, vessel, [standingSheet(s, all, acks, crew, today, current)]);
}

export async function shareStanding(s: StandingOrder, all: StandingOrder[], acks: OrderAck[], crew: CrewMember[], vessel: VesselInfo | null, today: string, current: boolean) {
  return sharePmsHistory(KIND_EN[s.kind], `${KIND_EN[s.kind]} Rev ${s.rev}`, vessel, [standingSheet(s, all, acks, crew, today, current)]);
}

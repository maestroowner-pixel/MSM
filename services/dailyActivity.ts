// ===================================
// The day on board, from every record (13 Oct 2026: "the daily report brings
// together all the vessel's activity from every log — xlsx / pdf").
//
// One section per record kept that day, each a small table: inspections and
// rounds, maintenance done and defects, the Oil / Garbage / Sewage / Ballast
// books, fuel, permits, drills, the gangway, SOPEP, QHSE, surveys, the hospital
// (stock only — the medical log says no more than how many were seen, because
// the daily report goes to the office). Only switched-on modules are read.
// Pure: no storage, no React.
// ===================================

import type { ModuleKey } from '../constants/modules';
import type { EquipmentItem } from '../types/equipment';
import type { Inspection } from '../types/inspection';
import type { InspectionRound } from '../types/round';
import type { PmsDefect, PmsDone } from '../types/pms';
import type { OrbEntry } from '../types/orb';
import type { GarbageEntry } from '../types/garbage';
import type { LogEntry } from '../types/logbook';
import type { FuelBunker, FuelReading, FuelTank, FuelTransfer } from '../types/fuel';
import type { Permit } from '../types/permits';
import type { Drill } from '../types/drills';
import type { CrewMove, SecurityDrill, SecurityLevelRec, Visitor } from '../types/security';
import type { SopepCheck, SopepDrill } from '../types/sopep';
import type { NonConformity, SafetyObservation } from '../types/safety';
import type { MedItem, MedMove, MedTreatment } from '../types/hospital';
import type { SurveyDone } from '../types/survey';
import { drillTitle } from '../types/drills';
import { shipInstant } from '../utils/shipTime';

export interface DaySection {
  title: string;
  head: string[];
  rows: string[][];
}

export interface DayInput {
  /** The report day (YYYY-MM-DD). */
  date: string;
  /**
   * The window the report covers, ms — the noon report noon to noon, the
   * midnight report the calendar day (`reportWindow`). Absent: the calendar day.
   */
  from?: number;
  to?: number;
  on: (k: ModuleKey) => boolean;
  labelOf: (category: string) => string;
  flat: EquipmentItem[];
  inspections: Inspection[];
  rounds?: InspectionRound[];
  pmsDone?: PmsDone[];
  pmsDefects?: PmsDefect[];
  orb?: OrbEntry[];
  garbage?: GarbageEntry[];
  sewage?: LogEntry[];
  ballast?: LogEntry[];
  fuelTanks?: FuelTank[];
  fuelReadings?: FuelReading[];
  fuelBunkers?: FuelBunker[];
  fuelTransfers?: FuelTransfer[];
  permits?: Permit[];
  drills?: Drill[];
  securityDrills?: SecurityDrill[];
  visitors?: Visitor[];
  crewMoves?: CrewMove[];
  securityLevels?: SecurityLevelRec[];
  sopepChecks?: SopepCheck[];
  sopepDrills?: SopepDrill[];
  observations?: SafetyObservation[];
  ncs?: NonConformity[];
  medItems?: MedItem[];
  medMoves?: MedMove[];
  medTreatments?: MedTreatment[];
  surveysDone?: SurveyDone[];
}

/** The ship's day of an instant, YYYY-MM-DD in local time. */
export const dayOf = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hm = (at?: number) => (at ? new Date(at).toTimeString().slice(0, 5) : '');
const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');
const live = <T extends { cancelled?: boolean }>(l: T[] = []) => l.filter((x) => !x.cancelled);
const sortT = (rows: string[][]) => rows.sort((a, b) => a[0].localeCompare(b[0]));

export type ReportKind = 'noon' | 'midnight';
export const REPORT_LABEL: Record<ReportKind, string> = { noon: 'Noon report', midnight: 'Midnight report' };

/** Noon: from noon the day before to noon on the day. Midnight: the calendar day, 00:00 to 24:00. */
export function reportWindow(kind: ReportKind, date: string, shipOffset?: string): { from: number; to: number } {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const prev = new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  // In ship's time (Settings → Vessel → Ship's time); unset, the device's zone.
  return kind === 'noon'
    ? { from: shipInstant(prev, '12:00', shipOffset), to: shipInstant(date, '12:00', shipOffset) }
    : { from: shipInstant(date, '00:00', shipOffset), to: shipInstant(next, '00:00', shipOffset) };
}

/** When a record happened: its date and hh:mm in ship's time (no time = the start of the day). */
const tOf = (date: string, time?: string) => new Date(`${date}T${time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : '00:00'}:00`).getTime();

export function dailyActivity(x: DayInput): DaySection[] {
  const win = x.from != null && x.to != null ? { from: x.from, to: x.to } : reportWindow('midnight', x.date);
  const inA = (at?: number) => at != null && at >= win.from && at < win.to;
  const inD = (date: string, time?: string) => inA(tOf(date, time));
  const out: DaySection[] = [];
  const add = (title: string, head: string[], rows: string[][]) => {
    if (rows.length) out.push({ title, head, rows: sortT(rows) });
  };

  // ---- inspections & rounds ----
  const byId = new Map(x.flat.map((i) => [i.id, i]));
  add('Inspections', ['Time', 'Item', 'Category', 'Period', 'Result', 'By'], x.inspections.filter((i) => inA(i.at)).map((i) => {
    const it = byId.get(i.itemId);
    const name = [i.item?.no ?? it?.no, i.item?.type ?? it?.type].filter((v) => v != null && v !== '').join(' ') || i.itemId;
    return [hm(i.at), name, x.labelOf(i.category), i.period, i.outcome === 'fail' ? 'FAIL' : 'pass', who(i.by, i.byRank)];
  }));
  if (x.on('rounds')) {
    const rows: string[][] = [];
    for (const r of x.rounds ?? []) {
      if (inA(r.startedAt)) rows.push([hm(r.startedAt), r.label, 'started', '']);
      if (r.closedAt && inA(r.closedAt)) rows.push([hm(r.closedAt), r.label, 'closed — final sign-off', who(r.closedBy, r.closedByRank)]);
    }
    add('Inspection rounds', ['Time', 'Round', 'What', 'By'], rows);
  }

  // ---- maintenance ----
  if (x.on('pms')) {
    add('Maintenance done', ['Time', 'Machine', 'Job', 'Hours', 'By'], (x.pmsDone ?? []).filter((d) => inA(d.at) && !(d as any).cancelled).map((d) => [hm(d.at), d.machineName, `${d.unplanned ? 'Unplanned: ' : ''}${d.jobTitle}`, d.hours != null ? String(d.hours) : '', who(d.by, d.byRank)]));
    const rows: string[][] = [];
    for (const d of x.pmsDefects ?? []) {
      if (inA(d.at)) rows.push([hm(d.at), d.machineName, `found: ${d.description}`, who(d.by, d.byRank)]);
      if (d.closed && inA(d.closed.at)) rows.push([hm(d.closed.at), d.machineName, `closed: ${d.closed.note}`, who(d.closed.by, d.closed.byRank)]);
    }
    add('Defects', ['Time', 'Machine', 'What', 'By'], rows);
  }

  // ---- record books ----
  const book = (title: string, list?: { date: string; time?: string; code: string; text: string; by: string; byRank?: string; cancelled?: boolean }[]) =>
    add(title, ['Time', 'Code', 'Entry', 'By'], live(list ?? []).filter((e) => inD(e.date, e.time)).map((e) => [e.time ?? '', e.code, e.text, who(e.by, e.byRank)]));
  if (x.on('orb')) book('Oil Record Book', x.orb as any);
  if (x.on('garbage')) {
    add('Garbage Record Book', ['Time', 'Category', 'How', 'm³', 'Where', 'By'], live(x.garbage ?? []).filter((g) => inD(g.date, g.time)).map((g) => [
      g.time ?? '', (g.items?.length ? g.items.map((i) => i.category).join(', ') : g.category) as string, String(g.method), String(g.volume ?? ''), g.position || g.port || '', who(g.by, g.byRank),
    ]));
  }
  if (x.on('sewage')) book('Sewage record', x.sewage);
  if (x.on('ballast')) book('Ballast water record', x.ballast);

  // ---- fuel ----
  if (x.on('fuel')) {
    const tank = (id: string) => x.fuelTanks?.find((t) => t.id === id)?.name ?? id;
    const rows: string[][] = [];
    for (const r of live(x.fuelReadings ?? []).filter((r) => inD(r.date, r.time))) rows.push([r.time ?? '', 'Sounding', Object.entries(r.tanks).map(([id, l]) => `${tank(id)} ${Math.round(Number(l))} L`).join(' · '), who(r.by, r.byRank)]);
    for (const b of live(x.fuelBunkers ?? []).filter((b) => inD(b.date, b.time))) rows.push([b.time ?? '', 'Bunkering', `${Math.round(b.litres)} L at ${b.port}${b.bdnNo ? ` · BDN ${b.bdnNo}` : ''}`, who(b.by, b.byRank)]);
    for (const t of live(x.fuelTransfers ?? []).filter((t) => inD(t.date, t.time))) rows.push([t.time ?? '', 'Transfer', `${Math.round(t.litres)} L ${tank(t.fromTankId)} → ${tank(t.toTankId)}`, who(t.by, t.byRank)]);
    add('Fuel', ['Time', 'What', 'Detail', 'By'], rows);
  }

  // ---- permits ----
  if (x.on('ptw')) {
    const rows: string[][] = [];
    for (const p of x.permits ?? []) {
      const tag = `${p.no ?? 'draft'} · ${p.work}`;
      if (p.requested && inA(p.requested.at)) rows.push([hm(p.requested.at), tag, `requested — ${p.location}`, who(p.requested.by, p.requested.byRank)]);
      if (p.approved && inA(p.approved.at)) rows.push([hm(p.approved.at), tag, 'approved', who(p.approved.by, p.approved.byRank)]);
      if (p.closed && inA(p.closed.at)) rows.push([hm(p.closed.at), tag, 'closed — work complete', who(p.closed.by, p.closed.byRank)]);
    }
    add('Permits to work', ['Time', 'Permit', 'What', 'By'], rows);
  }

  // ---- drills ----
  const drillRows: string[][] = [];
  if (x.on('drills')) for (const d of (x.drills ?? []).filter((d) => d.doneAt && inD(d.date, d.time))) drillRows.push([d.time ?? '', `${d.no} ${drillTitle(d)}`, d.topic || '', `${d.attendance.filter((a) => a.present).length} present`, who(d.doneBy, d.doneByRank)]);
  if (x.on('security')) for (const d of live(x.securityDrills ?? []).filter((d) => inD(d.date, d.time))) drillRows.push([d.time ?? '', 'Security drill', d.scenario, `${d.participants.length} present`, who(d.by, d.byRank)]);
  if (x.on('sopep')) for (const d of live(x.sopepDrills ?? []).filter((d) => inD(d.date, d.time))) drillRows.push([d.time ?? '', 'Oil-spill drill', d.scenario, `${d.participants.length} present`, who(d.by, d.byRank)]);
  add('Drills', ['Time', 'Drill', 'Topic', 'Attendance', 'Conducted by'], drillRows);

  // ---- gangway ----
  if (x.on('security')) {
    const rows: string[][] = [];
    for (const v of live(x.visitors ?? [])) {
      if (inD(v.date, v.timeIn)) rows.push([v.timeIn, 'Visitor aboard', `${v.name}${v.company ? `, ${v.company}` : ''} — ${v.purpose}`, v.inBy]);
      if (v.timeOut && inD(v.dateOut ?? v.date, v.timeOut)) rows.push([v.timeOut, 'Visitor ashore', v.name, v.outBy ?? '']);
    }
    const moves = (x.crewMoves ?? []).filter((m) => inA(m.at));
    if (moves.length) rows.push(['', 'Crew', `${moves.filter((m) => m.dir === 'ashore').length} went ashore, ${moves.filter((m) => m.dir === 'aboard').length} came back aboard`, '']);
    for (const l of (x.securityLevels ?? []).filter((l) => inA(l.since))) rows.push([hm(l.since), 'Security level', `ISPS level ${l.level}${l.reason ? ` — ${l.reason}` : ''}`, who(l.by, l.byRank)]);
    add('Gangway & security', ['Time', 'What', 'Detail', 'By'], rows);
  }

  // ---- SOPEP ----
  if (x.on('sopep')) add('SOPEP', ['Time', 'What', 'Detail', 'By'], live(x.sopepChecks ?? []).filter((c) => inA(c.at)).map((c) => [hm(c.at), 'Locker inventory', c.remarks ?? '', who(c.by, c.byRank)]));

  // ---- QHSE ----
  if (x.on('qhse')) {
    const rows: string[][] = [];
    for (const o of (x.observations ?? []).filter((o) => inA(o.at))) rows.push([hm(o.at), `Observation card — ${o.kind.replace('_', ' ')}`, `${o.topic}: ${o.what}`, o.anonymous ? 'anonymous' : who(o.by, o.byRank)]);
    for (const n of x.ncs ?? []) {
      if (inA(n.raisedAt)) rows.push([hm(n.raisedAt), `${n.no} raised`, n.title, who(n.raisedBy, n.raisedByRank)]);
      if (n.closedAt && inA(n.closedAt)) rows.push([hm(n.closedAt), `${n.no} closed`, n.title, who(n.closedBy, n.closedByRank)]);
    }
    add('Safety observations & NC', ['Time', 'What', 'Detail', 'By'], rows);
  }

  // ---- surveys ----
  if (x.on('surveys')) add('Surveys & audits', ['Date', 'Survey', 'Result', 'By'], live(x.surveysDone ?? []).filter((s) => inA(s.at)).map((s) => [s.date, s.name, [s.ref, s.note].filter(Boolean).join(' · '), who(s.by, s.byRank)]));

  // ---- hospital: stock moves; patients only counted ----
  if (x.on('hospital')) {
    const name = (id: string) => x.medItems?.find((i) => i.id === id)?.name ?? id;
    const rows = (x.medMoves ?? []).filter((m) => inA(m.at) && m.kind !== 'issued').map((m) => [hm(m.at), name(m.itemId), `${m.kind} ${m.qty}${m.batchNo ? ` · batch ${m.batchNo}` : ''}${m.note ? ` · ${m.note}` : ''}`, `${who(m.by, m.byRank)}${m.witness ? ` · witness ${m.witness}` : ''}`]);
    const seen = (x.medTreatments ?? []).filter((t) => inD(t.date, t.time)).length;
    if (seen) rows.push(['', 'Medical log', `${seen} ${seen === 1 ? 'person' : 'people'} seen — details in the medical log (confidential)`, '']);
    add('Hospital', ['Time', 'Item', 'What', 'By'], rows);
  }

  return out;
}

/** The day in a few lines, for the e-mail: each section and how many entries. */
export function activityLines(sections: DaySection[]): string[] {
  return sections.map((s) => `${s.title}: ${s.rows.length}`);
}

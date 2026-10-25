// ===================================
// The notice board — the Dashboard across every module (10 Oct 2026: "it was
// only LSA/FFE and lifting; now it is the notice board for all the screens").
//
//   attention   what needs someone, from every module switched on, worst first
//   plan        rounds of this week / month / quarter / year, surveys & audits,
//               equipment services coming up
//   today       the day's routine: sounding, noon report, rounds, permits
//   tiles       one per module, a line each
//
// One pure function: the screen hands it the data and the modules on, and
// draws what comes back. Each notice says who it is for — the crew see their
// own, the Officers the vessel, the Master everything.
// ===================================

import { EquipmentItem, CategoryKey } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { CrewMember, CrewPrivate, isAboard } from '../types/crew';
import { Inspection, InspectionPeriod } from '../types/inspection';
import { Machine, PmsJob } from '../types/pms';
import { SparePart, SpareMove } from '../types/spares';
import { DocAck, IsmDoc } from '../types/docs';
import { Permit } from '../types/permits';
import { FuelDailySent, FuelReading, FuelTank } from '../types/fuel';
import { GarbageEntry, GarbageMasterSign } from '../types/garbage';
import { OrbEntry, OrbMasterSign } from '../types/orb';
import { LogEntry, LogMonthSign } from '../types/logbook';
import { SopepCheck, SopepDrill, SopepItem } from '../types/sopep';
import { CrewMove, SecurityDrill, SecurityLevelRec, Visitor } from '../types/security';
import { Survey, SurveyDone } from '../types/survey';
import { ModuleKey } from '../constants/modules';
import { complianceDate, computeStatus, daysUntil, statusFromDate } from '../utils/dates';
import { activeDeferral, jobDue } from './pms';
import { stockByPart, toOrderCounts } from './spares';
import { toRead } from './docs';
import { isOverdue } from './permits';
import { openDefects, windowFor } from './inspections';
import { gmdssCheckStatus } from './gmdssService';
import { crewIssues } from './crewIssues';
import { robTotal } from './fuel';
import { fuelDaily } from './fuelDaily';
import { lastMoves, personsOnBoard } from './gangway';
import { surveyStatus } from './surveys';
import { ncState, nextActionDue } from './safety';
import { NonConformity, SafetyObservation } from '../types/safety';
import { Drill } from '../types/drills';
import { drillSchedule } from './drills';
import { MedCheck, MedItem, MedMove, MedOrder, MedTreatment } from '../types/hospital';
import { Passenger, passengerAboard } from '../types/passengers';
import { SafetyMeeting } from '../types/meetings';
import { StoreItem, StoreMove, StoreRoom, roomOf, storeRooms } from '../types/stores';
import { storeCounts, storeStatus } from './stores';
import { meetingDue, openActions } from './meetings';
import { chestCounts, chestStatus, followUpsDue, isArchived, isLanding, landingLinesFor, lastControlledCount, orderOverdue, orderState, stockLevel } from './hospital';
import { currentEntries } from './garbage';
import { current } from './versions';
import { awaiting, verifiedIds } from './verification';
import { t, tn } from '../utils/t';

export type Level = 'red' | 'amber' | 'blue';
export type Audience = 'all' | 'officer' | 'master';

export interface Notice {
  key: string;
  level: Level;
  title: string;
  sub?: string;
  route: string;
  params?: Record<string, unknown>;
  who: Audience;
  icon: string;
}
export interface PlanRow {
  key: string;
  title: string;
  sub: string;
  /** 0–1 for a round's progress bar. */
  progress?: number;
  level?: Level;
  route: string;
  params?: Record<string, unknown>;
  icon: string;
}
export interface TodayRow {
  key: string;
  title: string;
  done: boolean;
  route: string;
  params?: Record<string, unknown>;
}
export interface Tile {
  key: string;
  label: string;
  line: string;
  level?: Level;
  route: string;
  params?: Record<string, unknown>;
  icon: string;
}
/** A summary panel (13 Oct 2026: "add the hospital, a summary of the gangway"): a few facts, each with its own colour. */
export interface SummaryRow {
  label: string;
  value: string;
  level?: Level;
  /** Names under the line — who is ashore, which visitors. */
  more?: string[];
}
export interface Summary {
  /** A small table above the rows — the gangway's on board / ashore. */
  table?: { head: string[]; rows: { cells: string[]; level?: Level; bold?: boolean }[] };
  key: string;
  title: string;
  icon: string;
  route: string;
  params?: Record<string, unknown>;
  who: Audience;
  rows: SummaryRow[];
}

export interface BoardStatus {
  isps?: number;
  pob?: { total: number; crew: number; visitors: number; ashore?: number };
  rob?: { litres: number; daysLeft?: number };
}
export interface Board {
  status: BoardStatus;
  attention: Notice[];
  plan: PlanRow[];
  today: TodayRow[];
  tiles: Tile[];
  summaries: Summary[];
}

export interface BoardInput {
  on: (m: ModuleKey) => boolean;
  role: 'user' | 'admin' | 'superadmin';
  /** The person on this device, for "documents to read". */
  me?: { key: string; name: string } | null;
  today: string;
  /** Local "yyyy-mm-ddThh:mm". */
  now: string;
  labelOf: (c: CategoryKey) => string;
  periodsOf: (c: CategoryKey) => InspectionPeriod[];
  flat: EquipmentItem[];
  certificates: Certificate[];
  inspections: Inspection[];
  crew: CrewMember[];
  crewPrivate: CrewPrivate[];
  machines: Machine[];
  pmsJobs: PmsJob[];
  pmsDeferrals?: import('../types/pms').PmsDeferral[];
  pmsDefects?: import('../types/pms').PmsDefect[];
  spares: SparePart[];
  spareMoves: SpareMove[];
  docs: IsmDoc[];
  docAcks: DocAck[];
  permits: Permit[];
  fuelTanks: FuelTank[];
  fuelReadings: FuelReading[];
  fuelBunkers: import('../types/fuel').FuelBunker[];
  fuelDailySent: FuelDailySent[];
  garbage: GarbageEntry[];
  garbageSigns: GarbageMasterSign[];
  /** The other MARPOL-style books — optional, so older callers (checks) need not pass them. */
  orb?: OrbEntry[];
  orbSigns?: OrbMasterSign[];
  sewage?: LogEntry[];
  sewageSigns?: LogMonthSign[];
  ballast?: LogEntry[];
  ballastSigns?: LogMonthSign[];
  sopepItems: SopepItem[];
  sopepChecks: SopepCheck[];
  sopepDrills: SopepDrill[];
  visitors: Visitor[];
  securityLevels: SecurityLevelRec[];
  securityDrills: SecurityDrill[];
  crewMoves: CrewMove[];
  surveys: Survey[];
  surveysDone: SurveyDone[];
  observations?: SafetyObservation[];
  ncs?: NonConformity[];
  drills?: Drill[];
  medItems?: MedItem[];
  medMoves?: MedMove[];
  medTreatments?: MedTreatment[];
  medOrders?: MedOrder[];
  medChecks?: MedCheck[];
  passengers?: Passenger[];
  safetyMeetings?: SafetyMeeting[];
  storeItems?: StoreItem[];
  storeMoves?: StoreMove[];
  storeRoomList?: StoreRoom[];
  gmdssLog?: import('../types/gmdss').GmdssEntry[];
}

const RANK: Record<Level, number> = { red: 0, amber: 1, blue: 2 };
const daysAgo = (today: string, iso: string) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86400000);
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

export function buildBoard(x: BoardInput): Board {
  const n: Notice[] = [];
  const plan: PlanRow[] = [];
  const today: TodayRow[] = [];
  const tiles: Tile[] = [];
  const summaries: Summary[] = [];
  const status: BoardStatus = {};
  const lvl = (red: number, amber: number): Level | undefined => (red ? 'red' : amber ? 'amber' : undefined);

  // ---- LSA / FFE / lifting register ----
  const scored = x.flat.map((it) => ({ it, st: computeStatus(it), date: complianceDate(it) })).filter((r) => r.date);
  const byCat = new Map<CategoryKey, { expired: number; due: number; first?: string }>();
  for (const r of scored) {
    if (r.st !== 'expired' && r.st !== 'due') continue;
    const c = byCat.get(r.it.category) ?? { expired: 0, due: 0 };
    if (r.st === 'expired') c.expired++;
    else c.due++;
    if (!c.first || r.date! < c.first) c.first = r.date;
    byCat.set(r.it.category, c);
  }
  for (const [cat, c] of byCat) {
    n.push({
      key: `eq:${cat}`, level: c.expired ? 'red' : 'amber', who: 'all', icon: 'lifebuoy', route: 'CategoryItems', params: { category: cat },
      title: `${x.labelOf(cat)} — ${[c.expired ? t('b.expiredN', { n: c.expired }) : null, c.due ? t('b.dueSoonN', { n: c.due }) : null].filter(Boolean).join(', ')}`,
      sub: c.first ? t('b.earliest', { date: dm(c.first) }) : undefined,
    });
  }
  const eqRed = scored.filter((r) => r.st === 'expired').length;
  const eqAmber = scored.filter((r) => r.st === 'due').length;
  if (x.flat.length) tiles.push({ key: 'eq', label: 'LSA / FFE', icon: 'lifebuoy', route: 'Expiries', level: lvl(eqRed, eqAmber), line: eqRed || eqAmber ? [eqRed ? t('b.expiredN', { n: eqRed }) : null, eqAmber ? t('b.dueN', { n: eqAmber }) : null].filter(Boolean).join(' · ') : t('b.itemsInDate', { n: x.flat.length }) });

  // Open defects.
  const defects = openDefects(x.inspections);
  if (defects.length) n.push({ key: 'defects', level: 'red', who: 'all', icon: 'alert-octagon-outline', route: 'Defects', title: tn('n.openDefect', defects.length), sub: t('b.notRectified') });

  // Rounds of the current periods.
  if (x.flat.length) {
    const ref = new Date(`${x.now.slice(0, 16)}`);
    const nameOf: Record<InspectionPeriod, string> = { weekly: t('b.round.weekly'), monthly: t('b.round.monthly'), quarterly: t('b.round.quarterly'), annual: t('b.round.annual') };
    for (const p of ['weekly', 'monthly', 'quarterly', 'annual'] as InspectionPeriod[]) {
      const owing = x.flat.filter((it) => x.periodsOf(it.category).includes(p));
      if (!owing.length) continue;
      const w = windowFor(p, ref);
      const done = owing.filter((it) => x.inspections.some((i) => i.itemId === it.id && i.period === p && i.at >= w.from && i.at < w.to)).length;
      const end = new Date(w.to - 86400000);
      const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      const left = Math.max(0, Math.ceil((w.to - ref.getTime()) / 86400000));
      const nearEnd = left <= Math.max(1, Math.round(((w.to - w.from) / 86400000) * 0.2));
      plan.push({
        key: `round:${p}`, icon: 'clipboard-check-outline', route: 'Equipment', title: `${nameOf[p]} — ${w.label}`,
        sub: `${t('b.round.progress', { done, total: owing.length, date: dm(endIso) })}${done < owing.length ? ` · ${t('b.left', { x: tn('n.day', left) })}` : ''}`,
        progress: done / owing.length, level: done >= owing.length ? undefined : nearEnd ? 'amber' : undefined,
      });
      if (p === 'weekly' && done < owing.length) today.push({ key: 'round:weekly', title: t('b.round.weeklyLeft', { n: owing.length - done }), done: false, route: 'Equipment' });
    }
  }

  // ---- Certificates ----
  const live = x.certificates;
  const vessel = live.filter((c) => (c.scope ?? 'equipment') === 'vessel');
  const equip = live.filter((c) => (c.scope ?? 'equipment') === 'equipment');
  for (const c of vessel) {
    const st = statusFromDate(c.expiryDate);
    if (st === 'expired' || st === 'due') n.push({ key: `vc:${c.id}`, level: st === 'expired' ? 'red' : 'amber', who: 'officer', icon: 'certificate-outline', route: 'Certificates', title: `${c.name} — ${st === 'expired' ? t('b.expired') : t('b.expires', { date: dm(c.expiryDate!) })}` });
  }
  for (const c of equip) {
    const d = daysUntil(c.expiryDate);
    if (d == null) continue;
    if (d < 0) n.push({ key: `ec:${c.id}`, level: 'red', who: 'all', icon: 'certificate-outline', route: 'Certificates', title: `${c.name} — ${t('b.serviceExpired')}` });
    else if (d <= 60) plan.push({ key: `ec:${c.id}`, icon: 'wrench-clock', route: 'Certificates', title: c.name, sub: t('b.serviceDue', { date: dm(c.expiryDate!), days: tn('n.day', d) }), level: d <= 30 ? 'amber' : undefined });
  }
  const certRed = live.filter((c) => statusFromDate(c.expiryDate) === 'expired').length;
  const certAmber = live.filter((c) => statusFromDate(c.expiryDate) === 'due').length;
  if (live.length) tiles.push({ key: 'certs', label: t('menu.Certificates'), icon: 'certificate-outline', route: 'Certificates', level: lvl(certRed, certAmber), line: certRed || certAmber ? [certRed ? t('b.expiredN', { n: certRed }) : null, certAmber ? t('b.dueN', { n: certAmber }) : null].filter(Boolean).join(' · ') : t('b.inDateN', { n: live.length }) });

  // ---- Crew (personal papers) ----
  if (x.on('crewCerts')) {
    const aboard = x.crew.filter(isAboard);
    let red = 0;
    let amber = 0;
    for (const m of aboard) {
      const iss = crewIssues(m, x.crewPrivate.find((p) => p.id === m.id), x.certificates, false);
      if (iss.some((i) => i.level === 'expired')) red++;
      else if (iss.some((i) => i.level === 'due')) amber++;
    }
    if (red || amber) n.push({ key: 'crew', level: red ? 'red' : 'amber', who: 'officer', icon: 'card-account-details-outline', route: 'CrewMatrix', title: `${t('b.crewDocs')} — ${[red ? t('b.crew.expired', { x: tn('n.person', red) }) : null, amber ? t('b.dueSoonN', { n: amber }) : null].filter(Boolean).join(', ')}` });
    // Signed on is not on board: with the gangway on, those ashore are said apart (13 Oct 2026: "it said 9 on board — in fact 9 ashore").
    const last = x.on('security') ? lastMoves(x.crewMoves) : new Map();
    const away = aboard.filter((c) => last.get(c.id)?.dir === 'ashore').length;
    const leave = x.crew.filter((c) => c.active && !c.deleted && c.onBoard === false).length;
    tiles.push({ key: 'crew', label: t('b.crew'), icon: 'account-group-outline', route: 'CrewMatrix', level: lvl(red, amber), line: [t('b.onBoardN', { n: aboard.length - away }), away ? t('b.ashoreN', { n: away }) : null, leave ? t('b.onLeaveN', { n: leave }) : null].filter(Boolean).join(' · ') });
  }

  // ---- PMS ----
  if (x.on('pms') && x.pmsJobs.length) {
    const byId = new Map(x.machines.map((m) => [m.id, m]));
    let over = 0;
    let due = 0;
    for (const j of x.pmsJobs) {
      const m = byId.get(j.machineId);
      if (!m) continue;
      const st = jobDue(j, m, x.today, activeDeferral(j, x.pmsDeferrals ?? [])).status;
      if (st === 'expired') over++;
      else if (st === 'due') due++;
    }
    if (over) n.push({ key: 'pms:over', level: 'red', who: 'officer', icon: 'engine-outline', route: 'Maintenance', title: `${t('b.pms')} — ${t('b.overdueX', { x: tn('n.job', over) })}` });
    if (due) n.push({ key: 'pms:due', level: 'amber', who: 'officer', icon: 'engine-outline', route: 'Maintenance', title: `${t('b.pms')} — ${t('b.dueX', { x: tn('n.job', due) })}` });
    // Written up as done by whoever did them, waiting for an officer's signature.
    const waiting = x.pmsJobs.filter((j) => j.prepared && !j.deleted && byId.has(j.machineId)).length;
    if (waiting) n.push({ key: 'pms:await', level: 'amber', who: 'officer', icon: 'clipboard-check-outline', route: 'Maintenance', title: `${t('b.pms')} — ${t('b.pms.awaiting', { x: tn('n.job', waiting) })}` });
    // Machinery defects: safety-critical to everyone at once, class-affecting to the officers.
    const open = (x.pmsDefects ?? []).filter((d) => !d.closed);
    const safety = open.filter((d) => d.category === 'safety');
    const cls = open.filter((d) => d.category === 'class');
    if (safety.length) n.push({ key: 'pms:defect-safety', level: 'red', who: 'all', icon: 'alert-octagon-outline', route: 'Maintenance', title: `${safety.length > 1 ? t('b.pms.safetyDefects', { n: safety.length }) : t('b.pms.safetyDefect')} — ${safety[0].machineName}`, sub: safety[0].description });
    if (cls.length) n.push({ key: 'pms:defect-class', level: 'amber', who: 'officer', icon: 'alert-outline', route: 'Maintenance', title: `${cls.length > 1 ? t('b.pms.classDefects', { n: cls.length }) : t('b.pms.classDefect')} — ${cls[0].machineName}`, sub: cls[0].description });
    tiles.push({ key: 'pms', label: t('b.pms'), icon: 'engine-outline', route: 'Maintenance', level: lvl(over, due), line: over || due ? [over ? t('b.overdueN', { n: over }) : null, due ? t('b.dueN', { n: due }) : null].filter(Boolean).join(' · ') : t('b.pms.inHand', { n: x.pmsJobs.length }) });
  }

  // ---- Spares ----
  if (x.on('spares') && x.spares.length) {
    const o = toOrderCounts(x.spares, stockByPart(x.spareMoves));
    if (o.out || o.low) n.push({ key: 'spares', level: o.out ? 'amber' : 'blue', who: 'officer', icon: 'package-variant', route: 'Spares', title: `${t('b.spares.toOrder')} — ${[o.out ? t('b.outOfStockN', { n: o.out }) : null, o.low ? t('b.lowN', { n: o.low }) : null].filter(Boolean).join(', ')}` });
    tiles.push({ key: 'spares', label: t('b.spares'), icon: 'package-variant', route: 'Spares', level: o.out ? 'amber' : undefined, line: o.out || o.low ? t('b.toOrderN', { n: o.out + o.low }) : tn('n.part', x.spares.length) });
  }

  // ---- Documents to read ----
  if (x.on('docs') && x.me) {
    const k = toRead(x.docs, x.docAcks, x.me.key, x.me.name).length;
    if (k) n.push({ key: 'docs', level: 'blue', who: 'all', icon: 'book-open-page-variant-outline', route: 'Documents', title: t('b.docs.toSign', { x: tn('n.document', k) }) });
    tiles.push({ key: 'docs', label: t('menu.Documents'), icon: 'book-open-page-variant-outline', route: 'Documents', level: k ? 'blue' : undefined, line: k ? t('b.toReadN', { n: k }) : tn('n.document', x.docs.length) });
  }

  // ---- Permits ----
  if (x.on('ptw')) {
    const open = x.permits.filter((p) => !p.deleted && ['draft', 'requested', 'approved', 'active'].includes(p.status));
    const late = open.filter((p) => isOverdue(p, x.now));
    const active = open.filter((p) => p.status === 'active');
    const waiting = open.filter((p) => p.status === 'requested');
    const approved = open.filter((p) => p.status === 'approved');
    if (late.length) n.push({ key: 'ptw:late', level: 'red', who: 'officer', icon: 'clipboard-alert-outline', route: 'Permits', title: t('b.ptw.late', { x: tn('n.permit', late.length) }) });
    if (waiting.length) n.push({ key: 'ptw:req', level: 'amber', who: 'officer', icon: 'clipboard-text-outline', route: 'Permits', title: t('b.ptw.waiting', { x: tn('n.permit', waiting.length) }) });
    for (const p of active) today.push({ key: `ptw:${p.id}`, title: `${t('b.ptw.inForce')} — ${p.no ?? ''} ${p.location ?? ''}`.replace(/\s+/g, ' ').trim(), done: false, route: 'Permit', params: { id: p.id } });
    const permitLabel = (p: Permit) => [`${p.no ?? ''}`, p.location].filter(Boolean).join(' · ');
    summaries.push({
      key: 'ptw', title: t('b.ptw'), icon: 'clipboard-text-outline', route: 'Permits', who: 'officer',
      rows: [
        { label: t('b.ptw.rowInForce'), value: active.length ? String(active.length) : '—', level: active.length ? 'blue' : undefined, more: active.slice(0, 5).map(permitLabel) },
        ...(approved.length ? [{ label: t('b.ptw.approved'), value: String(approved.length), more: approved.slice(0, 3).map(permitLabel) }] : []),
        ...(waiting.length ? [{ label: t('b.ptw.awaiting'), value: String(waiting.length), level: 'amber' as Level, more: waiting.slice(0, 3).map(permitLabel) }] : []),
        ...(late.length ? [{ label: t('b.ptw.overdue'), value: String(late.length), level: 'red' as Level, more: late.slice(0, 3).map(permitLabel) }] : []),
        { label: t('b.ptw.openTotal'), value: String(open.length) },
      ],
    });
  }

  // ---- Fuel ----
  if (x.on('fuel') && x.fuelTanks.some((t) => !t.deleted)) {
    const tanks = x.fuelTanks.filter((t) => !t.deleted);
    const sounded = x.fuelReadings.some((r) => r.date === x.today);
    const sent = x.fuelDailySent.some((s) => s.date === x.today);
    const noon = x.now.slice(11, 16) >= '12:00';
    if (!sounded && noon) n.push({ key: 'fuel:snd', level: 'amber', who: 'officer', icon: 'gas-station-outline', route: 'Fuel', params: { view: 'sounding' }, title: t('b.fuel.noSounding') });
    if (sounded && !sent && noon) n.push({ key: 'fuel:noon', level: 'amber', who: 'officer', icon: 'gas-station-outline', route: 'Fuel', params: { view: 'daily' }, title: t('b.fuel.noNoon') });
    today.push({ key: 'fuel:snd', title: t('b.fuel.sounding'), done: sounded, route: 'Fuel', params: { view: 'sounding' } });
    today.push({ key: 'fuel:noon', title: t('b.fuel.noon'), done: sent, route: 'Fuel', params: { view: 'daily' } });
    const last = [...x.fuelReadings].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (last) {
      const d = fuelDaily(last.date, x.fuelTanks, x.fuelReadings, x.fuelBunkers);
      status.rob = { litres: robTotal(last, tanks), ...(d.daysLeft != null ? { daysLeft: d.daysLeft } : {}) };
      if (d.daysLeft != null && d.daysLeft <= 3) n.push({ key: 'fuel:low', level: 'red', who: 'officer', icon: 'gas-station-outline', route: 'Fuel', params: { view: 'daily' }, title: t('b.fuel.low', { days: tn('n.day', d.daysLeft) }) });
    }
    tiles.push({ key: 'fuel', label: t('b.fuel'), icon: 'gas-station-outline', route: 'Fuel', level: !sounded && noon ? 'amber' : undefined, line: status.rob ? `ROB ${Math.round(status.rob.litres).toLocaleString('en-GB').replace(/,/g, ' ')} L${status.rob.daysLeft != null ? ` · ≈${tn('n.day', status.rob.daysLeft)}` : ''}` : t('b.fuel.none') });
  }

  // ---- Garbage ----
  if (x.on('garbage')) {
    const book = currentEntries(x.garbage).filter((e) => !e.cancelled);
    const m = book.filter((e) => e.date.startsWith(x.today.slice(0, 7)));
    const acc = m.filter((e) => e.method === 'accidental').length;
    if (acc) n.push({ key: 'grb:acc', level: 'red', who: 'officer', icon: 'trash-can-outline', route: 'Garbage', title: t('b.grb.accidental', { x: tn('n.accidental', acc) }) });
    tiles.push({ key: 'grb', label: t('b.grb'), icon: 'trash-can-outline', route: 'Garbage', level: acc ? 'red' : undefined, line: t('b.thisMonthX', { x: tn('n.entry', m.length) }) });
  }

  // ---- The Master's verification of the record books (MEPC.312 §4.3.10) ----
  // An entry signed more than a day ago and not verified is the Master's to do —
  // amended ones included, they need verifying again.
  {
    const books = [
      { on: x.on('orb'), key: 'orb', label: t('orb.title'), icon: 'oil', route: 'OilRecord', all: x.orb ?? [], signs: x.orbSigns ?? [] },
      { on: x.on('garbage'), key: 'grb', label: t('gb.book'), icon: 'trash-can-outline', route: 'Garbage', all: x.garbage, signs: x.garbageSigns },
      { on: x.on('sewage'), key: 'sewage', label: t('menu.Sewage'), icon: 'water-outline', route: 'Sewage', all: x.sewage ?? [], signs: x.sewageSigns ?? [] },
      { on: x.on('ballast'), key: 'ballast', label: t('menu.Ballast'), icon: 'waves', route: 'Ballast', all: x.ballast ?? [], signs: x.ballastSigns ?? [] },
    ];
    const dayAgo = Date.parse(`${x.now}:00`) - 86_400_000;
    for (const b of books) {
      if (!b.on) continue;
      const late = awaiting(current(b.all as any[]), verifiedIds(b.all, b.signs)).filter((e) => e.at < dayAgo);
      if (late.length) n.push({ key: `${b.key}:verify`, level: 'amber', who: 'master', icon: b.icon, route: b.route, params: { month: [...late].sort((p, q) => p.date.localeCompare(q.date))[0].date.slice(0, 7) }, title: t('b.book.unverified', { book: b.label, x: tn('n.entry', late.length) }) });
    }
  }

  // ---- SOPEP ----
  if (x.on('sopep') && x.sopepItems.length) {
    const lastCheck = [...x.sopepChecks].sort((a, b) => b.at - a.at)[0];
    const lastDrill = [...x.sopepDrills].sort((a, b) => b.at - a.at)[0];
    const short = lastCheck ? x.sopepItems.filter((i) => !i.deleted && (lastCheck.counted[i.id] ?? 0) < i.required).length : 0;
    if (!lastCheck || daysAgo(x.today, lastCheck.date) > 31) n.push({ key: 'sopep:chk', level: 'amber', who: 'officer', icon: 'oil', route: 'Sopep', title: lastCheck ? t('b.sopep.lastChecked', { date: dm(lastCheck.date) }) : t('b.sopep.never') });
    if (short) n.push({ key: 'sopep:short', level: 'amber', who: 'officer', icon: 'oil', route: 'Sopep', title: t('b.sopep.short', { x: tn('n.item', short) }) });
    if (!x.on('drills') && (!lastDrill || daysAgo(x.today, lastDrill.date) > 90)) n.push({ key: 'sopep:drill', level: 'blue', who: 'officer', icon: 'oil', route: 'Sopep', params: { view: 'drills' }, title: lastDrill ? t('b.sopep.drillLast', { date: dm(lastDrill.date) }) : t('b.sopep.drillNone') });
    tiles.push({ key: 'sopep', label: 'SOPEP', icon: 'oil', route: 'Sopep', level: short ? 'amber' : undefined, line: lastCheck ? `${t('b.checkedOn', { date: dm(lastCheck.date) })}${short ? ` · ${t('b.shortN', { n: short })}` : ''}` : t('b.notChecked') });
  }

  // ---- Security ----
  if (x.on('security')) {
    const lev = [...x.securityLevels].sort((a, b) => b.since - a.since)[0]?.level ?? 1;
    status.isps = lev;
    if (lev > 1) n.push({ key: 'isps', level: 'red', who: 'all', icon: 'shield-alert-outline', route: 'Security', title: t('b.isps.level', { n: lev }) });
    const guests = x.on('passengers') ? (x.passengers ?? []).filter((p) => passengerAboard(p, x.today)) : [];
    const pob = personsOnBoard(x.crew, x.crewMoves, x.visitors, guests, x.today);
    status.pob = { total: pob.total, crew: pob.crewAboard, visitors: pob.visitors, ashore: pob.ashore.length + pob.paxAshore.length };
    const lastDrill = [...x.securityDrills].sort((a, b) => b.at - a.at)[0];
    const age = lastDrill ? daysAgo(x.today, lastDrill.date) : 999;
    if (x.on('drills')) {
      // the Drills schedule carries it
    } else if (age > 90) n.push({ key: 'isps:drill', level: 'amber', who: 'officer', icon: 'shield-account', route: 'Security', params: { view: 'drills' }, title: lastDrill ? t('b.isps.drillOverdue', { date: dm(lastDrill.date) }) : t('b.isps.drillNone') });
    else if (age > 75) plan.push({ key: 'isps:drill', icon: 'shield-account', route: 'Security', params: { view: 'drills' }, title: t('b.isps.drill'), sub: t('b.dueWithin', { days: tn('n.day', 90 - age) }) });
    if (pob.visitors) today.push({ key: 'vis', title: t('b.visitorsOnBoard', { x: tn('n.visitor', pob.visitors) }), done: false, route: 'Security' });
    tiles.push({ key: 'sec', label: t('b.security'), icon: 'shield-account', route: 'Security', level: lev > 1 ? 'red' : age > 90 ? 'amber' : undefined, line: `ISPS ${lev} · ${t('b.onBoardN', { n: pob.total })}${pob.ashore.length + pob.paxAshore.length ? ` · ${t('b.ashoreN', { n: pob.ashore.length + pob.paxAshore.length })}` : ''}` });
    // The gangway at a glance: who is aboard, who is ashore and since when, the visitors, today's crossings.
    const last = lastMoves(x.crewMoves);
    const onBoardVis = x.visitors.filter((v) => !v.timeOut);
    const crossedToday = x.crewMoves.filter((m) => m.date === x.today);
    const master = x.role === 'superadmin';
    const since = (c: { id: string; name: string }) => { const m = last.get(c.id); return `${c.name}${m ? ` · ${t('b.since', { time: m.date === x.today ? m.time : `${dm(m.date)} ${m.time}` })}` : ''}`; };
    summaries.push({
      key: 'gangway', title: t('b.gangway'), icon: 'ferry', route: 'Security', params: { view: 'gangway' }, who: 'all',
      // A small table (13 Oct 2026: "9 on · 0 off" was not clear): who is on board and who is ashore,
      // crew / passengers / visitors and the total; under it what crossed today. Names — who is
      // ashore and since when, which visitors are aboard — for the Master only; the others see the counts.
      table: {
        head: ['', t('b.onBoard'), t('b.ashore')],
        rows: [
          { cells: [t('b.crew'), String(pob.crewAboard), String(pob.ashore.length)], level: pob.ashore.length ? 'amber' : undefined },
          ...(x.on('passengers') ? [{ cells: [t('b.passengers'), String(pob.paxAboard), String(pob.paxAshore.length)], level: (pob.paxAshore.length ? 'amber' : undefined) as Level | undefined }] : []),
          { cells: [t('b.visitors'), String(onBoardVis.length), '—'], level: (onBoardVis.length ? 'blue' : undefined) as Level | undefined },
          { cells: [t('b.total'), String(pob.total), String(pob.ashore.length + pob.paxAshore.length)], bold: true },
        ],
      },
      rows: [
        ...(master && pob.ashore.length + pob.paxAshore.length ? [{ label: t('b.ashoreNow'), value: '', more: [...pob.ashore, ...pob.paxAshore].slice(0, 10).map((c) => `${since(c)}${pob.paxAshore.includes(c as any) ? ` · ${t('b.passenger')}` : ''}`) }] : []),
        ...(master && onBoardVis.length ? [{ label: t('b.visitorsAboard'), value: '', more: onBoardVis.slice(0, 6).map((v) => `${v.name}${v.company ? `, ${v.company}` : ''} · ${t('b.inAt', { time: v.timeIn })}`) }] : []),
        { label: t('b.today'), value: [t('b.wentAshore', { x: tn('n.person', crossedToday.filter((m) => m.dir === 'ashore').length) }), t('b.cameBack', { n: crossedToday.filter((m) => m.dir === 'aboard').length }), t('b.visitorsCame', { x: tn('n.visitor', x.visitors.filter((v) => v.date === x.today).length), n: x.visitors.filter((v) => v.timeOut && (v.dateOut ?? v.date) === x.today).length })].join(' · ') },
      ],
    });
  }

  // ---- Drills: what is due, what is planned ----
  if (x.on('drills')) {
    const drills = x.drills ?? [];
    const rows = drillSchedule(drills, x.today, x.sopepDrills, x.securityDrills);
    let red = 0;
    let amber = 0;
    for (const r of rows) {
      // An own drill off a cycle is never due — only its plan shows.
      const left = r.everyDays ? r.left ?? -1 : 9999;
      if (r.planned && r.planned.date <= x.today) {
        n.push({ key: `drill:${r.type}`, level: left < 0 ? 'amber' : 'blue', who: 'officer', icon: 'run-fast', route: 'Drill', params: { id: r.planned.id }, title: t('b.drill.planned', { title: r.title, when: r.planned.date === x.today ? t('b.todayLc') : dm(r.planned.date) }), sub: r.planned.topic || undefined });
        if (left < 0) amber++;
      } else if (left < 0) {
        red++;
        n.push({ key: `drill:${r.type}`, level: 'red', who: 'officer', icon: 'run-fast', route: 'Drill', params: r.own ? { id: 'new', type: 'other', title: r.own.title } : { id: 'new', type: r.type }, title: r.last ? t('b.drill.overdue', { title: r.title, date: dm(r.last) }) : t('b.drill.none', { title: r.title }), sub: r.reg });
      } else if (left <= 7) {
        amber++;
        plan.push({ key: `drill:${r.type}`, icon: 'run-fast', route: 'Drill', params: r.planned ? { id: r.planned.id } : r.own ? { id: 'new', type: 'other', title: r.own.title } : { id: 'new', type: r.type }, title: t('b.drill', { title: r.title }), sub: r.planned ? t('b.plannedOn', { date: dm(r.planned.date) }) : t('b.dueWithin', { days: tn('n.day', left) }) });
      }
    }
    const done30 = drills.filter((d) => d.doneAt && daysAgo(x.today, d.date) <= 30).length;
    tiles.push({ key: 'drills', label: t('menu.Drills'), icon: 'run-fast', route: 'Drills', level: lvl(red, amber), line: red ? t('b.overdueN', { n: red }) : amber ? t('b.dueThisWeekN', { n: amber }) : t('b.last30N', { n: done30 }) });
  }

  // ---- Hospital: expired, expiring, short; the controlled drugs count; follow-ups ----
  if (x.on('hospital')) {
    const items = x.medItems ?? [];
    const rows = chestStatus(items, x.medMoves ?? [], x.today);
    const c = chestCounts(rows);
    // Out of date goes ashore on a landing report — the controlled drugs on their own, the Master's (13 Oct 2026).
    const landCd = landingLinesFor(rows, x.today, true).length;
    const empty = rows.filter((r) => r.item.required > 0 && stockLevel(r) === 'empty').length;
    if (c.expired) n.push({ key: 'med:exp', level: 'red', who: 'officer', icon: 'medical-bag', route: 'Hospital', params: { view: 'register', filter: 'expired' }, title: `${t('b.med.chestTitle')} — ${t('b.outOfDateX', { x: tn('n.item', c.expired) })}`, sub: t('b.med.expiredSub') });
    if (landCd) n.push({ key: 'med:exp:cd', level: 'red', who: 'master', icon: 'lock-alert-outline', route: 'MedLanding', params: { id: 'new', mode: 'cd' }, title: `${t('b.med.cd')} — ${t('b.outOfDateX', { x: tn('n.batch', landCd) })}`, sub: t('b.med.cdSub') });
    if (empty) n.push({ key: 'med:empty', level: 'red', who: 'officer', icon: 'package-variant-remove', route: 'Hospital', params: { view: 'register', filter: 'empty' }, title: `${t('b.med.chestTitle')} — ${t('b.outOfStockX', { x: tn('n.item', empty) })}`, sub: t('b.med.emptySub') });
    if (c.soon) n.push({ key: 'med:soon', level: 'amber', who: 'officer', icon: 'medical-bag', route: 'Hospital', params: { view: 'register', filter: 'soon' }, title: `${t('b.med.chestTitle')} — ${t('b.med.soon', { x: tn('n.item', c.soon) })}` });
    if (c.short) n.push({ key: 'med:short', level: 'amber', who: 'officer', icon: 'medical-bag', route: 'Hospital', params: { view: 'register', filter: 'short' }, title: `${t('b.med.chestTitle')} — ${t('b.belowScaleX', { x: tn('n.item', c.short) })}` });
    if (items.some((i) => i.controlled && !i.deleted)) {
      const last = lastControlledCount(items, x.medMoves ?? []);
      if (!last || daysAgo(x.today, last) > 31) n.push({ key: 'med:cd', level: 'amber', who: 'master', icon: 'pill', route: 'Hospital', params: { view: 'register', filter: 'controlled' }, title: `${t('b.med.cd')} — ${last ? t('b.med.cdLast', { date: dm(last) }) : t('b.med.cdNever')}`, sub: t('b.med.cdCount') });
    }
    for (const o of (x.medOrders ?? []).filter((o) => orderOverdue(o, x.medMoves ?? [], x.today))) n.push({ key: `med:ord:${o.id}`, level: 'amber', who: 'officer', icon: 'truck-delivery-outline', route: 'MedOrder', params: { id: o.id }, title: t('b.med.order', { no: o.no }), sub: `${t('b.expected', { date: dm(o.due!) })}${o.supplier ? ` · ${o.supplier}` : ''}` });
    for (const tr of followUpsDue(x.medTreatments ?? [], x.today)) n.push({ key: `med:fu:${tr.id}`, level: 'blue', who: 'officer', icon: 'stethoscope', route: 'Treatment', params: { id: 'new', followUpOf: tr.id }, title: t('b.med.followUp', { patient: tr.patient }), sub: `${tr.no} ${tr.complaint}` });
    tiles.push({ key: 'med', label: t('menu.Hospital'), icon: 'medical-bag', route: 'Hospital', level: lvl(c.expired + empty, c.soon + c.short), line: items.length ? [c.expired ? t('b.expiredN', { n: c.expired }) : null, empty ? t('b.outOfStockN', { n: empty }) : null, c.soon ? t('b.expiringN', { n: c.soon }) : null, c.short ? t('b.shortN', { n: c.short }) : null].filter(Boolean).slice(0, 3).join(' · ') || t('b.allInDate') : t('b.med.noList') });
    // The hospital at a glance — counts only; the medical log is the officers' (no patient names here).
    const live = items.filter((i) => !i.deleted);
    const cds = live.filter((i) => i.controlled);
    const lastCd = lastControlledCount(items, x.medMoves ?? []);
    const openOrders = (x.medOrders ?? []).filter((o) => !isArchived(orderState(o, x.medMoves ?? [])));
    const late = openOrders.filter((o) => orderOverdue(o, x.medMoves ?? [], x.today)).length;
    const month = x.today.slice(0, 7);
    const log = x.medTreatments ?? [];
    const fu = followUpsDue(log, x.today).length;
    const landings = (x.medChecks ?? []).filter(isLanding).sort((a, b) => b.at - a.at);
    const inStock = rows.filter((r) => !['empty', 'critical', 'low'].includes(stockLevel(r))).length;
    summaries.push({
      key: 'hospital', title: t('menu.Hospital'), icon: 'medical-bag', route: 'Hospital', who: 'officer',
      rows: live.length ? [
        { label: t('b.med.chest'), value: `${t('b.med.stocked', { x: tn('n.item', live.length), n: inStock })}${empty ? ` · ${t('b.outOfStockN', { n: empty })}` : ''}`, level: empty ? 'red' : undefined },
        { label: t('b.med.outOfDate'), value: c.expired ? `${tn('n.item', c.expired)}${landCd ? ` (${tn('n.cdBatch', landCd)})` : ''} — ${t('b.med.toLand')}` : t('common.none'), level: c.expired ? 'red' : undefined },
        { label: t('b.med.expiring'), value: c.soon ? tn('n.item', c.soon) : t('common.none'), level: c.soon ? 'amber' : undefined },
        { label: t('b.med.belowScale'), value: c.short ? `${tn('n.item', c.short)}${openOrders.length ? ` · ${t('b.openX', { x: tn('n.order', openOrders.length) })}${late ? `, ${t('b.overdueN', { n: late })}` : ''}` : ''}` : openOrders.length ? `${t('common.none')} · ${t('b.openX', { x: tn('n.order', openOrders.length) })}` : t('common.none'), level: late ? 'amber' : c.short ? 'amber' : undefined },
        ...(cds.length ? [{ label: t('b.med.cd'), value: `${tn('n.item', cds.length)} · ${lastCd ? t('b.countedOn', { date: dm(lastCd) }) : t('b.med.cdNever')}`, level: (!lastCd || daysAgo(x.today, lastCd) > 31 ? 'amber' : undefined) as Level | undefined }] : []),
        { label: t('b.med.log'), value: `${t('b.thisMonthN', { n: log.filter((e) => e.date.startsWith(month)).length })}${fu ? ` · ${t('b.dueX', { x: tn('n.followUp', fu) })}` : ''}`, level: fu ? 'blue' : undefined },
        ...(landings.length ? [{ label: t('b.med.lastLanding'), value: `${landings[0].no} · ${dm(landings[0].date)}${landings[0].port ? ` · ${landings[0].port}` : ''}` }] : []),
      ] : [{ label: t('b.med.chest'), value: t('b.med.noList') }],
    });
  }

  // ---- Stores (types/stores.ts): below the minimum, provisions out of date ----
  if (x.on('stores')) {
    const all = x.storeItems ?? [];
    const ppe = storeCounts(storeStatus(all.filter((i) => i.store === 'ppe'), x.storeMoves ?? [], x.today));
    const pro = storeCounts(storeStatus(all.filter((i) => i.store === 'provisions'), x.storeMoves ?? [], x.today));
    if (pro.expired) n.push({ key: 'sto:pro:exp', level: 'red', who: 'all', icon: 'food-apple-outline', route: 'Stores', params: { view: 'provisions' }, title: `${t('b.sto.provisions')} — ${t('b.outOfDateX', { x: tn('n.item', pro.expired) })}`, sub: t('b.sto.dispose') });
    if (pro.soon) n.push({ key: 'sto:pro:soon', level: 'amber', who: 'all', icon: 'food-apple-outline', route: 'Stores', params: { view: 'provisions' }, title: `${t('b.sto.provisions')} — ${t('b.sto.bestBefore', { x: tn('n.item', pro.soon) })}` });
    if (pro.short) n.push({ key: 'sto:pro:short', level: 'amber', who: 'officer', icon: 'cart-outline', route: 'Stores', params: { view: 'provisions' }, title: `${t('b.sto.provisions')} — ${t('b.belowMinX', { x: tn('n.item', pro.short) })}`, sub: t('b.sto.orderOn', { name: t('b.sto.provisions') }) });
    if (ppe.short) n.push({ key: 'sto:ppe:short', level: 'amber', who: 'officer', icon: 'hard-hat', route: 'Stores', params: { view: 'ppe' }, title: `${t('b.sto.ppe')} — ${t('b.belowMinX', { x: tn('n.item', ppe.short) })}` });
    if (ppe.expired) n.push({ key: 'sto:ppe:exp', level: 'red', who: 'officer', icon: 'hard-hat', route: 'Stores', params: { view: 'ppe' }, title: `${t('b.sto.ppe')} — ${t('b.pastExpiryX', { x: tn('n.item', ppe.expired) })}`, sub: t('b.sto.ppeSub') });
    // The vessel's general stores (bosun's, engine…): each its own line, to the officers.
    for (const r of storeRooms(x.storeRoomList ?? []).filter((r) => r.kind === 'general')) {
      const c = storeCounts(storeStatus(all.filter((i) => roomOf(i) === r.id), x.storeMoves ?? [], x.today));
      const params = { view: r.id };
      if (c.expired) n.push({ key: `sto:${r.id}:exp`, level: 'red', who: 'officer', icon: 'package-variant-closed', route: 'Stores', params, title: `${r.name} — ${t('b.pastExpiryX', { x: tn('n.item', c.expired) })}` });
      if (c.short) n.push({ key: `sto:${r.id}:short`, level: 'amber', who: 'officer', icon: 'cart-outline', route: 'Stores', params, title: `${r.name} — ${t('b.belowMinX', { x: tn('n.item', c.short) })}`, sub: t('b.sto.orderOn', { name: r.name }) });
    }
    if (ppe.items || pro.items) tiles.push({ key: 'sto', label: t('menu.Stores'), icon: 'warehouse', route: 'Stores', level: lvl(pro.expired + ppe.expired, pro.short + ppe.short + pro.soon), line: [ppe.items ? t('b.sto.ppeLine', { state: ppe.short ? t('b.shortN', { n: ppe.short }) : t('common.ok') }) : null, pro.items ? t('b.sto.provLine', { state: pro.expired ? t('b.outOfDateX', { x: pro.expired }) : pro.short ? t('b.shortN', { n: pro.short }) : t('common.ok') }) : null].filter(Boolean).join(' · ') });
  }

  // ---- Monthly safety meeting (types/meetings.ts) ----
  if (x.on('meetings')) {
    const list = x.safetyMeetings ?? [];
    const d = meetingDue(list, x.today);
    const late = openActions(list).filter((a) => a.due && a.due < x.today);
    const params = { view: 'meetings' };
    if (d.overdue) n.push({ key: 'sm:due', level: 'red', who: 'officer', icon: 'account-group-outline', route: 'Security', params, title: t('b.sm.overdue'), sub: d.last ? t('b.lastHeld', { date: `${dm(d.last.date)}.${d.last.date.slice(0, 4)}` }) : t('b.noneHeld') });
    else if (d.due) plan.push({ key: 'sm:due', icon: 'account-group-outline', route: 'Security', params, title: t('b.sm'), sub: d.last ? t('b.sm.dueThisMonth', { date: dm(d.last.date) }) : t('b.noneHeld'), level: 'amber' });
    if (late.length) n.push({ key: 'sm:act', level: 'amber', who: 'officer', icon: 'clipboard-text-clock-outline', route: 'Security', params, title: t('b.sm.actions', { x: tn('n.action', late.length) }), sub: late.slice(0, 2).map((a) => a.text).join(' · ') });
  }

  // ---- Passengers (types/passengers.ts) ----
  if (x.on('passengers')) {
    const list = (x.passengers ?? []).filter((p) => !p.deleted);
    const aboard = list.filter((p) => passengerAboard(p, x.today));
    const away = aboard.filter((p) => lastMoves(x.crewMoves).get(p.id)?.dir === 'ashore').length;
    const coming = list.filter((p) => p.embarked && p.embarked > x.today && daysAgo(p.embarked, x.today) <= 7);
    const leaving = aboard.filter((p) => p.disembarked && daysAgo(p.disembarked, x.today) <= 2);
    for (const p of coming) plan.push({ key: `pax:in:${p.id}`, icon: 'account-arrow-right-outline', route: 'Passengers', title: t('b.pax.joins', { name: p.name }), sub: `${dm(p.embarked!)}${p.embarkPort ? ` · ${p.embarkPort}` : ''}${p.cabin ? ` · ${t('b.cabin', { n: p.cabin })}` : ''}` });
    for (const p of leaving) plan.push({ key: `pax:out:${p.id}`, icon: 'account-arrow-left-outline', route: 'Passengers', title: t('b.pax.leaves', { name: p.name }), sub: `${dm(p.disembarked!)}${p.disembarkPort ? ` · ${p.disembarkPort}` : ''}` });
    tiles.push({ key: 'pax', label: t('menu.Passengers'), icon: 'account-group-outline', route: 'Passengers', level: away ? 'blue' : undefined, line: aboard.length ? `${t('b.onBoardN', { n: aboard.length - away })}${away ? ` · ${t('b.ashoreN', { n: away })}` : ''}` : coming.length ? t('b.pax.joiningN', { n: coming.length }) : t('b.pax.none') });
  }

  // ---- Surveys & audits ----
  if (x.on('surveys')) {
    let red = 0;
    let amber = 0;
    for (const s of x.surveys.filter((v) => !v.deleted)) {
      const st = surveyStatus(s, x.today, x.surveysDone);
      if (st.state === 'overdue') {
        red++;
        n.push({ key: `sv:${s.id}`, level: 'red', who: 'officer', icon: 'calendar-alert', route: 'Surveys', title: `${s.name} — ${t('b.overdue')}`, sub: t('b.sv.closed', { date: dm(st.closes) }) });
      } else if (st.state === 'open') {
        amber++;
        plan.push({ key: `sv:${s.id}`, icon: 'calendar-check-outline', route: 'Surveys', title: s.name, sub: t('b.sv.openUntil', { date: `${dm(st.closes)}.${st.closes.slice(0, 4)}`, x: tn('n.day', st.days) }), level: st.days <= 30 ? 'amber' : undefined });
        if (st.days <= 30) n.push({ key: `sv:${s.id}:n`, level: 'amber', who: 'officer', icon: 'calendar-clock', route: 'Surveys', title: `${s.name} — ${t('b.sv.closesIn', { x: tn('n.day', st.days) })}` });
      } else if (st.state === 'soon' || (st.state === 'planned' && st.days <= 120)) {
        plan.push({ key: `sv:${s.id}`, icon: 'calendar-outline', route: 'Surveys', title: s.name, sub: t('b.sv.opens', { date: `${dm(st.opens)}.${st.opens.slice(0, 4)}`, x: tn('n.day', st.days) }) });
      }
    }
    tiles.push({ key: 'sv', label: t('menu.Surveys'), icon: 'calendar-check-outline', route: 'Surveys', level: lvl(red, amber), line: red ? t('b.overdueN', { n: red }) : amber ? t('b.sv.openN', { n: amber }) : t('b.plannedN', { n: x.surveys.filter((v) => !v.deleted).length }) });
  }

  // ---- QHSE: observation cards and non-conformities ----
  if (x.on('qhse')) {
    const ncs = x.ncs ?? [];
    const obs = x.observations ?? [];
    let red = 0;
    let amber = 0;
    for (const nc of ncs) {
      const st = ncState(nc, x.today);
      if (st === 'overdue') {
        red++;
        n.push({ key: `nc:${nc.id}`, level: 'red', who: 'officer', icon: 'clipboard-alert-outline', route: 'Nc', params: { id: nc.id }, title: `${nc.no} — ${t('b.nc.overdue')}`, sub: nc.title });
      } else if (st === 'ready') {
        amber++;
        n.push({ key: `nc:${nc.id}`, level: 'amber', who: 'master', icon: 'clipboard-check-outline', route: 'Nc', params: { id: nc.id }, title: `${nc.no} — ${t('b.nc.toClose')}`, sub: nc.title });
      } else if (st === 'open') {
        const due = nextActionDue(nc);
        if (due) plan.push({ key: `nc:${nc.id}`, icon: 'clipboard-text-outline', route: 'Nc', params: { id: nc.id }, title: `${nc.no} ${nc.title}`, sub: t('b.nc.next', { date: `${dm(due)}.${due.slice(0, 4)}` }) });
      }
    }
    const fresh = obs.filter((o) => !o.reviewedAt).length;
    if (fresh) n.push({ key: 'obs:new', level: 'amber', who: 'officer', icon: 'eye-outline', route: 'Safety', title: t('b.obs.toReview', { x: tn('n.obsCard', fresh) }) });
    const open = ncs.filter((v) => !v.closedAt).length;
    tiles.push({ key: 'qhse', label: t('b.safety'), icon: 'shield-check-outline', route: 'Safety', level: lvl(red, amber || fresh), line: [open ? t('b.nc.openN', { n: open }) : t('b.nc.none'), fresh ? t('b.newCardsN', { n: fresh }) : null].filter(Boolean).join(' · ') });
  }

  // ---- GMDSS log check reminders ----------------------------------------
  if (x.on('gmdss') && x.gmdssLog) {
    const daily   = gmdssCheckStatus(x.gmdssLog, 'daily');
    const weekly  = gmdssCheckStatus(x.gmdssLog, 'weekly');
    const monthly = gmdssCheckStatus(x.gmdssLog, 'monthly');
    let red = 0; let amber = 0;
    if (daily.overdue)   { red++;   n.push({ key: 'gmdss:daily',   level: 'red',   who: 'officer', icon: 'radio-tower', route: 'Gmdss', title: t('b.gm.dailyOverdue'), sub: daily.lastDate ? t('b.lastOn', { date: dm(daily.lastDate) }) : t('b.neverDone') }); }
    else if (daily.dueSoon)  { amber++; n.push({ key: 'gmdss:daily',  level: 'amber', who: 'officer', icon: 'radio-tower', route: 'Gmdss', title: t('b.gm.dailyToday') }); }
    if (weekly.overdue)  { red++;   n.push({ key: 'gmdss:weekly',  level: 'red',   who: 'officer', icon: 'radio-tower', route: 'Gmdss', title: t('b.gm.weeklyOverdue'), sub: weekly.lastDate ? t('b.lastOn', { date: dm(weekly.lastDate) }) : t('b.neverDone') }); }
    else if (weekly.dueSoon) { amber++; n.push({ key: 'gmdss:weekly', level: 'amber', who: 'officer', icon: 'radio-tower', route: 'Gmdss', title: t('b.gm.weeklySoon') }); }
    if (monthly.overdue) { red++;   n.push({ key: 'gmdss:monthly', level: 'red',   who: 'officer', icon: 'radio-tower', route: 'Gmdss', title: t('b.gm.monthlyOverdue'), sub: monthly.lastDate ? t('b.lastOn', { date: dm(monthly.lastDate) }) : t('b.neverDone') }); }
    else if (monthly.dueSoon){ amber++; n.push({ key: 'gmdss:monthly',level: 'amber', who: 'officer', icon: 'radio-tower', route: 'Gmdss', title: t('b.gm.monthlySoon') }); }
    const last = [...x.gmdssLog].sort((a, b) => b.at - a.at)[0];
    tiles.push({ key: 'gmdss', label: t('menu.Gmdss'), icon: 'radio-tower', route: 'Gmdss', level: lvl(red, amber), line: red ? t('b.gm.checkOverdueN', { n: red }) : amber ? t('b.gm.checkToday') : last ? t('b.lastEntry', { date: dm(last.date) }) : t('b.noEntries') });
  }

  // Passengers where Documents were, Documents where Passengers were (13 Oct 2026: "swap passengers and documents").
  const di = tiles.findIndex((t) => t.key === 'docs');
  const pi = tiles.findIndex((t) => t.key === 'pax');
  if (di >= 0 && pi >= 0) [tiles[di], tiles[pi]] = [tiles[pi], tiles[di]];

  // Who sees what.
  const sees = (w: Audience) => w === 'all' || (w === 'officer' && x.role !== 'user') || (w === 'master' && x.role === 'superadmin');
  return {
    status,
    attention: n.filter((v) => sees(v.who)).sort((a, b) => RANK[a.level] - RANK[b.level]),
    plan,
    today,
    tiles,
    summaries: summaries.filter((v) => sees(v.who)),
  };
}

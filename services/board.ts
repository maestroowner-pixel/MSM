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
import { SopepCheck, SopepDrill, SopepItem } from '../types/sopep';
import { CrewMove, SecurityDrill, SecurityLevelRec, Visitor } from '../types/security';
import { Survey, SurveyDone } from '../types/survey';
import { ModuleKey } from '../constants/modules';
import { complianceDate, computeStatus, daysUntil, statusFromDate } from '../utils/dates';
import { jobDue } from './pms';
import { stockByPart, toOrderCounts } from './spares';
import { toRead } from './docs';
import { isOverdue } from './permits';
import { openDefects, windowFor } from './inspections';
import { crewIssues } from './crewIssues';
import { robTotal } from './fuel';
import { fuelDaily } from './fuelDaily';
import { personsOnBoard } from './gangway';
import { surveyStatus } from './surveys';

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
export interface BoardStatus {
  isps?: number;
  pob?: { total: number; crew: number; visitors: number };
  rob?: { litres: number; daysLeft?: number };
}
export interface Board {
  status: BoardStatus;
  attention: Notice[];
  plan: PlanRow[];
  today: TodayRow[];
  tiles: Tile[];
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
  sopepItems: SopepItem[];
  sopepChecks: SopepCheck[];
  sopepDrills: SopepDrill[];
  visitors: Visitor[];
  securityLevels: SecurityLevelRec[];
  securityDrills: SecurityDrill[];
  crewMoves: CrewMove[];
  surveys: Survey[];
  surveysDone: SurveyDone[];
}

const RANK: Record<Level, number> = { red: 0, amber: 1, blue: 2 };
const daysAgo = (today: string, iso: string) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86400000);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const prevMonth = (today: string) => {
  const [y, m] = today.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export function buildBoard(x: BoardInput): Board {
  const n: Notice[] = [];
  const plan: PlanRow[] = [];
  const today: TodayRow[] = [];
  const tiles: Tile[] = [];
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
      title: `${x.labelOf(cat)} — ${[c.expired ? `${c.expired} expired` : null, c.due ? `${c.due} due soon` : null].filter(Boolean).join(', ')}`,
      sub: c.first ? `earliest ${dm(c.first)}` : undefined,
    });
  }
  const eqRed = scored.filter((r) => r.st === 'expired').length;
  const eqAmber = scored.filter((r) => r.st === 'due').length;
  if (x.flat.length) tiles.push({ key: 'eq', label: 'LSA / FFE', icon: 'lifebuoy', route: 'Expiries', level: lvl(eqRed, eqAmber), line: eqRed || eqAmber ? [eqRed ? `${eqRed} expired` : null, eqAmber ? `${eqAmber} due` : null].filter(Boolean).join(' · ') : `${x.flat.length} items in date` });

  // Open defects.
  const defects = openDefects(x.inspections);
  if (defects.length) n.push({ key: 'defects', level: 'red', who: 'all', icon: 'alert-octagon-outline', route: 'Defects', title: `${plural(defects.length, 'open defect')}`, sub: 'not yet rectified' });

  // Rounds of the current periods.
  if (x.flat.length) {
    const ref = new Date(`${x.now.slice(0, 16)}`);
    const nameOf: Record<InspectionPeriod, string> = { weekly: 'Weekly round', monthly: 'Monthly round', quarterly: 'Quarterly round', annual: 'Annual round' };
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
        sub: `${done} of ${owing.length} done · until ${dm(endIso)}${done < owing.length ? ` · ${plural(left, 'day')} left` : ''}`,
        progress: done / owing.length, level: done >= owing.length ? undefined : nearEnd ? 'amber' : undefined,
      });
      if (p === 'weekly' && done < owing.length) today.push({ key: 'round:weekly', title: `Weekly round — ${owing.length - done} left`, done: false, route: 'Equipment' });
    }
  }

  // ---- Certificates ----
  const live = x.certificates;
  const vessel = live.filter((c) => (c.scope ?? 'equipment') === 'vessel');
  const equip = live.filter((c) => (c.scope ?? 'equipment') === 'equipment');
  for (const c of vessel) {
    const st = statusFromDate(c.expiryDate);
    if (st === 'expired' || st === 'due') n.push({ key: `vc:${c.id}`, level: st === 'expired' ? 'red' : 'amber', who: 'officer', icon: 'certificate-outline', route: 'Certificates', title: `${c.name} — ${st === 'expired' ? 'expired' : `expires ${dm(c.expiryDate!)}`}` });
  }
  for (const c of equip) {
    const d = daysUntil(c.expiryDate);
    if (d == null) continue;
    if (d < 0) n.push({ key: `ec:${c.id}`, level: 'red', who: 'all', icon: 'certificate-outline', route: 'Certificates', title: `${c.name} — service expired` });
    else if (d <= 60) plan.push({ key: `ec:${c.id}`, icon: 'wrench-clock', route: 'Certificates', title: c.name, sub: `service due by ${dm(c.expiryDate!)} · in ${plural(d, 'day')}`, level: d <= 30 ? 'amber' : undefined });
  }
  const certRed = live.filter((c) => statusFromDate(c.expiryDate) === 'expired').length;
  const certAmber = live.filter((c) => statusFromDate(c.expiryDate) === 'due').length;
  if (live.length) tiles.push({ key: 'certs', label: 'Certificates', icon: 'certificate-outline', route: 'Certificates', level: lvl(certRed, certAmber), line: certRed || certAmber ? [certRed ? `${certRed} expired` : null, certAmber ? `${certAmber} due` : null].filter(Boolean).join(' · ') : `${live.length} in date` });

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
    if (red || amber) n.push({ key: 'crew', level: red ? 'red' : 'amber', who: 'officer', icon: 'card-account-details-outline', route: 'CrewMatrix', title: `Crew documents — ${[red ? `${plural(red, 'person')} with expired` : null, amber ? `${amber} due soon` : null].filter(Boolean).join(', ')}` });
    tiles.push({ key: 'crew', label: 'Crew', icon: 'account-group-outline', route: 'CrewMatrix', level: lvl(red, amber), line: `${aboard.length} on board` });
  }

  // ---- PMS ----
  if (x.on('pms') && x.pmsJobs.length) {
    const byId = new Map(x.machines.map((m) => [m.id, m]));
    let over = 0;
    let due = 0;
    for (const j of x.pmsJobs) {
      const m = byId.get(j.machineId);
      if (!m) continue;
      const st = jobDue(j, m, x.today).status;
      if (st === 'expired') over++;
      else if (st === 'due') due++;
    }
    if (over) n.push({ key: 'pms:over', level: 'red', who: 'officer', icon: 'engine-outline', route: 'Maintenance', title: `Maintenance — ${plural(over, 'job')} overdue` });
    if (due) n.push({ key: 'pms:due', level: 'amber', who: 'officer', icon: 'engine-outline', route: 'Maintenance', title: `Maintenance — ${plural(due, 'job')} due` });
    tiles.push({ key: 'pms', label: 'Maintenance', icon: 'engine-outline', route: 'Maintenance', level: lvl(over, due), line: over || due ? [over ? `${over} overdue` : null, due ? `${due} due` : null].filter(Boolean).join(' · ') : `${x.pmsJobs.length} jobs in hand` });
  }

  // ---- Spares ----
  if (x.on('spares') && x.spares.length) {
    const o = toOrderCounts(x.spares, stockByPart(x.spareMoves));
    if (o.out || o.low) n.push({ key: 'spares', level: o.out ? 'amber' : 'blue', who: 'officer', icon: 'package-variant', route: 'Spares', title: `Spares to order — ${[o.out ? `${o.out} out of stock` : null, o.low ? `${o.low} low` : null].filter(Boolean).join(', ')}` });
    tiles.push({ key: 'spares', label: 'Spares', icon: 'package-variant', route: 'Spares', level: o.out ? 'amber' : undefined, line: o.out || o.low ? `${o.out + o.low} to order` : `${x.spares.length} parts` });
  }

  // ---- Documents to read ----
  if (x.on('docs') && x.me) {
    const k = toRead(x.docs, x.docAcks, x.me.key, x.me.name).length;
    if (k) n.push({ key: 'docs', level: 'blue', who: 'all', icon: 'book-open-page-variant-outline', route: 'Documents', title: `${plural(k, 'document')} to read and sign` });
    tiles.push({ key: 'docs', label: 'Documents', icon: 'book-open-page-variant-outline', route: 'Documents', level: k ? 'blue' : undefined, line: k ? `${k} to read` : `${x.docs.length} documents` });
  }

  // ---- Permits ----
  if (x.on('ptw')) {
    const open = x.permits.filter((p) => !p.deleted && ['draft', 'requested', 'approved', 'active'].includes(p.status));
    const late = open.filter((p) => isOverdue(p, x.now));
    const active = open.filter((p) => p.status === 'active');
    if (late.length) n.push({ key: 'ptw:late', level: 'red', who: 'officer', icon: 'clipboard-alert-outline', route: 'Permits', title: `${plural(late.length, 'permit')} past their time — close or renew` });
    const waiting = open.filter((p) => p.status === 'requested').length;
    if (waiting) n.push({ key: 'ptw:req', level: 'amber', who: 'officer', icon: 'clipboard-text-outline', route: 'Permits', title: `${plural(waiting, 'permit')} waiting for approval` });
    for (const p of active) today.push({ key: `ptw:${p.id}`, title: `Permit in force — ${p.no ?? ''} ${p.location ?? ''}`.replace(/\s+/g, ' ').trim(), done: false, route: 'Permit', params: { id: p.id } });
    tiles.push({ key: 'ptw', label: 'Permits', icon: 'clipboard-text-outline', route: 'Permits', level: late.length ? 'red' : waiting ? 'amber' : undefined, line: open.length ? `${open.length} open · ${active.length} in force` : 'none open' });
  }

  // ---- Fuel ----
  if (x.on('fuel') && x.fuelTanks.some((t) => !t.deleted)) {
    const tanks = x.fuelTanks.filter((t) => !t.deleted);
    const sounded = x.fuelReadings.some((r) => r.date === x.today);
    const sent = x.fuelDailySent.some((s) => s.date === x.today);
    const noon = x.now.slice(11, 16) >= '12:00';
    if (!sounded && noon) n.push({ key: 'fuel:snd', level: 'amber', who: 'officer', icon: 'gas-station-outline', route: 'Fuel', params: { view: 'sounding' }, title: 'Fuel — today’s sounding not taken' });
    if (sounded && !sent && noon) n.push({ key: 'fuel:noon', level: 'amber', who: 'officer', icon: 'gas-station-outline', route: 'Fuel', params: { view: 'daily' }, title: 'Fuel — noon report not sent' });
    today.push({ key: 'fuel:snd', title: 'Fuel sounding', done: sounded, route: 'Fuel', params: { view: 'sounding' } });
    today.push({ key: 'fuel:noon', title: 'Noon report (fuel)', done: sent, route: 'Fuel', params: { view: 'daily' } });
    const last = [...x.fuelReadings].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (last) {
      const d = fuelDaily(last.date, x.fuelTanks, x.fuelReadings, x.fuelBunkers);
      status.rob = { litres: robTotal(last, tanks), ...(d.daysLeft != null ? { daysLeft: d.daysLeft } : {}) };
      if (d.daysLeft != null && d.daysLeft <= 3) n.push({ key: 'fuel:low', level: 'red', who: 'officer', icon: 'gas-station-outline', route: 'Fuel', params: { view: 'daily' }, title: `Fuel — about ${plural(d.daysLeft, 'day')} left at the present rate` });
    }
    tiles.push({ key: 'fuel', label: 'Fuel', icon: 'gas-station-outline', route: 'Fuel', level: !sounded && noon ? 'amber' : undefined, line: status.rob ? `ROB ${Math.round(status.rob.litres).toLocaleString('en-GB').replace(/,/g, ' ')} L${status.rob.daysLeft != null ? ` · ≈${status.rob.daysLeft} days` : ''}` : 'no sounding yet' });
  }

  // ---- Garbage ----
  if (x.on('garbage')) {
    const pm = prevMonth(x.today);
    if (x.garbage.some((e) => e.date.startsWith(pm)) && !x.garbageSigns.some((s) => s.month === pm)) n.push({ key: 'grb:sign', level: 'amber', who: 'master', icon: 'trash-can-outline', route: 'Garbage', title: `Garbage Record Book — ${pm} not signed by the Master` });
    const m = x.garbage.filter((e) => e.date.startsWith(x.today.slice(0, 7)));
    const acc = m.filter((e) => e.method === 'accidental').length;
    if (acc) n.push({ key: 'grb:acc', level: 'red', who: 'officer', icon: 'trash-can-outline', route: 'Garbage', title: `Garbage — ${plural(acc, 'accidental discharge')} this month` });
    tiles.push({ key: 'grb', label: 'Garbage', icon: 'trash-can-outline', route: 'Garbage', level: acc ? 'red' : undefined, line: `${plural(m.length, 'entry', 'entries')} this month` });
  }

  // ---- SOPEP ----
  if (x.on('sopep') && x.sopepItems.length) {
    const lastCheck = [...x.sopepChecks].sort((a, b) => b.at - a.at)[0];
    const lastDrill = [...x.sopepDrills].sort((a, b) => b.at - a.at)[0];
    const short = lastCheck ? x.sopepItems.filter((i) => !i.deleted && (lastCheck.counted[i.id] ?? 0) < i.required).length : 0;
    if (!lastCheck || daysAgo(x.today, lastCheck.date) > 31) n.push({ key: 'sopep:chk', level: 'amber', who: 'officer', icon: 'oil', route: 'Sopep', title: lastCheck ? `SOPEP locker — last checked ${dm(lastCheck.date)}` : 'SOPEP locker — never checked' });
    if (short) n.push({ key: 'sopep:short', level: 'amber', who: 'officer', icon: 'oil', route: 'Sopep', title: `SOPEP locker — ${plural(short, 'item')} short` });
    if (!lastDrill || daysAgo(x.today, lastDrill.date) > 90) n.push({ key: 'sopep:drill', level: 'blue', who: 'officer', icon: 'oil', route: 'Sopep', title: lastDrill ? `Oil-spill drill — last ${dm(lastDrill.date)}` : 'Oil-spill drill — none recorded' });
    tiles.push({ key: 'sopep', label: 'SOPEP', icon: 'oil', route: 'Sopep', level: short ? 'amber' : undefined, line: lastCheck ? `checked ${dm(lastCheck.date)}${short ? ` · ${short} short` : ''}` : 'not checked' });
  }

  // ---- Security ----
  if (x.on('security')) {
    const lev = [...x.securityLevels].sort((a, b) => b.since - a.since)[0]?.level ?? 1;
    status.isps = lev;
    if (lev > 1) n.push({ key: 'isps', level: 'red', who: 'all', icon: 'shield-alert-outline', route: 'Security', title: `ISPS security level ${lev}` });
    const pob = personsOnBoard(x.crew, x.crewMoves, x.visitors);
    status.pob = { total: pob.total, crew: pob.crewAboard, visitors: pob.visitors };
    const lastDrill = [...x.securityDrills].sort((a, b) => b.at - a.at)[0];
    const age = lastDrill ? daysAgo(x.today, lastDrill.date) : 999;
    if (age > 90) n.push({ key: 'isps:drill', level: 'amber', who: 'officer', icon: 'shield-account', route: 'Security', params: { view: 'drills' }, title: lastDrill ? `Security drill overdue — last ${dm(lastDrill.date)}` : 'Security drill — none recorded (every 3 months)' });
    else if (age > 75) plan.push({ key: 'isps:drill', icon: 'shield-account', route: 'Security', params: { view: 'drills' }, title: 'Security drill', sub: `due within ${plural(90 - age, 'day')}` });
    if (pob.visitors) today.push({ key: 'vis', title: `${plural(pob.visitors, 'visitor')} on board`, done: false, route: 'Security' });
    tiles.push({ key: 'sec', label: 'Security', icon: 'shield-account', route: 'Security', level: lev > 1 ? 'red' : age > 90 ? 'amber' : undefined, line: `ISPS ${lev} · ${pob.total} on board` });
  }

  // ---- Surveys & audits ----
  if (x.on('surveys')) {
    let red = 0;
    let amber = 0;
    for (const s of x.surveys.filter((v) => !v.deleted)) {
      const st = surveyStatus(s, x.today, x.surveysDone);
      if (st.state === 'overdue') {
        red++;
        n.push({ key: `sv:${s.id}`, level: 'red', who: 'officer', icon: 'calendar-alert', route: 'Surveys', title: `${s.name} — overdue`, sub: `window closed ${dm(st.closes)}` });
      } else if (st.state === 'open') {
        amber++;
        plan.push({ key: `sv:${s.id}`, icon: 'calendar-check-outline', route: 'Surveys', title: s.name, sub: `window open until ${dm(st.closes)}.${st.closes.slice(0, 4)} · ${plural(st.days, 'day')} left`, level: st.days <= 30 ? 'amber' : undefined });
        if (st.days <= 30) n.push({ key: `sv:${s.id}:n`, level: 'amber', who: 'officer', icon: 'calendar-clock', route: 'Surveys', title: `${s.name} — window closes in ${plural(st.days, 'day')}` });
      } else if (st.state === 'soon' || (st.state === 'planned' && st.days <= 120)) {
        plan.push({ key: `sv:${s.id}`, icon: 'calendar-outline', route: 'Surveys', title: s.name, sub: `window opens ${dm(st.opens)}.${st.opens.slice(0, 4)} · in ${plural(st.days, 'day')}` });
      }
    }
    tiles.push({ key: 'sv', label: 'Surveys & audits', icon: 'calendar-check-outline', route: 'Surveys', level: lvl(red, amber), line: red ? `${red} overdue` : amber ? `${amber} window open` : `${x.surveys.filter((v) => !v.deleted).length} planned` });
  }

  // Who sees what.
  const sees = (w: Audience) => w === 'all' || (w === 'officer' && x.role !== 'user') || (w === 'master' && x.role === 'superadmin');
  return {
    status,
    attention: n.filter((v) => sees(v.who)).sort((a, b) => RANK[a.level] - RANK[b.level]),
    plan,
    today,
    tiles,
  };
}

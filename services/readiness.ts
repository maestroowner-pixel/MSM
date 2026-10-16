// ===================================
// Inspection readiness — "what would an inspector find if they came aboard on
// <date>?" (backlog #20, 16 Oct 2026). Port State Control, the flag or the
// class: the Master picks the inspection and its date, and gets one list of
// what to put right before it, worst first, every line opening the record that
// fixes it.
//
// It is the notice board turned on a date. The board says what needs someone
// TODAY; this says what will be out of date ON THE DAY — so an item that runs
// out between now and a PSC next Tuesday is red here while the board still
// calls it "due soon". The same helpers decide (computeStatus's dates, the
// drill schedule, surveyStatus, ncState, jobDue, analyseRest), so the two can
// never disagree about what "overdue" means.
//
//   red    will be found: out of date on the day, overdue, missing records,
//          open defects and non-conformities past their date
//   amber  worth doing first: runs out within 30 days AFTER the inspection
//          (an inspector looks ahead too), records still open
//
// Sections follow the modules switched on; a section with nothing to report is
// left out of the gaps but counted as checked, so "ready" means "looked at and
// clean", not "not looked at". One pure function, checked by
// `npm run check:readiness`.
// ===================================

import { EquipmentItem, CategoryKey } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { CrewMember, isAboard } from '../types/crew';
import { Inspection, InspectionPeriod } from '../types/inspection';
import { Machine, PmsDeferral, PmsDefect, PmsJob } from '../types/pms';
import { Survey, SurveyDone } from '../types/survey';
import { NonConformity } from '../types/safety';
import { Drill } from '../types/drills';
import { SopepDrill } from '../types/sopep';
import { SecurityDrill } from '../types/security';
import { MedItem, MedMove } from '../types/hospital';
import { RestDay } from '../types/rest';
import { ModuleKey } from '../constants/modules';
import { complianceDate } from '../utils/dates';
import { openDefects, stepPeriod, windowFor } from './inspections';
import { activeDeferral, jobDue } from './pms';
import { surveyStatus } from './surveys';
import { ncState } from './safety';
import { drillSchedule } from './drills';
import { chestStatus } from './hospital';
import { analyseRest } from './restHours';

export type ReadinessKind = 'psc' | 'flag' | 'class';
export const KIND_LABEL: Record<ReadinessKind, string> = { psc: 'Port State Control', flag: 'Flag inspection', class: 'Class survey' };

export type GapLevel = 'red' | 'amber';

export interface Gap {
  key: string;
  level: GapLevel;
  title: string;
  sub?: string;
  /** The day it runs out / ran out, when there is one — sorts and prints. */
  date?: string;
  route: string;
  params?: Record<string, unknown>;
}

export type SectionKey = 'equipment' | 'defects' | 'rounds' | 'vesselCerts' | 'serviceCerts' | 'surveys' | 'crew' | 'rest' | 'drills' | 'pms' | 'qhse' | 'hospital';

export interface ReadinessSection {
  key: SectionKey;
  title: string;
  icon: string;
  gaps: Gap[];
}

export interface Readiness {
  kind: ReadinessKind;
  /** The inspection day, yyyy-mm-dd. */
  date: string;
  today: string;
  /** Every section looked at, clean ones included. */
  sections: ReadinessSection[];
  red: number;
  amber: number;
}

export interface ReadinessInput {
  kind: ReadinessKind;
  date: string;
  today: string;
  /** How far past `date` amber looks, in days (LOOK_AHEAD by default; a handover looks over the next trip). */
  ahead?: number;
  on: (m: ModuleKey) => boolean;
  labelOf: (c: CategoryKey) => string;
  periodsOf: (c: CategoryKey) => InspectionPeriod[];
  flat: EquipmentItem[];
  certificates: Certificate[];
  inspections: Inspection[];
  crew: CrewMember[];
  rest?: RestDay[];
  machines?: Machine[];
  pmsJobs?: PmsJob[];
  pmsDeferrals?: PmsDeferral[];
  pmsDefects?: PmsDefect[];
  surveys?: Survey[];
  surveysDone?: SurveyDone[];
  ncs?: NonConformity[];
  drills?: Drill[];
  sopepDrills?: SopepDrill[];
  securityDrills?: SecurityDrill[];
  medItems?: MedItem[];
  medMoves?: MedMove[];
}

/** Days an inspector looks past the inspection day. */
export const LOOK_AHEAD = 30;

/** Which sections each kind of inspection is about. Class is the ship and its gear, not the crew's papers. */
const SECTIONS: Record<ReadinessKind, SectionKey[]> = {
  psc: ['vesselCerts', 'equipment', 'defects', 'serviceCerts', 'rounds', 'drills', 'crew', 'rest', 'surveys', 'pms', 'qhse', 'hospital'],
  flag: ['vesselCerts', 'equipment', 'defects', 'serviceCerts', 'rounds', 'drills', 'crew', 'rest', 'surveys', 'pms', 'qhse', 'hospital'],
  class: ['vesselCerts', 'surveys', 'equipment', 'defects', 'serviceCerts', 'pms', 'rounds'],
};

/** How far back missing round records are looked for. */
const LOOK_BACK: Partial<Record<InspectionPeriod, number>> = { weekly: 4, monthly: 3, quarterly: 1 };

const DAY = 86400000;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const localIso = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * A date against the inspection day: red if it has run out by then, amber if it
 * runs out within LOOK_AHEAD days after, nothing otherwise. "Expires on the day"
 * is red — the certificate is not valid for the whole inspection.
 */
export function dateLevel(iso: string | undefined, date: string, ahead = LOOK_AHEAD): GapLevel | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = iso.slice(0, 10);
  if (d <= date) return 'red';
  if (d <= addDays(date, ahead)) return 'amber';
  return null;
}

const daysFrom = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

function dateText(iso: string, x: Pick<ReadinessInput, 'today' | 'date'>, verb = 'expires'): string {
  const d = iso.slice(0, 10);
  if (d < x.today) return `${verb === 'expires' ? 'expired' : 'was due'} ${dmy(d)}`;
  if (d === x.today) return `${verb} today`;
  if (d <= x.date) return `${verb} ${dmy(d)} — before the inspection`;
  return `${verb} ${dmy(d)} — in ${plural(daysFrom(x.today, d), 'day')}`;
}

const RANK: Record<GapLevel, number> = { red: 0, amber: 1 };
const byWorst = (a: Gap, b: Gap) => RANK[a.level] - RANK[b.level] || (a.date ?? '9').localeCompare(b.date ?? '9') || a.title.localeCompare(b.title);

export function buildReadiness(x: ReadinessInput): Readiness {
  const out: ReadinessSection[] = [];
  const want = SECTIONS[x.kind];
  const ahead = x.ahead ?? LOOK_AHEAD;
  const add = (key: SectionKey, title: string, icon: string, gaps: Gap[]) => {
    if (want.includes(key)) out.push({ key, title, icon, gaps: gaps.sort(byWorst) });
  };
  const ref = new Date(`${x.today}T12:00:00`);

  // ---- Vessel certificates ----
  {
    const gaps: Gap[] = [];
    for (const c of x.certificates.filter((v) => v.scope === 'vessel')) {
      const l = dateLevel(c.expiryDate, x.date, ahead);
      if (l) gaps.push({ key: `vc:${c.id}`, level: l, date: c.expiryDate, title: c.name, sub: dateText(c.expiryDate!, x), route: 'CertificateDetail', params: { id: c.id } });
    }
    add('vesselCerts', 'Vessel certificates', 'certificate-outline', gaps);
  }

  // ---- Equipment: every item that is out of date on the day ----
  {
    const gaps: Gap[] = [];
    for (const it of x.flat) {
      const d = complianceDate(it);
      const l = dateLevel(d, x.date, ahead);
      if (!l) continue;
      const name = [it.type, it.no ? `No ${it.no}` : null, it.serial ? `S/N ${it.serial}` : null].filter(Boolean).join(' · ') || 'Item';
      const where = [it.deck, it.position].filter(Boolean).join(', ');
      gaps.push({
        key: `eq:${it.id}`, level: l, date: d, route: 'ItemDetail', params: { category: it.category, id: it.id },
        title: `${x.labelOf(it.category)} — ${name}`,
        sub: [dateText(d!, x, it.expiry && d === it.expiry ? 'expires' : 'is due'), where || null].filter(Boolean).join(' · '),
      });
    }
    add('equipment', 'Safety equipment (LSA / FFE)', 'lifebuoy', gaps);
  }

  // ---- Open defects found on inspections ----
  {
    const gaps: Gap[] = openDefects(x.inspections).map((i) => ({
      key: `def:${i.id}`, level: 'red' as GapLevel, date: localIso(i.at), route: 'InspectionDetail', params: { id: i.id },
      title: `${x.labelOf(i.category)} — ${[i.item?.type, i.item?.no ? `No ${i.item.no}` : null].filter(Boolean).join(' · ') || 'defect'}`,
      sub: `${i.defect!.note || 'Defect'} · open since ${dmy(localIso(i.at))}`,
    }));
    add('defects', 'Open defects', 'alert-octagon-outline', gaps);
  }

  // ---- Service certificates of equipment (liferaft, extinguisher servicing…) ----
  {
    const gaps: Gap[] = [];
    for (const c of x.certificates.filter((v) => (v.scope ?? 'equipment') === 'equipment')) {
      const l = dateLevel(c.expiryDate, x.date, ahead);
      if (l) gaps.push({ key: `ec:${c.id}`, level: l, date: c.expiryDate, title: c.name, sub: dateText(c.expiryDate!, x), route: 'CertificateDetail', params: { id: c.id } });
    }
    add('serviceCerts', 'Service certificates', 'wrench-clock', gaps);
  }

  // ---- Rounds: past periods with items never inspected, and the current one ----
  {
    const gaps: Gap[] = [];
    const name: Record<InspectionPeriod, string> = { weekly: 'Weekly round', monthly: 'Monthly round', quarterly: 'Quarterly round', annual: 'Annual round' };
    for (const p of ['weekly', 'monthly', 'quarterly'] as InspectionPeriod[]) {
      const owing = x.flat.filter((it) => x.periodsOf(it.category).includes(p));
      if (!owing.length) continue;
      const mine = x.inspections.filter((i) => i.period === p);
      // Only periods since the vessel began this round in the app: a ship that started
      // in September has no August record to show, and that is not a gap.
      const first = mine.reduce((m, i) => Math.min(m, i.at), Infinity);
      const missing = (w: { from: number; to: number }) => owing.filter((it) => !mine.some((i) => i.itemId === it.id && i.at >= w.from && i.at < w.to)).length;
      const cur = windowFor(p, ref);
      let back = ref;
      for (let k = 0; k < (LOOK_BACK[p] ?? 0); k++) {
        back = stepPeriod(p, back, -1);
        const w = windowFor(p, back);
        if (w.to <= first) break;
        const m = missing(w);
        if (m) gaps.push({ key: `rnd:${p}:${w.from}`, level: 'red', date: localIso(w.from), route: 'Rounds', title: `${name[p]} — ${w.label}`, sub: `${m} of ${owing.length} items have no record` });
      }
      const m = missing(cur);
      if (m && Number.isFinite(first)) gaps.push({ key: `rnd:${p}:now`, level: 'amber', date: localIso(cur.from), route: 'Rounds', title: `${name[p]} — ${cur.label} (current)`, sub: `${m} of ${owing.length} items still to inspect` });
      if (!Number.isFinite(first)) gaps.push({ key: `rnd:${p}:never`, level: 'red', route: 'Rounds', title: `${name[p]} — never recorded`, sub: `${owing.length} ${owing.length === 1 ? 'item owes' : 'items owe'} it` });
    }
    add('rounds', 'Inspection rounds', 'clipboard-check-outline', gaps);
  }

  // ---- Drills ----
  if (x.on('drills')) {
    const gaps: Gap[] = [];
    for (const r of drillSchedule(x.drills ?? [], x.date, x.sopepDrills ?? [], x.securityDrills ?? [])) {
      if (!r.everyDays) continue;
      const left = r.left ?? -1;
      const params = r.own ? { id: 'new', type: 'other', title: r.own.title } : { id: 'new', type: r.type };
      if (left < 0) gaps.push({ key: `drl:${r.type}`, level: 'red', date: r.due, route: 'Drill', params, title: `${r.title} drill`, sub: r.last ? `last held ${dmy(r.last)} — overdue on the day` : `none recorded · ${r.reg}` });
      else if (left <= ahead) gaps.push({ key: `drl:${r.type}`, level: 'amber', date: r.due, route: 'Drill', params, title: `${r.title} drill`, sub: `due ${dmy(r.due!)} — in ${plural(daysFrom(x.today, r.due!), 'day')}` });
    }
    add('drills', 'Drills', 'run-fast', gaps);
  }

  // ---- Crew certificates ----
  if (x.on('crewCerts')) {
    const gaps: Gap[] = [];
    const aboard = new Set(x.crew.filter(isAboard).map((m) => m.id));
    for (const c of x.certificates.filter((v) => v.scope === 'crew' && v.crewId && aboard.has(v.crewId))) {
      const l = dateLevel(c.expiryDate, x.date, ahead);
      const who = x.crew.find((m) => m.id === c.crewId);
      if (l) gaps.push({ key: `cc:${c.id}`, level: l, date: c.expiryDate, title: `${who?.name ?? c.holderName ?? 'Crew'} — ${c.name}`, sub: dateText(c.expiryDate!, x), route: 'CertificateDetail', params: { id: c.id } });
    }
    add('crew', 'Crew certificates', 'card-account-details-outline', gaps);
  }

  // ---- Hours of rest: the last four weeks before the inspection ----
  if (x.on('rest')) {
    const gaps: Gap[] = [];
    const to = x.today < x.date ? x.today : x.date;
    const from = addDays(to, -27);
    for (const m of x.crew.filter(isAboard)) {
      const days = (x.rest ?? []).filter((d) => d.crewId === m.id);
      const sum = analyseRest(days, from, to);
      // Only from the person's first record: someone who joined last week has no month behind them.
      const firstRec = days.map((d) => d.date).sort()[0];
      const judged = firstRec ? sum.filter((s) => s.date >= firstRec) : [];
      const broken = judged.filter((s) => s.violations.length).length;
      const blank = judged.filter((s) => !s.recorded && s.date < x.today).length;
      if (broken) gaps.push({ key: `rest:${m.id}:v`, level: 'red', route: 'HoursOfRest', params: { crewId: m.id }, title: `${m.name} — rest below the minimum`, sub: `${plural(broken, 'day')} in the last 4 weeks · MLC / STCW` });
      if (blank) gaps.push({ key: `rest:${m.id}:b`, level: 'amber', route: 'HoursOfRest', params: { crewId: m.id }, title: `${m.name} — hours not recorded`, sub: `${plural(blank, 'day')} without a record` });
      if (!firstRec) gaps.push({ key: `rest:${m.id}:n`, level: 'amber', route: 'HoursOfRest', params: { crewId: m.id }, title: `${m.name} — no hours of rest recorded` });
    }
    add('rest', 'Hours of rest', 'bed-clock', gaps);
  }

  // ---- Surveys & audits ----
  if (x.on('surveys')) {
    const gaps: Gap[] = [];
    for (const s of (x.surveys ?? []).filter((v) => !v.deleted)) {
      const st = surveyStatus(s, x.date, x.surveysDone ?? []);
      if (st.state === 'overdue') gaps.push({ key: `sv:${s.id}`, level: 'red', date: st.closes, route: 'Surveys', title: s.name, sub: `window closes ${dmy(st.closes)} — not carried out` });
      else if (st.state === 'open' && st.days <= ahead) gaps.push({ key: `sv:${s.id}`, level: 'amber', date: st.closes, route: 'Surveys', title: s.name, sub: `window open until ${dmy(st.closes)}` });
    }
    add('surveys', 'Surveys & audits', 'calendar-check-outline', gaps);
  }

  // ---- Planned maintenance ----
  if (x.on('pms')) {
    const gaps: Gap[] = [];
    const byId = new Map((x.machines ?? []).map((m) => [m.id, m]));
    const crit: Gap[] = [];
    let other = 0;
    for (const j of (x.pmsJobs ?? []).filter((v) => !v.deleted)) {
      const m = byId.get(j.machineId);
      if (!m) continue;
      if (jobDue(j, m, x.date, activeDeferral(j, x.pmsDeferrals ?? [])).status !== 'expired') continue;
      if (m.critical) crit.push({ key: `pms:${j.id}`, level: 'red', route: 'Maintenance', title: `${m.name} — ${j.title}`, sub: 'critical equipment · overdue on the day' });
      else other++;
    }
    gaps.push(...crit);
    if (other) gaps.push({ key: 'pms:other', level: 'amber', route: 'Maintenance', title: `${plural(other, 'maintenance job')} overdue on the day`, sub: 'non-critical equipment' });
    for (const d of (x.pmsDefects ?? []).filter((v) => !v.closed && (v.category === 'safety' || v.category === 'class'))) {
      gaps.push({ key: `pmsd:${d.id}`, level: 'red', date: d.date, route: 'Maintenance', title: `${d.machineName} — ${d.category === 'class' ? 'class-affecting' : 'safety-critical'} defect`, sub: d.description });
    }
    add('pms', 'Planned maintenance', 'engine-outline', gaps);
  }

  // ---- Non-conformities ----
  if (x.on('qhse')) {
    const gaps: Gap[] = [];
    for (const nc of x.ncs ?? []) {
      const st = ncState(nc, x.date);
      if (st === 'overdue') gaps.push({ key: `nc:${nc.id}`, level: 'red', route: 'Nc', params: { id: nc.id }, title: `${nc.no} ${nc.title}`, sub: 'corrective action past its date' });
      else if (st === 'open' || st === 'ready') gaps.push({ key: `nc:${nc.id}`, level: 'amber', route: 'Nc', params: { id: nc.id }, title: `${nc.no} ${nc.title}`, sub: st === 'ready' ? 'actions done — to be closed by the Master' : 'open' });
    }
    add('qhse', 'Non-conformities', 'clipboard-alert-outline', gaps);
  }

  // ---- Medicine chest ----
  if (x.on('hospital')) {
    const gaps: Gap[] = [];
    for (const r of chestStatus(x.medItems ?? [], x.medMoves ?? [], x.date)) {
      const label = `${r.item.name}${r.item.strength ? ` ${r.item.strength}` : ''}`;
      if (r.expired > 0) gaps.push({ key: `med:${r.item.id}`, level: 'red', route: 'Hospital', params: { view: 'register' }, title: label, sub: `${r.expired} ${r.item.unit} out of date on the day — land ashore` });
      else if (r.item.required > 0 && r.usable <= 0) gaps.push({ key: `med:${r.item.id}`, level: 'red', route: 'Hospital', params: { view: 'register' }, title: label, sub: 'none aboard of a required item' });
    }
    add('hospital', 'Medicine chest', 'medical-bag', gaps);
  }

  const all = out.flatMap((s) => s.gaps);
  return { kind: x.kind, date: x.date, today: x.today, sections: out, red: all.filter((g) => g.level === 'red').length, amber: all.filter((g) => g.level === 'amber').length };
}

/** One line for the head of the screen and the PDF. */
export function verdict(r: Readiness): string {
  if (!r.red && !r.amber) return 'Ready — nothing found';
  if (!r.red) return `Ready — ${plural(r.amber, 'point')} to look at`;
  return `Not ready — ${plural(r.red, 'finding')}${r.amber ? `, ${plural(r.amber, 'point')} to look at` : ''}`;
}

/** The PDF / Excel table of one section. */
export const READINESS_HEAD = ['', 'What', 'Detail', 'Date'];
export function sectionRows(s: ReadinessSection): string[][] {
  return s.gaps.map((g) => [g.level === 'red' ? 'FINDING' : 'Check', g.title, g.sub ?? '', g.date ? dmy(g.date) : '']);
}

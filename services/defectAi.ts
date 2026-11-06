// ===================================
// A machinery defect diagnosed by the AI (plan AI-6, 6 Nov 2026): for an open
// defect, what the machine's own records say — its earlier defects and those
// of its sister units (same maker and model), the work signed on it, the jobs
// due or overdue, the spares that fit it and their stock, the oil analyses —
// read into likely causes, checks in order, parts that may be needed and
// earlier cases alike. Guidance for the engineer on PmsDefectSc; nothing is
// saved by it. The checks may become a one-off job's notes, which the plan's
// keeper reads and saves on the job screen. Pure.
//
// Names stay aboard (services/incidentAi scrubNames): who raised, did or
// closed anything does not go; every text goes through the name replacement.
// Keys the model makes up are dropped; earlier defects are shown as the app
// holds them, never as the model retells them.
// ===================================

import type { Machine, PmsDefect, PmsDeferral, PmsDone, PmsJob } from '../types/pms';
import { hasCounter } from '../types/pms';
import type { SparePart } from '../types/spares';
import type { OilPoint, OilSample } from '../types/oil';
import { COMPARTMENT_LABEL } from '../types/oil';
import { assess, previousResult } from './oil';
import { activeDeferral, hoursPerDay, jobDue } from './pms';
import { downtimeDays } from './critEq';
import { Person, scrubNames } from './incidentAi';

export const MAX_PAST_DEFECTS = 40;
export const MAX_WORK = 60;
export const MAX_JOBS = 60;
export const MAX_PARTS = 80;
export const MAX_SEEN = 2000;

const norm = (s?: string) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** The same maker and model, both given: the PS and SB generators, the two fire pumps. */
export function sisters(m: Machine, machines: Machine[]): Machine[] {
  if (!norm(m.maker) || !norm(m.model)) return [];
  return machines.filter((x) => x.id !== m.id && !x.deleted && norm(x.maker) === norm(m.maker) && norm(x.model) === norm(m.model));
}

/** An interval in English, for the model (the screens' labels are in the interface language). */
const every = (j: Pick<PmsJob, 'intervalHours' | 'intervalDays' | 'oneOff' | 'dueDate' | 'dueHours'>) =>
  j.oneOff
    ? `one-off${j.dueDate ? ` by ${j.dueDate}` : ''}${j.dueHours != null ? ` at ${j.dueHours} h` : ''}`
    : [j.intervalHours ? `${j.intervalHours} h` : '', j.intervalDays ? `${j.intervalDays} days` : ''].filter(Boolean).join(' or ') || 'no interval';

export interface DefectAiInput {
  today: string;
  machine: { name: string; maker?: string; model?: string; counter: boolean; hours?: number; hoursPerDay?: number; critical?: boolean; installed?: string; sisters?: string[] };
  defect: { category: string; date: string; daysOpen: number; what: string; foundDoing?: string; outOfServiceDays?: number; awaitingSpares?: boolean; returnedByOffice?: string };
  /** What the engineer sees now — symptoms, alarms, readings — typed or said. */
  seen?: string;
  past: { key: string; on?: string; date: string; category: string; what: string; fix?: string; closed?: string; daysOpen?: number; outDays?: number }[];
  work: { key: string; date: string; hours?: number; job: string; unplanned?: boolean; condition?: string; note?: string; next?: string }[];
  jobs: { key: string; title: string; every: string; state: string; lastDone?: string; lastHours?: number }[];
  parts: { key: string; name: string; partNo?: string; maker?: string; stock: number; unit: string; min?: number }[];
  oil: { point: string; compartment: string; date: string; verdict: string; findings: string[] }[];
}

/** The ids under the keys, as they were when the defect was sent: a reply that waited keeps them. */
export interface DefectAiKeys {
  defects: string[];
  work: string[];
  jobs: string[];
  parts: string[];
}

export interface DefectAiData {
  defect: PmsDefect;
  machine: Machine;
  machines: Machine[];
  defects: PmsDefect[];
  done: PmsDone[];
  jobs: PmsJob[];
  deferrals: PmsDeferral[];
  spares: SparePart[];
  stock: Map<string, number>;
  oilPoints?: OilPoint[];
  oilSamples?: OilSample[];
  people: Person[];
  today: string;
}

/** What goes to the AI for one defect, and the ids under its keys. No names, no signers. */
export function defectForAi(d: DefectAiData, seen = ''): { input: DefectAiInput; keys: DefectAiKeys; replaced: number } {
  let replaced = 0;
  const s = (v: string | undefined, max: number) => {
    if (!v) return '';
    const r = scrubNames(v.trim().slice(0, max), d.people);
    replaced += r.replaced;
    return r.text;
  };
  const { machine: m, defect } = d;
  const sis = sisters(m, d.machines);
  const sisName = new Map(sis.map((x) => [x.id, x.name]));
  const rate = hoursPerDay(m.readings);

  // Its own earlier defects first, then the sister units', newest first in each.
  const newest = (a: PmsDefect, b: PmsDefect) => b.date.localeCompare(a.date) || b.at - a.at;
  const own = d.defects.filter((x) => x.machineId === m.id && x.id !== defect.id).sort(newest);
  const theirs = d.defects.filter((x) => sisName.has(x.machineId)).sort(newest);
  const pastList = [...own, ...theirs].slice(0, MAX_PAST_DEFECTS);
  const past = pastList.map((x, i) => {
    const out = x.outOfService ? downtimeDays(x, d.today) : 0;
    return {
      key: `D${i + 1}`,
      ...(sisName.has(x.machineId) ? { on: sisName.get(x.machineId)! } : {}),
      date: x.date,
      category: x.category,
      what: s(x.description, 400),
      ...(x.closed ? { fix: s(x.closed.note, 400), closed: x.closed.date, daysOpen: Math.max(0, daysBetween(x.date, x.closed.date)) } : {}),
      ...(out ? { outDays: out } : {}),
    };
  });

  const workList = d.done.filter((x) => x.machineId === m.id && !x.cancelled).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at).slice(0, MAX_WORK);
  const work = workList.map((x, i) => ({
    key: `W${i + 1}`,
    date: x.date,
    ...(x.hours != null ? { hours: x.hours } : {}),
    job: s(x.jobTitle, 120),
    ...(x.unplanned ? { unplanned: true } : {}),
    ...(x.conditionBefore || x.conditionAfter ? { condition: `${x.conditionBefore ?? '?'} → ${x.conditionAfter ?? '?'}` } : {}),
    ...(x.note ? { note: s(x.note, 300) } : {}),
    ...(x.nextNote ? { next: s(x.nextNote, 200) } : {}),
  }));

  const jobList = d.jobs.filter((j) => j.machineId === m.id && !j.deleted).slice(0, MAX_JOBS);
  const jobs = jobList.map((j, i) => {
    const due = jobDue(j, m, d.today, activeDeferral(j, d.deferrals));
    const state = due.noBaseline ? 'never done' : due.status === 'expired' ? 'overdue' : due.status === 'due' ? 'due soon' : due.status === 'ok' ? 'in date' : 'no interval';
    return {
      key: `J${i + 1}`,
      title: s(j.title, 120),
      every: every(j),
      state: due.deferred ? `${state}, deferred` : state,
      ...(j.lastDoneDate ? { lastDone: j.lastDoneDate } : {}),
      ...(j.lastDoneHours != null ? { lastHours: j.lastDoneHours } : {}),
    };
  });

  const partList = d.spares.filter((p) => !p.deleted && (p.machineIds ?? []).includes(m.id)).slice(0, MAX_PARTS);
  const parts = partList.map((p, i) => ({
    key: `P${i + 1}`,
    name: s(p.name, 120),
    ...(p.partNo ? { partNo: p.partNo.slice(0, 60) } : {}),
    ...(p.maker ? { maker: p.maker.slice(0, 60) } : {}),
    stock: d.stock.get(p.id) ?? 0,
    unit: p.unit || 'pcs',
    ...(p.minQty != null ? { min: p.minQty } : {}),
  }));

  // The last three results of each oil point on this machine, newest first.
  const oil: DefectAiInput['oil'] = [];
  for (const p of (d.oilPoints ?? []).filter((x) => x.machineId === m.id)) {
    const withResult = (d.oilSamples ?? []).filter((x) => x.pointId === p.id && x.result).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    for (const x of withResult) {
      const a = assess(p, x.result!, previousResult(x, d.oilSamples ?? []));
      oil.push({ point: s(p.name, 80), compartment: COMPARTMENT_LABEL[p.compartment] ?? p.compartment, date: x.date, verdict: x.review?.verdict ?? a.verdict, findings: a.findings.slice(0, 6).map((f) => s(f.text, 160)) });
    }
  }

  const returned = defect.office?.result === 'returned' && !defect.closed ? s(defect.office.note, 300) : '';
  const out = defect.outOfService ? downtimeDays(defect, d.today) : 0;
  const seenText = s(seen, MAX_SEEN);
  const input: DefectAiInput = {
    today: d.today,
    machine: {
      name: m.name,
      ...(m.maker ? { maker: m.maker } : {}),
      ...(m.model ? { model: m.model } : {}),
      counter: hasCounter(m),
      ...(m.hours != null ? { hours: m.hours } : {}),
      ...(rate != null ? { hoursPerDay: Math.round(rate * 10) / 10 } : {}),
      ...(m.critical ? { critical: true } : {}),
      ...(m.installed ? { installed: m.installed } : {}),
      ...(sis.length ? { sisters: sis.map((x) => x.name) } : {}),
    },
    defect: {
      category: defect.category,
      date: defect.date,
      daysOpen: Math.max(0, daysBetween(defect.date, d.today)),
      what: s(defect.description, 1000),
      ...(defect.jobTitle ? { foundDoing: s(defect.jobTitle, 120) } : {}),
      ...(out ? { outOfServiceDays: out } : {}),
      ...(defect.awaitingSpares ? { awaitingSpares: true } : {}),
      ...(returned ? { returnedByOffice: returned } : {}),
    },
    ...(seenText ? { seen: seenText } : {}),
    past,
    work,
    jobs,
    parts,
    oil,
  };
  return { input, keys: { defects: pastList.map((x) => x.id), work: workList.map((x) => x.id), jobs: jobList.map((j) => j.id), parts: partList.map((p) => p.id) }, replaced };
}

export interface DefectAiReply {
  summary?: string;
  causes?: { cause?: string; why?: string; likely?: string; refs?: unknown }[];
  checks?: { step?: string; look?: string; safety?: string; refs?: unknown }[];
  parts?: { key?: string | null; name?: string; why?: string }[];
  similar?: { key?: string; why?: string }[];
  jobs?: { key?: string; why?: string }[];
  stop?: string;
  missing?: unknown;
}

export type Likely = 'high' | 'medium' | 'low';

/** A key the AI cited, resolved to the record it stands for. */
export type Ref = { kind: 'defect' | 'work' | 'job' | 'part'; key: string; id: string };

export interface Diagnosis {
  summary: string;
  causes: { cause: string; why: string; likely: Likely; refs: Ref[] }[];
  checks: { step: string; look: string; safety: string; refs: Ref[] }[];
  /** A part from the machine's spares (with its stock), or one named that the list does not have. */
  parts: { id?: string; name: string; why: string; stock?: number; low?: boolean }[];
  /** Earlier defects alike: the record itself is shown, the model only says why. */
  similar: { id: string; why: string }[];
  jobs: { id: string; why: string }[];
  stop: string;
  missing: string[];
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const PREFIX: Record<string, Ref['kind']> = { D: 'defect', W: 'work', J: 'job', P: 'part' };

/** The reply against the keys that were sent and the records as they are now. */
export function readDiagnosis(reply: DefectAiReply, keys: DefectAiKeys, live: { defects: PmsDefect[]; jobs: PmsJob[]; spares: SparePart[]; stock: Map<string, number> }): Diagnosis {
  const lists: Record<Ref['kind'], string[]> = { defect: keys.defects, work: keys.work, job: keys.jobs, part: keys.parts };
  const resolve = (k: unknown): Ref | null => {
    const m = /^([DWJP])(\d{1,3})$/.exec(String(k ?? '').trim().toUpperCase());
    if (!m) return null;
    const kind = PREFIX[m[1]];
    const id = lists[kind][Number(m[2]) - 1];
    return id ? { kind, key: `${m[1]}${m[2]}`, id } : null;
  };
  const refs = (v: unknown): Ref[] => {
    const seen = new Set<string>();
    const out: Ref[] = [];
    for (const k of Array.isArray(v) ? v : []) {
      const r = resolve(k);
      if (r && !seen.has(r.key)) {
        seen.add(r.key);
        out.push(r);
      }
    }
    return out;
  };
  const defectIds = new Set(live.defects.map((x) => x.id));
  const jobIds = new Set(live.jobs.filter((j) => !j.deleted).map((j) => j.id));
  const parts = new Map(live.spares.filter((p) => !p.deleted).map((p) => [p.id, p]));

  const causes = (reply.causes ?? []).slice(0, 5).flatMap((c) => {
    const cause = text(c?.cause, 200);
    if (!cause) return [];
    const likely: Likely = c.likely === 'high' || c.likely === 'low' ? c.likely : 'medium';
    return [{ cause, why: text(c.why, 400), likely, refs: refs(c.refs) }];
  });
  const checks = (reply.checks ?? []).slice(0, 10).flatMap((c) => {
    const step = text(c?.step, 240);
    return step ? [{ step, look: text(c.look, 300), safety: text(c.safety, 240), refs: refs(c.refs) }] : [];
  });

  const partsOut: Diagnosis['parts'] = [];
  const partSeen = new Set<string>();
  for (const p of (reply.parts ?? []).slice(0, 8)) {
    const why = text(p?.why, 240);
    const r = resolve(p?.key);
    if (r?.kind === 'part' && parts.has(r.id)) {
      if (partSeen.has(r.id)) continue;
      partSeen.add(r.id);
      const sp = parts.get(r.id)!;
      const stock = live.stock.get(sp.id) ?? 0;
      partsOut.push({ id: sp.id, name: sp.name, why, stock, low: stock <= 0 || (sp.minQty != null && stock <= sp.minQty) });
      continue;
    }
    // A key that is not ours is dropped; a part named without one is one the list does not have.
    if (p?.key) continue;
    const name = text(p?.name, 120);
    if (name && !partSeen.has(norm(name))) {
      partSeen.add(norm(name));
      partsOut.push({ name, why });
    }
  }

  const pick = (list: { key?: string; why?: string }[] | undefined, kind: Ref['kind'], ok: Set<string>, max: number) => {
    const out: { id: string; why: string }[] = [];
    for (const x of (list ?? []).slice(0, max * 2)) {
      const r = resolve(x?.key);
      if (r?.kind === kind && ok.has(r.id) && !out.some((o) => o.id === r.id)) out.push({ id: r.id, why: text(x.why, 240) });
      if (out.length >= max) break;
    }
    return out;
  };

  return {
    summary: text(reply.summary, 800),
    causes,
    checks,
    parts: partsOut,
    similar: pick(reply.similar, 'defect', defectIds, 5),
    jobs: pick(reply.jobs, 'job', jobIds, 5),
    stop: text(reply.stop, 300),
    missing: (Array.isArray(reply.missing) ? reply.missing : []).map((q) => text(q, 200)).filter(Boolean).slice(0, 5),
  };
}

/** The checks as a one-off job's notes: English, numbered, with what confirms each and its safety note. */
export function checksAsNotes(dg: Pick<Diagnosis, 'checks'>): string {
  const lines = dg.checks.map((c, i) => `${i + 1}. ${c.step}${c.look ? ` — ${c.look}` : ''}${c.safety ? ` Safety: ${c.safety}` : ''}`);
  return `Fault finding, drafted by the AI from the machine's records, checked aboard:\n${lines.join('\n')}`;
}

export const faultJobTitle = (d: Pick<PmsDefect, 'description'>) => `Fault finding: ${d.description.trim().replace(/\s+/g, ' ').slice(0, 60)}`;

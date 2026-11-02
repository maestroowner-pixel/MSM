// ===================================
// The plan wizard (2 Nov 2026) — a new vessel's maintenance plan in one sitting,
// from the catalogue (services/pmsCatalogue.ts) instead of system by system.
//
// The steps (screens/PmsWizardSc):
//   1. the kind of vessel — motor yacht, sailing yacht, merchant — which sets
//      what is asked and how many of each are fitted by default;
//   2. how many of each system: 0 = not fitted;
//   3. each unit: its name (PS / SB, No.1…), maker, model, serial, and the
//      counter now for one with running hours;
//   4. the jobs of each system: untick what does not apply, change an interval —
//      for every unit of that system at once;
//   5. what will be added, and Create.
//
// It ADDS, never changes: a unit whose name is already on the plan is skipped,
// so running the wizard again on a vessel with a plan adds only what is new.
// Intervals are the catalogue's typical ones unless changed here; those left
// as they are say so in the job's notes, as the catalogue's always have.
// The maker and model are kept on the machine — what a maker's library will
// later match its jobs by.
//
// Pure; `npm run check:pmswizard`.
// ===================================

import type { Dept, Machine, PmsJob } from '../types/pms';
import { CATALOGUE, CatalogueSystem } from './pmsCatalogue';

export type VesselKind = 'motor' | 'sail' | 'merchant';

/** What each kind of vessel is asked about, with how many are fitted by default. */
export const KIND_SYSTEMS: Record<VesselKind, Record<string, number>> = {
  motor: {
    engine: 2, gearbox: 2, generator: 2, emergency_gen: 0, fuel: 1, seawater: 1, compressor: 1, pump: 1, watermaker: 1,
    freshwater: 1, sewage: 1, hvac: 1, electrical: 1, hydraulics: 1, fin_stabiliser: 1, gyro_stabiliser: 0, thruster: 1, steering: 1,
    anchoring: 1, crane: 1, tender: 1, toys: 1, dive: 0, exterior: 1, garage: 1, pool: 0,
    safety_systems: 1, nav: 1, gmdss: 1, galley: 1, laundry: 1, guest: 1, spa: 0, network: 1, it: 1, av: 1, hull: 1,
  },
  sail: {
    engine: 1, gearbox: 1, generator: 1, fuel: 1, seawater: 1, compressor: 0, pump: 1, watermaker: 1, freshwater: 1, sewage: 1,
    hvac: 1, electrical: 1, hydraulics: 1, gyro_stabiliser: 0, thruster: 1, steering: 1, rig: 1,
    anchoring: 1, crane: 0, tender: 1, toys: 1, dive: 0, exterior: 1, garage: 0,
    safety_systems: 1, nav: 1, gmdss: 1, galley: 1, laundry: 1, guest: 1, network: 1, it: 1, av: 1, hull: 1,
  },
  merchant: {
    me_large: 1, aux_gen_large: 3, emergency_gen: 1, boiler: 1, purifier: 2, start_air: 2, heat_exchangers: 1, fwg: 1, ows: 1,
    seawater: 1, pump: 1, sewage: 1, steering_merchant: 1, reefer: 1, electrical_merchant: 1,
    mooring_merchant: 1, cargo_cranes: 0, hatch_covers: 0, closures: 1, ladders: 1, holds_tanks: 1,
    lsa_ffe_merchant: 1, nav_merchant: 1, galley: 1, it: 1, hull: 1,
  },
};

export const MAX_UNITS = 12;

/** The systems a kind is asked about first, and the rest of the catalogue ("More systems"). */
export function systemsFor(kind: VesselKind): { asked: CatalogueSystem[]; more: CatalogueSystem[] } {
  const k = KIND_SYSTEMS[kind];
  return { asked: CATALOGUE.filter((c) => c.key in k), more: CATALOGUE.filter((c) => !(c.key in k)) };
}

export function defaultCounts(kind: VesselKind): Record<string, number> {
  return { ...KIND_SYSTEMS[kind] };
}

export interface UnitSpec {
  name: string;
  maker?: string;
  model?: string;
  serial?: string;
  /** The counter now — for a system with running hours. */
  hours?: number;
}

const short = (label: string) => label.replace(/\s*\(.*\)$/, '').replace(/\s+—.*$/, '');
const sides = (base: string, n: number) =>
  n === 1 ? [base] : n === 2 ? [`${base} PS`, `${base} SB`] : n === 3 ? [`${base} PS`, `${base} CL`, `${base} SB`] : numbered(base, n);
const numbered = (base: string, n: number) => (n === 1 ? [base] : Array.from({ length: n }, (_, i) => `${base} No.${i + 1}`));

/** The names a crew would give n units of a system: PS / SB for a pair of engines, No.1… for generators. */
export function unitNames(key: string, n: number): string[] {
  if (n <= 0) return [];
  switch (key) {
    case 'engine':
    case 'me_large':
      return sides('Main engine', n);
    case 'gearbox':
      return sides('Gearbox', n);
    case 'fin_stabiliser':
      return n === 1 ? ['Fin stabilisers'] : sides('Fin stabiliser', n);
    case 'generator':
      return numbered('Generator', n);
    case 'aux_gen_large':
      return numbered('Auxiliary generator', n);
    case 'thruster':
      return n === 1 ? ['Bow thruster'] : n === 2 ? ['Bow thruster', 'Stern thruster'] : numbered('Thruster', n);
    case 'purifier':
      return n === 2 ? ['Fuel oil purifier', 'Lube oil purifier'] : numbered('Purifier', n);
    case 'start_air':
      return numbered('Starting air compressor', n);
    default: {
      const c = CATALOGUE.find((x) => x.key === key);
      return numbered(c ? short(c.label) : key, n);
    }
  }
}

/** The units for a new count, keeping what was typed for the ones already there. */
export function resize(key: string, n: number, prev: UnitSpec[] = []): UnitSpec[] {
  const names = unitNames(key, n);
  const fresh = unitNames(key, prev.length);
  // A unit still under its default name takes the new default (Generator → Generator No.1 when a second is added).
  return names.map((name, i) => (prev[i] ? { ...prev[i], name: prev[i].name === fresh[i] ? name : prev[i].name } : { name }));
}

export const jobKey = (system: string, title: string) => `${system}|${title}`;

export interface WizardAnswers {
  kind: VesselKind;
  /** Units per catalogue system; a system with none is not fitted. */
  units: Record<string, UnitSpec[]>;
  /** Jobs left out (jobKey). */
  off: string[];
  /** Intervals changed (jobKey) — for every unit of the system. Blank = none of that kind. */
  intervals: Record<string, { hours?: number; days?: number }>;
}

export interface WizardPlan {
  machines: Machine[];
  jobs: PmsJob[];
  /** Units not added because the plan already has one by that name. */
  skipped: string[];
  /** Systems with no job left — added as machines with no jobs. */
  empty: string[];
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
export const TYPICAL_NOTE = "Typical interval — check against the maker's manual.";

/**
 * The machines and jobs the answers add to the plan. `today` dates a counter
 * reading; jobs have no last-done yet — the crew enter it, or sign the first one out.
 */
export function buildPlan(a: WizardAnswers, have: Machine[], newId: (prefix: string) => string, today: string, now: number): WizardPlan {
  const taken = new Set(have.filter((m) => !m.deleted && !m.scrapped).map((m) => norm(m.name)));
  const off = new Set(a.off);
  const machines: Machine[] = [];
  const jobs: PmsJob[] = [];
  const skipped: string[] = [];
  const empty: string[] = [];
  for (const sys of CATALOGUE) {
    const units = (a.units[sys.key] ?? []).filter((u) => u.name.trim());
    if (!units.length) continue;
    const list = sys.jobs
      .filter((j) => !off.has(jobKey(sys.key, j.title)))
      .map((j) => {
        const set = a.intervals[jobKey(sys.key, j.title)];
        const hours = sys.counter ? (set ? set.hours : j.hours) : undefined;
        const days = set ? set.days : j.days;
        return { ...j, hours, days, changed: !!set };
      })
      .filter((j) => j.hours || j.days);
    if (!list.length) empty.push(short(sys.label));
    for (const u of units) {
      const name = u.name.trim().replace(/\s+/g, ' ');
      if (taken.has(norm(name))) {
        skipped.push(name);
        continue;
      }
      taken.add(norm(name));
      const id = newId('mach');
      const opt = (k: keyof UnitSpec) => (typeof u[k] === 'string' && (u[k] as string).trim() ? { [k]: (u[k] as string).trim() } : {});
      machines.push({
        id,
        name,
        dept: sys.dept as Dept,
        counter: sys.counter,
        ...(sys.critical ? { critical: true } : {}),
        ...opt('maker'),
        ...opt('model'),
        ...opt('serial'),
        ...(sys.counter && u.hours != null && Number.isFinite(u.hours) && u.hours >= 0 ? { hours: u.hours, hoursDate: today } : {}),
        updatedAt: now,
      });
      for (const j of list) {
        jobs.push({
          id: newId('job'),
          machineId: id,
          title: j.title,
          ...(j.type ? { type: j.type } : {}),
          ...(j.hours ? { intervalHours: j.hours } : {}),
          ...(j.days ? { intervalDays: j.days } : {}),
          ...(j.changed ? {} : { notes: TYPICAL_NOTE }),
          updatedAt: now,
        });
      }
    }
  }
  return { machines, jobs, skipped, empty };
}

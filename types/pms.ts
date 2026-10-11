// ===================================
// Planned maintenance — machines, the jobs they owe, and the jobs done.
//
//   Machine     a piece of machinery with a running-hours counter: main engine,
//               generator, watermaker, compressor, pump, stabiliser…
//   PmsJob      a recurring job on one machine: "Oil and filter change, every
//               250 h or 12 months, whichever comes first".
//   PmsDone     one completion of a job — date, counter reading, who, note.
//               Append-only, like a signed inspection: a job done wrongly is
//               done again, never edited out of the history.
//
// WHY NOT IN THE REGISTER. The register is one Firestore document with a 1 MiB
// ceiling. A yacht's machinery list with its jobs runs to hundreds of records
// and the completions grow for the life of the vessel, so each kind is its own
// collection, one document per record, synced incrementally (firebaseService
// `pushDocs` / `pullDocs`).
//
// Removal is a tombstone (`deleted: true`), not a delete: a record deleted
// outright on one device comes straight back from another that still holds it.
// ===================================

export interface HoursReading {
  /** yyyy-mm-dd */
  date: string;
  hours: number;
}

/**
 * Where a system belongs on board (9 Oct 2026: "all the vessel's work, not only
 * the engine room"). A "machine" here is any system that owes recurring work —
 * a generator, the tender, the galley, the Wi-Fi — grouped by department.
 */
export type Dept = 'engineering' | 'deck' | 'safety' | 'bridge' | 'interior' | 'avit' | 'hull';

export const DEPTS: { key: Dept; label: string; icon: string }[] = [
  { key: 'engineering', label: 'Engineering', icon: 'engine' },
  { key: 'deck', label: 'Deck', icon: 'anchor' },
  { key: 'safety', label: 'Safety', icon: 'fire-extinguisher' },
  { key: 'bridge', label: 'Bridge & comms', icon: 'radar' },
  { key: 'interior', label: 'Interior', icon: 'sofa' },
  { key: 'avit', label: 'AV / IT', icon: 'lan' },
  { key: 'hull', label: 'Hull & dry dock', icon: 'ferry' },
];

export function deptOf(m: Pick<Machine, 'dept'>): Dept {
  return m.dept ?? 'engineering';
}

/** Has a running-hours counter. Machines from before departments existed were engines: yes. */
export function hasCounter(m: Pick<Machine, 'dept' | 'counter'>): boolean {
  return m.counter ?? deptOf(m) === 'engineering';
}

export interface Machine {
  id: string;
  name: string;
  /** Critical equipment (steering, propulsion, fire-fighting, safety systems): its jobs are
   *  to be done in full and on time — they cannot be deferred (11 Oct 2026). */
  critical?: boolean;
  /** Department; absent on records made before departments — read as engineering. */
  dept?: Dept;
  /** Has a running-hours counter; see hasCounter() for the default. */
  counter?: boolean;
  /** Engine room, lazarette, flybridge… */
  location?: string;
  maker?: string;
  model?: string;
  serial?: string;
  /** Last counter reading. */
  hours?: number;
  /** yyyy-mm-dd of that reading. */
  hoursDate?: string;
  /**
   * The last readings, newest last, at most READINGS_KEPT. Enough to estimate
   * hours per day (and so when an hours-based job falls due) without a growing
   * history on the document; the full history of work is in PmsDone.
   */
  readings?: HoursReading[];
  deleted?: boolean;
  updatedAt: number;
}

export interface PmsJob {
  id: string;
  machineId: string;
  title: string;
  /** What kind of job — the scope and the evidence it calls for. */
  type?: JobType;
  /** Every N running hours. */
  intervalHours?: number;
  /** Every N days (a month is entered as 30, a year as 365). */
  intervalDays?: number;
  lastDoneDate?: string;
  lastDoneHours?: number;
  /** Parts, consumables, maker's reference. */
  notes?: string;
  /** Spare parts taken from the stores each time it is done (types/spares.ts). */
  parts?: import('./spares').JobPart[];
  deleted?: boolean;
  updatedAt: number;
}

export interface PmsDone {
  id: string;
  jobId: string;
  machineId: string;
  /** Snapshots, so the history still reads after a rename or removal. */
  jobTitle: string;
  machineName: string;
  date: string;
  hours?: number;
  by: string;
  byRank?: string;
  note?: string;
  /** Epoch ms when signed. */
  at: number;
  /** How the signer confirmed — finger, face or signing PIN (services/signature.ts). Absent when not asked. */
  signedWith?: import('../services/signature').SignProof;
  /** Evidence at closure — before / after, clearances, parts replaced. Required on critical equipment. */
  photos?: import('./equipment').Attachment[];
  /** A defect found doing the job (PmsDefect.id). */
  defectId?: string;
  updatedAt: number;
}

export const READINGS_KEPT = 30;

/** Kinds of job (11 Oct 2026, after the usual class-aligned PMS). */
export type JobType = 'maintenance' | 'performance' | 'safety' | 'measurement' | 'visual' | 'calibration' | 'megger' | 'overhaul';
export const JOB_TYPE: Record<JobType, string> = {
  maintenance: 'Maintenance',
  performance: 'Performance test',
  safety: 'Safety check',
  measurement: 'Measurement',
  visual: 'Visual check',
  calibration: 'Calibration',
  megger: 'Megger (insulation) test',
  overhaul: 'Overhaul',
};

/**
 * A job deferred — moved to a later date and/or counter reading, with the
 * reason, signed by the Master. It holds for the current cycle only (until the
 * job is next done). Critical equipment is never deferred. Append-only.
 */
export interface PmsDeferral {
  id: string;
  jobId: string;
  machineId: string;
  jobTitle: string;
  machineName: string;
  /** The cycle it belongs to: `${lastDoneDate}|${lastDoneHours}` when it was deferred. */
  cycle: string;
  untilDate?: string;
  untilHours?: number;
  reason: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: import('../services/signature').SignProof;
  updatedAt: number;
}

// ---- Defects found on machinery (ISM 10.1) ----------------------------------
// Raised from a job done or from the machine; closed by an officer or the
// Master with what was done, signed. Kept, never deleted.

export type DefectCategory = 'safety' | 'class' | 'operational';
export const DEFECT_CATEGORY: Record<DefectCategory, string> = {
  safety: 'Safety-critical',
  class: 'Class-affecting',
  operational: 'Operational',
};

export interface PmsDefectClose {
  date: string;
  note: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: import('../services/signature').SignProof;
  photos?: import('./equipment').Attachment[];
}

export interface PmsDefect {
  id: string;
  machineId: string;
  machineName: string;
  jobId?: string;
  jobTitle?: string;
  /** The completion it was found in. */
  doneId?: string;
  category: DefectCategory;
  description: string;
  date: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: import('../services/signature').SignProof;
  photos?: import('./equipment').Attachment[];
  closed?: PmsDefectClose;
  updatedAt: number;
}

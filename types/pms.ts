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

export interface Machine {
  id: string;
  name: string;
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
  /** Every N running hours. */
  intervalHours?: number;
  /** Every N days (a month is entered as 30, a year as 365). */
  intervalDays?: number;
  lastDoneDate?: string;
  lastDoneHours?: number;
  /** Parts, consumables, maker's reference. */
  notes?: string;
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
  updatedAt: number;
}

export const READINGS_KEPT = 30;

// ===================================
// Documents for the Master and the officers only (15 Oct 2026): the SOPEP's own
// papers, and the Ship Security Plan — which the ISPS Code keeps from anyone
// without a need to know (ISPS A/9.7, A/9.8.1). Not the SMS library
// (types/docs.ts), which every crew member reads and signs for.
//
// Each shelf is its own list, synced only to the officers' devices (like the
// medical log); its files go to a folder of Cloud Storage that only they may
// read (storage.rules `restricted/`).
// ===================================

export type DocShelf = 'sopep' | 'ssp';

export interface OfficerDoc {
  id: string;
  title: string;
  /** Plan or document number, approval reference. */
  docNo?: string;
  revision?: string;
  /** yyyy-mm-dd issued / approved. */
  issued?: string;
  /** yyyy-mm-dd next review. */
  reviewDue?: string;
  notes?: string;
  /** A link to the officers-only folder, or (a device on its own) the file itself. */
  fileUri?: string;
  fileName?: string;
  by?: string;
  deleted?: boolean;
  updatedAt: number;
}

export const SHELF_LABEL: Record<DocShelf, string> = { sopep: 'SOPEP docs', ssp: 'Ship Security Plan' };

/** What each shelf usually holds — offered as titles, the officer attaches the file. */
export const SHELF_STARTER: Record<DocShelf, string[]> = {
  sopep: [
    'SOPEP — approved plan',
    'Coastal state contacts (Appendix 1)',
    'Port contacts (Appendix 2)',
    'Ship interest contacts (Appendix 3)',
    'Fuel and oil piping / tank plan drawings',
    'Safety data sheets — fuels and oils',
    'Oil spill reporting form',
  ],
  ssp: [
    'Ship Security Plan — approved',
    'Ship Security Assessment',
    'International Ship Security Certificate (ISSC)',
    'Declaration of Security — form',
    'Security levels 1–3: measures',
    'Restricted areas plan',
    'CSO / SSO contacts and 24-hour numbers',
    'Security equipment — maintenance and calibration',
  ],
};

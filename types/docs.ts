// ===================================
// ISM documents — the SMS and what the crew must read and sign for.
//
//   IsmDoc   one controlled document: a procedure, a circular, the Master's
//            standing orders. Text, a file (usually the PDF from the office), or
//            both. Carries its revision.
//   DocAck   "I have read and understood revision N" — one person, one
//            revision. Append-only, signed like an inspection.
//
// A NEW REVISION ASKS AGAIN. Signatures belong to the revision they were given
// for: when the office issues Rev 4, everyone who signed Rev 3 is back on the
// "not read" list, and their Rev 3 signatures stay in the history. That is what
// an auditor asks — "show me that the crew read the CURRENT procedure".
//
// Who must read: the vessel's active crew list (types/crew.ts). A signature is
// matched to a crew member by id, or by name when it was signed as a device's
// account (whose name the Master keeps the same as the crew entry).
//
// Documents are tombstoned, never deleted; signatures are never removed.
// ===================================

export type DocCategory = 'sms' | 'procedure' | 'circular' | 'orders' | 'policy' | 'form' | 'other';

export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  sms: 'SMS manual',
  procedure: 'Procedure',
  circular: 'Circular / notice',
  orders: "Master's standing orders",
  policy: 'Policy',
  form: 'Form / checklist',
  other: 'Other',
};

export interface IsmDoc {
  id: string;
  title: string;
  /** Document number in the SMS: "SMS-07-03". */
  docNo?: string;
  category: DocCategory;
  /** 1, 2, 3… — a new revision asks everyone to sign again. */
  revision: number;
  /** yyyy-mm-dd the revision was issued. */
  issued: string;
  /** yyyy-mm-dd it is next due for review (ISM 10 / company practice). */
  reviewDue?: string;
  /** The text itself, for circulars and orders written aboard. */
  body?: string;
  /**
   * The file: a Storage download URL once shared with the vessel, or a local
   * path / data URI on the device that attached it until then.
   */
  fileUri?: string;
  fileName?: string;
  /** The file is attached but not yet uploaded — only the attaching device has it (services/docFiles.ts). */
  filePending?: boolean;
  /**
   * The words inside the file (PDF text, taken when it is uploaded from a
   * computer — utils/pdfText), so a search finds a document by what it says.
   * Capped at utils/pdfText MAX_TEXT.
   */
  text?: string;
  /** False for reference documents nobody has to sign for. Default true. */
  mustRead?: boolean;
  /** Who issued or uploaded it. */
  by?: string;
  deleted?: boolean;
  updatedAt: number;
}

export interface DocAck {
  /** `${docId}_r${revision}_${personKey}` — one signature per person per revision. */
  id: string;
  docId: string;
  revision: number;
  /** Snapshot, so the history reads after a rename or removal. */
  docTitle: string;
  /** Crew id, or `device:<id>` when signed as a device's account. */
  personKey: string;
  by: string;
  byRank?: string;
  at: number;
  signedWith?: import('../services/signature').SignProof;
  updatedAt: number;
}

export function ackId(docId: string, revision: number, personKey: string): string {
  return `${docId}_r${revision}_${personKey}`.replace(/[^A-Za-z0-9_.:-]/g, '_');
}

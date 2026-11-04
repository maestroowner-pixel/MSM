// ===================================
// Discussion on a record (plan item 43, 4 Nov 2026) — a thread between the vessel
// and the office on a machinery defect, a non-conformity or a requisition. One
// document per message, so the two sides writing at once never overwrite each
// other; a message is never changed or deleted (rules: create only).
//
// The record's title is kept on the message: the Board and Fleet name the record
// without reading it, and the message still says what it was about if the
// record's module is switched off later.
//
// A mention is `@Name` (someone aboard) or `@Office`; what it notifies is read
// from the messages (services/threads). The text goes to the cloud as written —
// the screen says who reads it.
// ===================================

export type ThreadRec = 'defect' | 'nc' | 'po';
export type ThreadSide = 'vessel' | 'office';

export interface ThreadMessage {
  id: string;
  rec: ThreadRec;
  recId: string;
  title: string;
  text: string;
  by: string;
  byRank?: string;
  at: number;
  side: ThreadSide;
  /** Names mentioned, as they are on the crew list. */
  mentions?: string[];
  /** `@Office` is in the text. */
  office?: boolean;
  updatedAt?: number;
}

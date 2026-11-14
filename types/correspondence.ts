// ===================================
// The vessel's correspondence register (14 Nov 2026 — "and the correspondence"):
// what came aboard and what went ashore, the paper an ISM auditor asks for and
// the Master keeps as a "Correspondence register" in a binder on the bridge.
//
//   Letter   one item of correspondence: in or out, its number (IN-2026-001,
//            OUT-2026-001), date, from / to and who that is (the office, flag,
//            class, an agent…), subject, their reference, how it came, the
//            file itself. An incoming one may need an answer by a date; an
//            outgoing one may answer an incoming one (`replyTo`), and that
//            answers it. An incoming one can also be closed by an officer
//            without a letter ("done by phone", "acted on").
//
// The superintendent (Fleet) reads the register and sends letters to the
// vessel: they land as incoming, kind `superintendent`, numbered on the
// vessel's own IN- series. An office letter may answer one of the vessel's
// outgoing letters (`replyTo` on an incoming one) — shown both ways; what the
// vessel owes is still read from incoming letters only.
//
// One document per letter, edited as a whole, newest wins; never deleted — a
// letter entered in error is `cancelled` with a reason, so its number stays
// taken and the register has no holes. Officers and the Master only: letters
// from the owner or the office are not for every phone aboard; the office reads.
// The file travels as a link to Storage, never inside the record.
// ===================================

export type LetterDir = 'in' | 'out';

/** Who the other side is. **Ids are permanent** — they are stored. */
export type PartyKind = 'superintendent' | 'office' | 'owner' | 'flag' | 'class' | 'psc' | 'port' | 'agent' | 'charterer' | 'supplier' | 'authority' | 'other';
export const PARTY_KINDS: PartyKind[] = ['superintendent', 'office', 'owner', 'flag', 'class', 'psc', 'port', 'agent', 'charterer', 'supplier', 'authority', 'other'];
export const PARTY_EN: Record<PartyKind, string> = {
  superintendent: 'Superintendent', office: 'Company / office', owner: 'Owner', flag: 'Flag State', class: 'Class society', psc: 'Port State Control', port: 'Port / harbour master',
  agent: 'Agent', charterer: 'Charterer', supplier: 'Supplier / contractor', authority: 'Other authority', other: 'Other',
};

/** How it came or went. **Ids are permanent.** */
export type LetterVia = 'email' | 'post' | 'hand' | 'portal' | 'other';
export const LETTER_VIA: LetterVia[] = ['email', 'post', 'hand', 'portal', 'other'];
export const VIA_EN: Record<LetterVia, string> = { email: 'E-mail', post: 'Post / courier', hand: 'By hand', portal: 'Portal / system', other: 'Other' };

export interface LetterStamp {
  by: string;
  byRank?: string;
  at: number;
  note?: string;
}

export interface Letter {
  id: string;
  dir: LetterDir;
  /** IN-2026-001 / OUT-2026-001: the year of `date`, numbered per direction. Fixed once saved. */
  no: string;
  /** Received (in) or sent (out), yyyy-mm-dd. */
  date: string;
  /** From (in) or to (out). */
  party: string;
  kind: PartyKind;
  subject: string;
  /** Their reference — the circular's or the letter's own number. */
  ref?: string;
  via?: LetterVia;
  /** The letter itself: a link (Cloud Storage), or the file itself on a device on its own. */
  file?: { url: string; name: string; addedAt: number; by?: string };
  /** In: an answer or action is expected. */
  needsReply?: boolean;
  /** In: by when, yyyy-mm-dd. */
  replyBy?: string;
  /** In: who aboard is to act on it (a rank or a name). */
  actionBy?: string;
  /** The letter of the other direction this answers: out → an incoming one; in (from the office) → one of ours. */
  replyTo?: string;
  /** In: closed without a letter of ours — the note says how. */
  closed?: LetterStamp;
  notes?: string;
  /** Who entered it. */
  by: string;
  byRank?: string;
  /** Entered in error: the number stays taken, the note says why. */
  cancelled?: LetterStamp;
  createdAt: number;
  updatedAt: number;
}

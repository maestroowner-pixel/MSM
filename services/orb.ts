// ===================================
// Oil Record Book Part I — the line an entry reads as, with the item numbers of
// the form, and what each code asks for. Pure, tested (check:orb).
// ===================================

import { ORB_METHOD, OrbCode, OrbEntry } from '../types/orb';

const q = (n?: number, unit: 'm3' | 't' = 'm3') => (n == null ? '' : `${Math.round(n * 1000) / 1000} ${unit === 't' ? 't' : 'm³'}`);
const j = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join('; ');

/** The fields a code needs, for the form. */
export const ORB_FIELDS: Record<OrbCode, ('tank' | 'quantity' | 'retained' | 'method' | 'place' | 'start' | 'stop' | 'grade' | 'bdnNo' | 'receiptNo')[]> = {
  A: ['tank', 'quantity', 'place'],
  B: ['tank', 'quantity', 'method', 'place', 'start', 'stop'],
  C: ['tank', 'retained', 'quantity', 'method', 'place', 'receiptNo'],
  D: ['tank', 'quantity', 'method', 'place', 'start', 'stop', 'receiptNo'],
  E: ['tank', 'place', 'start', 'stop'],
  F: ['start', 'stop'],
  G: ['quantity', 'place'],
  H: ['place', 'grade', 'quantity', 'tank', 'bdnNo'],
  I: [],
};

/** What is still missing for the entry to be a proper book entry. */
export function orbProblem(e: Pick<OrbEntry, 'code' | 'tank' | 'quantity' | 'retained' | 'method' | 'place' | 'start' | 'stop' | 'grade' | 'remarks'>): string | null {
  switch (e.code) {
    case 'A':
      return !e.tank ? 'Name the tank(s).' : null;
    case 'B':
      return !e.tank || e.quantity == null ? 'Tank and quantity are needed.' : null;
    case 'C':
      if (!e.tank) return 'Name the sludge / residue tank.';
      if (e.retained == null && e.quantity == null) return 'Give the quantity retained (C 11) or disposed of (C 12).';
      if (e.quantity != null && !e.method) return 'Say how it was disposed of (C 12).';
      return null;
    case 'D':
      if (!e.tank || e.quantity == null) return 'Tank and quantity of bilge water are needed (D 13).';
      if (!e.start || !e.stop) return 'Time of start and stop (D 14).';
      if (!e.method) return 'Method of discharge or disposal (D 15).';
      if (e.method === 'ows' && !e.place) return 'Ship’s position at start and stop (D 15.1).';
      return null;
    case 'E':
      return !e.start ? 'Time the system was put into automatic mode.' : null;
    case 'F':
      return !e.start ? 'Time of failure (F 19).' : !e.remarks ? 'Say what failed and why (F 21).' : null;
    case 'G':
      return !e.remarks ? 'Describe the circumstances, the oil and the action taken.' : null;
    case 'H':
      return !e.place || !e.grade || e.quantity == null || !e.tank ? 'Port, grade, quantity and the tank(s) bunkered into (H 26).' : null;
    case 'I':
      return !e.remarks ? 'Write the remark.' : null;
  }
}

/** The record of operations as written in the book, with the form's item numbers. */
export function orbText(e: Omit<OrbEntry, 'text' | 'id' | 'by' | 'at' | 'updatedAt'>): string {
  const m = e.method ? ORB_METHOD[e.method] : '';
  const span = e.start && e.stop ? `${e.start}–${e.stop}` : e.start ?? '';
  switch (e.code) {
    case 'A':
      return j([`1. ${e.tank}`, '2. cleaned / ballasted', e.quantity != null && `3. ${q(e.quantity)}`, e.place && `position / port ${e.place}`, e.remarks]);
    case 'B':
      return j([`5. ${e.tank}`, e.place && `6. ${e.place}`, span && `6. ${span}`, `8. ${q(e.quantity)}`, m && `9. ${m}`, e.remarks]);
    case 'C':
      return j([e.retained != null && `11.1 ${e.tank}; 11.2 retained ${q(e.retained)}`, e.quantity != null && `12. ${q(e.quantity)} from ${e.tank}${m ? ` — ${m}` : ''}${e.place ? `, ${e.place}` : ''}${e.receiptNo ? `, receipt ${e.receiptNo}` : ''}`, e.remarks]);
    case 'D':
      return j([`13. ${q(e.quantity)} from ${e.tank}`, `14. ${span}`, `15. ${m}${e.place ? ` — ${e.place}` : ''}${e.receiptNo ? `, receipt ${e.receiptNo}` : ''}`, e.remarks]);
    case 'E':
      return j([`16. automatic mode ${e.start ?? ''}${e.tank ? ` (${e.tank})` : ''}${e.place ? `, ${e.place}` : ''}`, e.stop && `18. manual ${e.stop}`, e.remarks]);
    case 'F':
      return j([`19. failure ${e.start ?? ''}`, e.stop && `20. operational ${e.stop}`, e.remarks && `21. ${e.remarks}`]);
    case 'G':
      return j([e.place && `22. ${e.place}`, e.quantity != null && `23. ${q(e.quantity)}`, e.remarks && `24–25. ${e.remarks}`]);
    case 'H':
      return j([`26.1 ${e.place}`, `26.2 ${e.grade}, ${q(e.quantity, e.unit ?? 'm3')} into ${e.tank}`, e.bdnNo && `BDN ${e.bdnNo}`, e.remarks]);
    case 'I':
      return e.remarks ?? '';
  }
}

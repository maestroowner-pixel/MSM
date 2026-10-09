// ===================================
// What needs doing about one crew member — the warnings in the crew matrix, the
// crew list and on the person's own screen (9 Oct 2026: "if the matrix is not
// filled in, warn — data missing, a document coming due, or needing renewal").
//
// Three kinds, worst first:
//   expired   a certificate or the passport is out of date
//   due       one expires within 60 days (the app's "due soon")
//   missing   the crew list or next of kin lacks something a port, a flag or the
//             company will ask for
//
// Personal details are held only on Officers' and the Master's devices, so the
// "missing" checks on them run only where `withPrivate` is true — a deckhand's
// phone must not report everyone's passport as missing because it cannot see it.
// ===================================

import { Certificate } from '../types/certificate';
import { CrewMember, CrewPrivate } from '../types/crew';
import { isCountryCode } from '../constants/countries';
import { statusFromDate } from '../utils/dates';

export type IssueLevel = 'expired' | 'due' | 'missing';

export interface CrewIssue {
  level: IssueLevel;
  text: string;
}

const RANK: Record<IssueLevel, number> = { expired: 0, due: 1, missing: 2 };

export function crewIssues(
  m: CrewMember,
  p: CrewPrivate | undefined,
  certs: Certificate[],
  withPrivate: boolean
): CrewIssue[] {
  const out: CrewIssue[] = [];
  for (const c of certs) {
    if (c.scope !== 'crew' || c.crewId !== m.id) continue;
    const st = statusFromDate(c.expiryDate);
    if (st === 'expired') out.push({ level: 'expired', text: `${c.name} expired` });
    else if (st === 'due') out.push({ level: 'due', text: `${c.name} expires soon` });
  }
  if (!m.rank?.trim()) out.push({ level: 'missing', text: 'rank' });
  if (m.onBoard !== false && !m.signOn) out.push({ level: 'missing', text: 'date of embarkation' });
  if (m.onBoard !== false && !m.signOnPort?.trim()) out.push({ level: 'missing', text: 'port of embarkation' });
  if (withPrivate) {
    const pass = statusFromDate(p?.passportExpiry);
    if (p?.passportExpiry && pass === 'expired') out.push({ level: 'expired', text: 'passport expired' });
    else if (p?.passportExpiry && pass === 'due') out.push({ level: 'due', text: 'passport expires soon' });
    if (!p?.dateOfBirth) out.push({ level: 'missing', text: 'date of birth' });
    if (!p?.placeOfBirth?.trim()) out.push({ level: 'missing', text: 'place of birth' });
    if (!isCountryCode(p?.nationality)) out.push({ level: 'missing', text: 'nationality (2-letter code)' });
    if (!p?.passportNo?.trim()) out.push({ level: 'missing', text: 'passport number' });
    if (!p?.passportExpiry) out.push({ level: 'missing', text: 'passport expiry' });
    const k = p?.nextOfKin;
    const kinNamed = !!(k?.lastName?.trim() && k?.firstName?.trim()) || !!k?.name?.trim();
    if (!kinNamed) out.push({ level: 'missing', text: 'next of kin name' });
    if (!k?.phone?.trim()) out.push({ level: 'missing', text: 'next of kin phone' });
    if (!k?.address?.trim()) out.push({ level: 'missing', text: 'next of kin address' });
  }
  return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
}

/** The worst level present, for a coloured badge. */
export function worstIssue(issues: CrewIssue[]): IssueLevel | null {
  return issues.length ? issues[0].level : null;
}

/** "2 expired · 1 due · 5 missing" */
export function issueSummary(issues: CrewIssue[]): string {
  const n = (l: IssueLevel) => issues.filter((i) => i.level === l).length;
  return [n('expired') ? `${n('expired')} expired` : null, n('due') ? `${n('due')} due` : null, n('missing') ? `${n('missing')} missing` : null]
    .filter(Boolean)
    .join(' · ');
}

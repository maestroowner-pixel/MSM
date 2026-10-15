// ===================================
// Certificate — a document with an expiry date. Three kinds share one record:
//
//   equipment — a class/service certificate covering one or many items
//               (a "group certificate"). The original and still the default.
//   crew      — a PERSON's document: STCW, CoC, medical, passport, visa. Linked
//               to the crew list by `crewId`.
//   vessel    — the SHIP's own papers: registry, SMC, ISSC, MLC, load line.
//
// WHY ONE RECORD AND NOT THREE. A crew member's medical expires exactly the way a
// liferaft service certificate does: a number, an issuer, two dates, a scan. One
// shape means one list, one sync path (the register blob), one backup, one status
// rule and one set of reminders — and a record written before `scope` existed
// reads as `equipment`, so nothing already on a vessel changes meaning.
// ===================================

export type CertificateScope = 'equipment' | 'crew' | 'vessel';

export interface Certificate {
  /** Absent on everything written before crew/vessel certificates — read as 'equipment'. */
  scope?: CertificateScope;
  /** crew: the holder, by CrewMember.id. */
  crewId?: string;
  /**
   * crew: the holder's name at the time of saving. The crew list can lose a
   * person (removed, or never synced to this device); the certificate must still
   * say whose it is.
   */
  holderName?: string;
  id: string;
  name: string; // e.g. "Liferaft annual service certificate"
  number?: string; // certificate / report number
  issuer?: string; // servicing station / class society
  issueDate?: string; // ISO yyyy-mm-dd
  expiryDate?: string; // ISO yyyy-mm-dd — drives status
  fileUri?: string; // persisted file (PDF / image) in the document directory
  fileName?: string;
  fileKind?: 'photo' | 'document';
  itemIds: string[]; // equipment items covered by this certificate
  /** vessel: how its surveys run (services/certSurveys.ts); chosen when they are planned. */
  surveyScheme?: import('../services/certSurveys').SurveyScheme;
  createdAt: number;
  updatedAt: number;
}

export function scopeOf(c: Pick<Certificate, 'scope'>): CertificateScope {
  return c.scope ?? 'equipment';
}

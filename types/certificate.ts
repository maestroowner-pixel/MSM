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

/**
 * The number and scan of a crew member's identity or medical document, apart from
 * the certificate (6 Nov 2026, plan item 60). The certificate travels in the
 * register, which every device and the shore read; a passport number and a scan
 * do not belong there, so they live in `cert_private`, which firestore.rules opens
 * to Officers and the Master only. The type, holder and dates stay in the register:
 * the matrix and the reminders need them. Same id as the certificate.
 */
export interface CertPrivate {
  id: string;
  crewId?: string;
  number?: string;
  fileUri?: string;
  fileName?: string;
  fileKind?: 'photo' | 'document';
  updatedAt: number;
}

/** The same words as functions/closedCerts.js (npm run check:closedcerts). Medical First Aid and Medical Care are training, not health. */
export const CLOSED_CERT_SOURCE = "passport|pasaporte|passaporte|passeport|reisepass|паспорт|seaman|seafarer'?s? (book|medical)|discharge book|libreta|sjømannsbok|\\bvisa\\b|виза|віза|eng ?1\\b|medical (fitness|certificate|exam)|fit(ness)? for duty|медкомисс|медична довідка|медицинская справка";
const CLOSED_CERT = new RegExp(CLOSED_CERT_SOURCE, 'i');

export function isClosedCert(c: Pick<Certificate, 'scope' | 'name'>): boolean {
  return c.scope === 'crew' && CLOSED_CERT.test(c.name ?? '');
}

/** A certificate as the register may carry it, and what is kept apart. Nothing to keep apart: `priv` is null. */
export function splitCert(c: Certificate): { lean: Certificate; priv: CertPrivate | null } {
  if (!isClosedCert(c)) return { lean: c, priv: null };
  const { number, fileUri, fileName, fileKind, ...lean } = c;
  return { lean: lean as Certificate, priv: JSON.parse(JSON.stringify({ id: c.id, crewId: c.crewId, number, fileUri, fileName, fileKind, updatedAt: c.updatedAt })) };
}

/** The certificates as an officer's screen shows them. A device without `cert_private` gets them as they are. */
export function joinCerts(list: Certificate[], privates: CertPrivate[]): Certificate[] {
  const by = new Map(privates.map((p) => [p.id, p]));
  return list.map((c) => {
    const p = by.get(c.id);
    return p ? { ...c, ...(p.number ? { number: p.number } : {}), ...(p.fileUri ? { fileUri: p.fileUri, fileName: p.fileName, fileKind: p.fileKind } : {}) } : c;
  });
}

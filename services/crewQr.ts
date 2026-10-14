// The crew card QR payload — no imports, so tests and any screen can use it.
/** The QR on a crew card — scanned at the gangway going ashore and coming back. */
export const CREW_QR_SCHEME = 'msm://crew/';
export function crewQrPayload(id: string): string {
  return `${CREW_QR_SCHEME}${id}`;
}
export function parseCrewQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= CREW_QR_SCHEME.length) return null;
  if (s.slice(0, CREW_QR_SCHEME.length).toLowerCase() !== CREW_QR_SCHEME) return null;
  return s.slice(CREW_QR_SCHEME.length).trim() || null;
}

/** A SOPEP locker's label — scanned, it opens what is in that locker (types/sopep.ts). */
export const SOPEP_QR_SCHEME = 'msm://sopep/';
export function sopepQrPayload(id: string): string {
  return `${SOPEP_QR_SCHEME}${id}`;
}
export function parseSopepQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= SOPEP_QR_SCHEME.length) return null;
  if (s.slice(0, SOPEP_QR_SCHEME.length).toLowerCase() !== SOPEP_QR_SCHEME) return null;
  return s.slice(SOPEP_QR_SCHEME.length).trim() || null;
}

/**
 * A visitor pass — reusable, numbered ("VISITOR 07"), kept at the gangway. The
 * watch hands it over at sign-on; scanned when it comes back, it signs off
 * whoever holds it (screens/ScanSc).
 */
export const PASS_QR_SCHEME = 'msm://pass/';
export function passQrPayload(no: string): string {
  return `${PASS_QR_SCHEME}${no}`;
}
export function parsePassQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= PASS_QR_SCHEME.length) return null;
  if (s.slice(0, PASS_QR_SCHEME.length).toLowerCase() !== PASS_QR_SCHEME) return null;
  return s.slice(PASS_QR_SCHEME.length).trim() || null;
}
/** "7" and "07" are the same pass. */
export const samePass = (a?: string, b?: string) => !!a && !!b && a.trim().replace(/^0+(?=\d)/, '').toUpperCase() === b.trim().replace(/^0+(?=\d)/, '').toUpperCase();

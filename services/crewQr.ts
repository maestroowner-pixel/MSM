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

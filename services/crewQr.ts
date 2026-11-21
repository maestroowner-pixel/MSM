// QR payloads (an equipment label, a crew card and the rest) — no imports, so tests and any screen can use them.
/** The private URI scheme every MSM-printed label carries. Matches app.json. */
export const QR_SCHEME = 'msm://item/';

/** The QR payload for an item. The id is permanent, so the payload is too. */
export function itemQrPayload(id: string): string {
  return `${QR_SCHEME}${id}`;
}

/**
 * Read a scanned string back as an item id, or null if it is not one of ours.
 *
 * The scheme is matched case-insensitively (a scanner or a QR generator may
 * normalise it), but the id is returned verbatim — `uid()` mixes base-36 digits
 * whose case is significant, and lowercasing an id would silently fail to match.
 */
export function parseItemQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= QR_SCHEME.length) return null;
  if (s.slice(0, QR_SCHEME.length).toLowerCase() !== QR_SCHEME) return null;
  const id = s.slice(QR_SCHEME.length).trim();
  return id || null;
}

/**
 * A manual label (21 Nov 2026): the same item, but scanned (or tapped as a tag) it
 * opens the item's manual straight away — for a crane cabin or an engine room
 * panel. The item's own label still opens the card: that is the scan before signing.
 */
export const MANUAL_QR_SCHEME = 'msm://manual/';
export function manualQrPayload(id: string): string {
  return `${MANUAL_QR_SCHEME}${id}`;
}
export function parseManualQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= MANUAL_QR_SCHEME.length) return null;
  if (s.slice(0, MANUAL_QR_SCHEME.length).toLowerCase() !== MANUAL_QR_SCHEME) return null;
  return s.slice(MANUAL_QR_SCHEME.length).trim() || null;
}

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
 * A line of the medicine chest (types/hospital.ts MedItem) — scanned, it opens the
 * item. Marine Hospital Manager joined to the vessel prints the same payload with
 * the same id (17 Nov 2026), so one sticker on a box works in both apps.
 */
export const MED_QR_SCHEME = 'msm://med/';
export function medQrPayload(id: string): string {
  return `${MED_QR_SCHEME}${id}`;
}
export function parseMedQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= MED_QR_SCHEME.length) return null;
  if (s.slice(0, MED_QR_SCHEME.length).toLowerCase() !== MED_QR_SCHEME) return null;
  return s.slice(MED_QR_SCHEME.length).trim() || null;
}

/** A store's label (types/stores.ts StoreRoom) — scanned, it opens that store's list. */
export const STORE_QR_SCHEME = 'msm://store/';
export function storeQrPayload(id: string): string {
  return `${STORE_QR_SCHEME}${id}`;
}
export function parseStoreQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= STORE_QR_SCHEME.length) return null;
  if (s.slice(0, STORE_QR_SCHEME.length).toLowerCase() !== STORE_QR_SCHEME) return null;
  return s.slice(STORE_QR_SCHEME.length).trim() || null;
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

/** A security round checkpoint's label (types/patrols.ts) — scanned on a round, it records the visit. */
export const CHECKPOINT_QR_SCHEME = 'msm://checkpoint/';
export function checkpointQrPayload(id: string): string {
  return `${CHECKPOINT_QR_SCHEME}${id}`;
}
export function parseCheckpointQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= CHECKPOINT_QR_SCHEME.length) return null;
  if (s.slice(0, CHECKPOINT_QR_SCHEME.length).toLowerCase() !== CHECKPOINT_QR_SCHEME) return null;
  return s.slice(CHECKPOINT_QR_SCHEME.length).trim() || null;
}

/** A key tag (types/keys.ts) — scanned, it opens the key to sign it out or back. */
export const KEY_QR_SCHEME = 'msm://key/';
export function keyQrPayload(id: string): string {
  return `${KEY_QR_SCHEME}${id}`;
}
export function parseKeyQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= KEY_QR_SCHEME.length) return null;
  if (s.slice(0, KEY_QR_SCHEME.length).toLowerCase() !== KEY_QR_SCHEME) return null;
  return s.slice(KEY_QR_SCHEME.length).trim() || null;
}

/** A muster station's tag or sign (types/muster.ts) — tapped or scanned during a muster, it says where the phone is. */
export const MUSTER_QR_SCHEME = 'msm://muster/';
export function musterQrPayload(id: string): string {
  return `${MUSTER_QR_SCHEME}${id}`;
}
export function parseMusterQr(payload: string): string | null {
  const s = payload.trim();
  if (s.length <= MUSTER_QR_SCHEME.length) return null;
  if (s.slice(0, MUSTER_QR_SCHEME.length).toLowerCase() !== MUSTER_QR_SCHEME) return null;
  return s.slice(MUSTER_QR_SCHEME.length).trim() || null;
}

// ===================================
// Roles — and, unlike the version this is modelled on, roles the SERVER enforces.
//
// Read `firestore.rules` alongside this. Every device used to sign into the one
// shared vessel account with the connection password, so the rules could only ask
// "does the uid match" — they could not tell an approved phone from a revoked one,
// a deckhand from the master, or the app from a script written by somebody who
// had been told the password once. Roles were an arrangement between colleagues.
//
// Now a device gets its OWN token from `functions/index.js`, carrying the vessel,
// its role, its approval and its device id as claims, and the rules are written
// against those. A promotion means a new token; nothing on the device can be
// edited into one. That is what makes "issue an account" mean something here.
//
// Ported from DEM/NSeaStoreManager (`/Users/DEM/types/role.ts`), whose own comment
// says the checks belong in the UI "until each person has their own account and
// the role becomes a custom claim the rules can test". This is that step.
// ===================================

/**
 * `shore` is a superintendent in the office: not a device aboard, but a fleet
 * console account a Master lets into this vessel (functions/index.js
 * `enrolShore`). It never holds a vessel token, so it ranks below Crew for
 * everything aboard; firestore.rules gives it read access and ISM documents.
 */
export type Role = 'user' | 'admin' | 'superadmin' | 'shore';

export const ROLE_LABEL: Record<Role, string> = {
  user: 'Crew',
  admin: 'Officer',
  superadmin: 'Master',
  shore: 'Superintendent (shore)',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  user: 'Records inspections and raises defects.',
  admin: 'Also approves devices and rectifies defects.',
  superadmin: 'Also issues and revokes accounts, and sets roles.',
  shore: 'From the office, in Fleet: sees this vessel, edits its documents and certificates.',
};

/**
 * Who changes the maintenance plan — adds and removes systems and jobs, sets
 * intervals, loads the plan from a template: the Master or the shore
 * superintendent (asked 11 Oct 2026). Everyone records work done and counter
 * readings. A device not enrolled is the Master's own.
 */
export function plansPms(enrolled: boolean, role: Role | null | undefined): boolean {
  return !enrolled || role === 'superadmin' || role === 'shore';
}
export const PLAN_LOCKED = 'Only the Master or the superintendent changes the plan.';

/** Highest first — the order the account list should read in. */
export const ROLE_ORDER: Role[] = ['superadmin', 'admin', 'user', 'shore'];

export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  const rank: Record<Role, number> = { shore: 0, user: 1, admin: 2, superadmin: 3 };
  return !!role && rank[role] >= rank[min];
}

/**
 * Exactly eight digits, and typed twice when set.
 *
 * Eight rather than "at least four" because this PIN is ISSUED, not chosen: a
 * four-digit minimum invites 1234 on every device in the fleet, which is the same
 * as no PIN at all. A fixed length also lets the field say plainly when it is
 * complete instead of leaving the holder guessing.
 *
 * Digits only — it is keyed on deck, often in gloves, and a case-sensitive
 * password mistyped twice at 0300 is worse than a longer numeric one.
 */
export const PIN_LENGTH = 8;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test((pin ?? '').trim());
}

/**
 * The bootstrap code is longer than an issued PIN but still DIGITS ONLY, and
 * that is a deliberate constraint on the secret rather than an accident.
 *
 * The enrolment field is a number pad because the people using it are on deck in
 * gloves; making the first device type a base64 secret there would either break
 * that or force a second, different input. So the code the server holds is
 * numeric too — 12 digits is 10^12, which against a counter that stops after 8
 * attempts in 15 minutes is not the weak link in this system.
 *
 * Found by walking the flow: the field stripped non-digits and capped at 8, so
 * the original base64 bootstrap code could not be entered at all and the first
 * device on a vessel could never enrol.
 */
export const BOOTSTRAP_LENGTH = 12;
export const BOOTSTRAP_MAX = 16;

/** Long enough to be either an issued PIN or the bootstrap code. */
export function isEnterableCode(code: string): boolean {
  const v = (code ?? '').trim();
  return /^\d+$/.test(v) && v.length >= PIN_LENGTH && v.length <= BOOTSTRAP_MAX;
}

/** A PIN generated for an invitation. Uniform digits, no leading-zero surprises. */
export function generatePin(): string {
  let out = '';
  for (let i = 0; i < PIN_LENGTH; i++) out += Math.floor(Math.random() * 10);
  return out;
}

/** One invitation: the account a Master issues to a person. */
export interface Invite {
  id: string;
  firstName: string;
  lastName: string;
  /** Readable, so a Master can look it up and read it out again. */
  pin: string;
  role: Role;
  /**
   * The person's RANK ABOARD — Third Officer, Bosun, Chief Engineer.
   *
   * Deliberately separate from `role`, which is what the app lets them do
   * (Crew / Officer / Master). A Second Engineer may hold a Crew account and a
   * cadet may be trusted with an Officer one; conflating the two would make
   * every promotion aboard a permissions change, and every permissions change
   * look like a promotion. This one is free text because ranks differ by flag,
   * company and trade, and it is what appears beside a signature.
   */
  position?: string;
  revoked?: boolean;
  createdAt: number;
  createdBy?: string;
  /** Written by the server when a device enrols on this invitation. */
  activations?: Array<{ deviceId: string; at: number; platform?: string | null }>;
}

/** A device as the vessel's register knows it. */
export interface EnrolledDevice {
  id: string;
  firstName?: string;
  lastName?: string;
  /** Rank aboard, copied from the invitation — see `Invite.position`. */
  position?: string;
  role: Role;
  approved: boolean;
  disabled?: boolean;
  platform?: string | null;
  appVersion?: string | null;
  lastSeenAt?: number;
  createdAt?: number;
  /**
   * The optional tabs this device shows (constants/access.ts `TabKey`), set by
   * the Master on the Access screen. Absent = all of them.
   */
  tabs?: string[];
  /**
   * The places this device may manage — the gear on Stores / SOPEP
   * (constants/access.ts `ManageKey`), switched on by the Master on the Access
   * screen. Absent = none.
   */
  manage?: string[];
  /** The pages under a menu entry this device does NOT show ("Security:searches"), set on the Master's page. Absent = all. */
  hidePages?: string[];
  /**
   * Retired by the server as an older connection of the same person
   * (functions/devices.js): `disabled`, hidden from the tables, and back by itself
   * the next time that install opens the app. The Master's own switch-off clears it.
   */
  retiredAt?: number;
  /** The connection kept in its place. */
  retiredFor?: string;
}

export function personName(d: { firstName?: string; lastName?: string }): string {
  return [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
}

/**
 * Older connections of the same person (15 Oct 2026). Every new browser address
 * (a preview, a port, the live site) or cleared browser storage joins as a NEW
 * device, and a reinstalled phone too; the old record stays, so the Master's
 * tables filled with five "Master Nemo · Web". Grouped by name, rank and kind of
 * device, the one seen last is kept and the rest are its older connections —
 * except this device itself, which is always the one kept in its group.
 *
 * Returns older id → the id of the connection kept.
 */
export function olderConnections(devices: EnrolledDevice[], meId?: string): Map<string, string> {
  const live = devices.filter((d) => d.approved && !d.disabled && d.role !== 'shore');
  const key = (d: EnrolledDevice) => [personName(d).toLowerCase().replace(/\s+/g, ' '), d.role, d.platform ?? ''].join('|');
  const groups = new Map<string, EnrolledDevice[]>();
  for (const d of live) {
    if (!personName(d)) continue;
    groups.set(key(d), [...(groups.get(key(d)) ?? []), d]);
  }
  const out = new Map<string, string>();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const keep = g.find((d) => d.id === meId) ?? [...g].sort((a, b) => (b.lastSeenAt ?? b.createdAt ?? 0) - (a.lastSeenAt ?? a.createdAt ?? 0))[0];
    for (const d of g) if (d.id !== keep.id) out.set(d.id, keep.id);
  }
  return out;
}

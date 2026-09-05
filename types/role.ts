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

export type Role = 'user' | 'admin' | 'superadmin';

export const ROLE_LABEL: Record<Role, string> = {
  user: 'Crew',
  admin: 'Officer',
  superadmin: 'Master',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  user: 'Records inspections and raises defects.',
  admin: 'Also approves devices and rectifies defects.',
  superadmin: 'Also issues and revokes accounts, and sets roles.',
};

/** Highest first — the order the account list should read in. */
export const ROLE_ORDER: Role[] = ['superadmin', 'admin', 'user'];

export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  const rank: Record<Role, number> = { user: 1, admin: 2, superadmin: 3 };
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
}

export function personName(d: { firstName?: string; lastName?: string }): string {
  return [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
}

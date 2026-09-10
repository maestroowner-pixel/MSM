// ===================================
// Accounts — what a Master issues, and who holds one.
//
// An "account" here is an INVITATION: a name and an eight-digit PIN that lets one
// person enrol a device. It is not a Firebase user. The device gets the identity
// (a custom token with claims), the person gets the PIN, and the Master gets a
// list they can revoke one line of without disturbing anybody else — which is the
// thing a shared connection password could never do.
//
// The PIN is stored READABLE on purpose. A Master is asked "what was my PIN
// again?" on the second day of every crew change, and an unreadable hash makes
// the only answer "I'll issue you a new one". That is why firestore.rules lets
// nobody but a Master read this collection: anyone who can read it can enrol as
// anyone in it, so the readability IS the sensitivity.
//
// Writes here are the Master's; the server writes the parts a device must not be
// able to claim about itself (role, approval, the activation journal).
// ===================================

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';

import { EnrolledDevice, Invite, Role, generatePin } from '../types/role';
import * as fb from './firebaseService';
import { uid } from '../utils/id';

const ROOT = 'safety_vessels';

function db() {
  const app = fb.firebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  return fb.firestoreDb();
}

// ---- invitations ------------------------------------------------------------

export function watchInvites(vessel: string, cb: (rows: Invite[]) => void): () => void {
  return onSnapshot(
    collection(db(), ROOT, vessel, 'invites'),
    (snap) => {
      const rows: Invite[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<Invite, 'id'>) }));
      rows.sort((a, b) => b.createdAt - a.createdAt);
      cb(rows);
    },
    (err) => console.warn('[accounts] invite listener stopped:', err?.message ?? err)
  );
}

export async function listInvites(vessel: string): Promise<Invite[]> {
  const snap = await getDocs(collection(db(), ROOT, vessel, 'invites'));
  const rows: Invite[] = [];
  snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<Invite, 'id'>) }));
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

/** Issue an account. The PIN is generated here so no two read alike. */
export async function issueInvite(
  vessel: string,
  firstName: string,
  lastName: string,
  role: Role,
  position?: string,
  issuedBy?: string
): Promise<Invite> {
  const invite: Invite = {
    id: uid('inv'),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    pin: generatePin(),
    role,
    ...(position?.trim() ? { position: position.trim() } : {}),
    createdAt: Date.now(),
    ...(issuedBy ? { createdBy: issuedBy } : {}),
    activations: [],
  };
  const { id, ...body } = invite;
  // Firestore REJECTS `undefined` outright, where most JSON stores would drop
  // the key. An optional field left unset therefore fails the whole write —
  // `createdBy` did exactly that, and the Master could not issue an account at
  // all. Stripping is done here rather than at each call site so a future
  // optional field cannot reintroduce it.
  await setDoc(doc(db(), ROOT, vessel, 'invites', id), stripUndefined(body));
  return invite;
}

/** Drop keys whose value is `undefined`, recursively. See issueInvite. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Revoke rather than delete, by default. A revoked invitation stops working
 * immediately but keeps its activation journal — which is the only record of
 * which devices were ever let in on it.
 */
export async function revokeInvite(vessel: string, inviteId: string): Promise<void> {
  await setDoc(doc(db(), ROOT, vessel, 'invites', inviteId), { revoked: true }, { merge: true });
}

export async function restoreInvite(vessel: string, inviteId: string): Promise<void> {
  await setDoc(doc(db(), ROOT, vessel, 'invites', inviteId), { revoked: false }, { merge: true });
}

/** For a mistyped name on an invitation nobody has used yet. */
export async function deleteInvite(vessel: string, inviteId: string): Promise<void> {
  await deleteDoc(doc(db(), ROOT, vessel, 'invites', inviteId));
}

/** A new PIN for the same person — when one has been read out once too often. */
export async function reissuePin(vessel: string, inviteId: string): Promise<string> {
  const pin = generatePin();
  await setDoc(doc(db(), ROOT, vessel, 'invites', inviteId), { pin, revoked: false }, { merge: true });
  return pin;
}

// ---- devices ----------------------------------------------------------------

export function watchDevices(vessel: string, cb: (rows: EnrolledDevice[]) => void): () => void {
  return onSnapshot(
    collection(db(), ROOT, vessel, 'devices'),
    (snap) => {
      const rows: EnrolledDevice[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<EnrolledDevice, 'id'>) }));
      rows.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
      cb(rows);
    },
    (err) => console.warn('[accounts] device listener stopped:', err?.message ?? err)
  );
}

/**
 * Let a waiting device in. The device does not get a session from this — it gets
 * one the next time it calls `refresh`, because claims are baked into a token
 * when it is minted.
 */
export async function approveDevice(vessel: string, deviceId: string): Promise<void> {
  await setDoc(doc(db(), ROOT, vessel, 'devices', deviceId), { approved: true }, { merge: true });
}

export async function setDeviceRole(vessel: string, deviceId: string, role: Role): Promise<void> {
  await setDoc(doc(db(), ROOT, vessel, 'devices', deviceId), { role }, { merge: true });
}

/**
 * Rename a device — the name and the rank aboard that this list, and the
 * device's own "This device" card, show.
 *
 * A device is named ONCE, when it first joins, and until now that was final:
 * the bootstrap device typed its own name and nothing could change it
 * afterwards. That is wrong for the machine every ship has — the bridge
 * computer that two officers rotate through, where "Third Officer" is the
 * honest name and whoever typed theirs into it on delivery day is not.
 *
 * It renames the DEVICE, not the person. Signatures are drawn from the crew
 * list (see CrewSc and SignerPicker), so nothing already signed changes and no
 * inspection is re-attributed by this — which is exactly why it is safe to
 * offer. Nor does it touch the invitation the device enrolled on: if that
 * device ever signs off and joins again, the invitation's name wins once more
 * (functions/index.js writes `invite?.firstName ?? firstName`). For a permanent
 * change, rename here AND reissue the invitation under the new name.
 *
 * Master-only in the UI, though firestore.rules would also let a device correct
 * its own record. Both are true and only one is worth a screen: the Master is
 * the one who knows what the machine on the bridge should be called.
 */
export async function setDeviceIdentity(
  vessel: string,
  deviceId: string,
  identity: { firstName: string; lastName: string; position?: string }
): Promise<void> {
  await setDoc(
    doc(db(), ROOT, vessel, 'devices', deviceId),
    {
      firstName: identity.firstName.trim(),
      lastName: identity.lastName.trim(),
      // Firestore rejects `undefined` outright, and "no rank" is stored as an
      // empty string everywhere else in this collection — see the enrol
      // function, which writes `position: invite?.position ?? ''` for the same
      // reason. Sending undefined here would fail the whole write.
      position: identity.position?.trim() ?? '',
    },
    { merge: true }
  );
}

/**
 * Switch a device off — a lost handset, or somebody who has left. Kept rather
 * than deleted so the record of what it did remains, and so re-enrolling on the
 * same install cannot quietly undo it.
 */
export async function disableDevice(vessel: string, deviceId: string, disabled = true): Promise<void> {
  await setDoc(doc(db(), ROOT, vessel, 'devices', deviceId), { disabled }, { merge: true });
}

export async function removeDevice(vessel: string, deviceId: string): Promise<void> {
  await deleteDoc(doc(db(), ROOT, vessel, 'devices', deviceId));
}

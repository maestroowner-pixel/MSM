// ===================================
// Enrolment against the server — the client half of functions/index.js.
//
// The app carries NO credentials. It sends the name and the PIN a Master issued,
// and the function decides. Three answers, and the differences matter:
//
//   { status: 'ok', token }   → signInWithCustomToken. The token's claims are what
//                               firestore.rules reads; a promotion means a NEW
//                               token, and nothing here can be edited into one.
//   { status: 'pending' }     → the device is registered and waiting for a Master.
//                               No session, on purpose: knowing a PIN reaches the
//                               queue and no further.
//   { status: 'reenrol' }     → registered before device secrets existed; there is
//                               no honest way to recognise it, so it types a name
//                               and PIN once more.
//
// THE DEVICE SECRET. Enrolment hands back a random string and `refresh` will not
// answer without it. It is kept in SecureStore beside the session the Firebase SDK
// already holds — the point is that it cannot be GUESSED, not that it cannot be
// taken from an unlocked phone. Device ids read `msm_<time>_<rand>`, and before
// secrets existed a caller who had never learned a PIN could have asked for a
// Master's token by enumerating them.
// ===================================

import { Platform } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from '@firebase/auth';

import { Role } from '../types/role';
import * as fb from './firebaseService';

const REGION = 'europe-west1';

export type EnrolResult =
  | {
      status: 'ok';
      role: Role;
      /** From the INVITATION, not from what was typed. */
      firstName?: string;
      lastName?: string;
    }
  | { status: 'pending'; role: Role }
  | { status: 'reenrol'; role: Role }
  /** Refused, switched off, or unreachable. `message` is meant to be shown as-is. */
  | { status: 'refused'; message: string };

interface ServerReply {
  status: 'ok' | 'pending' | 'reenrol';
  token?: string;
  role?: Role;
  firstName?: string;
  lastName?: string;
  deviceSecret?: string;
}

function callable(name: string) {
  const app = fb.firebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  return httpsCallable<Record<string, unknown>, ServerReply>(getFunctions(app, REGION), name);
}

/** Everything the server wants to know about this install. */
async function deviceFacts() {
  return {
    deviceId: await fb.getLocalDeviceId(),
    platform: Platform.OS,
    appVersion: require('../theme').APP_CONFIG.version as string,
  };
}

function refusal(e: any): EnrolResult {
  // Callable errors carry the server's message; anything else is the network.
  const message =
    e?.message && typeof e.message === 'string' && !/internal/i.test(e.message)
      ? e.message
      : 'Could not reach the server. Check the connection and try again.';
  return { status: 'refused', message };
}

/**
 * First contact: a name and the PIN the Master issued.
 *
 * `takeover` is the recovery path for the one case the queue cannot solve: the
 * vessel's only Master lost their device identity (a cleared browser, a wiped
 * phone) and is now waiting for an approval that only they could have given. It
 * requires the setup code and a deliberate confirmation — see functions/index.js.
 */
export async function enrol(
  vessel: string,
  firstName: string,
  lastName: string,
  pin: string,
  takeover = false
): Promise<EnrolResult> {
  try {
    const facts = await deviceFacts();
    const res = await callable('enrol')({ vessel, firstName, lastName, pin, takeover, ...facts });
    return await applyReply(res.data, facts.deviceId);
  } catch (e: any) {
    return refusal(e);
  }
}

/**
 * Ask again without the PIN — after being approved, or promoted. Safe to call on
 * every launch: it is how a waiting device notices it has been let in.
 */
export async function refresh(vessel: string): Promise<EnrolResult> {
  try {
    const deviceId = await fb.getLocalDeviceId();
    const deviceSecret = await fb.getDeviceSecret();
    if (!deviceSecret) return { status: 'reenrol', role: 'user' };
    const res = await callable('refresh')({ vessel, deviceId, deviceSecret });
    return await applyReply(res.data, deviceId);
  } catch (e: any) {
    return refusal(e);
  }
}

/** Store what came back and, when there is a token, take the session. */
async function applyReply(reply: ServerReply, _deviceId: string): Promise<EnrolResult> {
  if (reply.deviceSecret) await fb.saveDeviceSecret(reply.deviceSecret);
  const role = (reply.role ?? 'user') as Role;

  if (reply.status === 'ok' && reply.token) {
    const auth = fb.ensureAuth();
    await signInWithCustomToken(auth, reply.token);
    return { status: 'ok', role, firstName: reply.firstName, lastName: reply.lastName };
  }
  if (reply.status === 'reenrol') return { status: 'reenrol', role };
  return { status: 'pending', role };
}

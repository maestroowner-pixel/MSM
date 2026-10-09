// ===================================
// Shore — the superintendent's side of the fleet console (screens/FleetSc).
//
// It runs on a SECOND Firebase app ('shore'), with its own sign-in, so the same
// browser can be a vessel's device and a superintendent's console without one
// session replacing the other. The server half is functions/index.js
// (`enrolShore`, `refreshShore`, `shoreSaveCertificate`); what a shore token may
// read and write is in firestore.rules (`shore(v)`).
//
// The account's secret is kept on this device like a vessel device's: the
// device id (firebaseService.getLocalDeviceId) plus a random secret issued at
// the first sign-in. Clearing the browser's data loses it; the superintendent
// then asks a Master for a new invitation.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
// Same package as firebaseService: two copies of the auth module would not share
// the component registry, and getAuth would fail on the second.
import { Auth, getAuth, signInWithCustomToken, signOut } from '@firebase/auth';
import { Firestore, collection, doc, getDoc, getDocs, getFirestore, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';

import * as fb from './firebaseService';
import { VesselData } from './fleetSummary';
import { Certificate } from '../types/certificate';
import { CrewMember } from '../types/crew';
import { DocAck, IsmDoc } from '../types/docs';
import { EquipmentItem } from '../types/equipment';

const REGION = 'europe-west1';
const ROOT = 'safety_vessels';
const SECRET_KEY = 'msm:shore_secret';
const NAME_KEY = 'msm:shore_name';

let _app: FirebaseApp | null = null;
function app(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().find((a) => a.name === 'shore') ?? initializeApp(fb.FIREBASE_CONFIG, 'shore');
  return _app;
}
const auth = (): Auth => getAuth(app());
const db = (): Firestore => getFirestore(app());

function callable<T>(name: string) {
  return httpsCallable<Record<string, unknown>, T>(getFunctions(app(), REGION), name);
}

interface ShoreReply {
  status: 'ok' | 'none';
  token?: string;
  vessels: string[];
  deviceSecret?: string;
  firstName?: string;
  lastName?: string;
}

export interface ShoreSession {
  vessels: string[];
  name: string;
}

function message(e: any): string {
  const m = e?.message;
  return typeof m === 'string' && m && !/internal/i.test(m) ? m : 'Could not reach the server. Check the connection and try again.';
}

/** Has this browser ever joined a vessel as a superintendent? */
export async function hasShoreAccount(): Promise<boolean> {
  return !!(await AsyncStorage.getItem(SECRET_KEY));
}

/** Sign in with what this browser holds. Null when it holds nothing or no vessel is left. */
export async function resume(): Promise<ShoreSession | null> {
  const secret = await AsyncStorage.getItem(SECRET_KEY);
  if (!secret) return null;
  try {
    const r = (await callable<ShoreReply>('refreshShore')({ deviceId: await fb.getLocalDeviceId(), deviceSecret: secret })).data;
    if (r.status !== 'ok' || !r.token) return null;
    await signInWithCustomToken(auth(), r.token);
    const name = [r.firstName, r.lastName].filter(Boolean).join(' ');
    if (name) await AsyncStorage.setItem(NAME_KEY, name);
    return { vessels: r.vessels, name: name || (await AsyncStorage.getItem(NAME_KEY)) || '' };
  } catch (e: any) {
    throw new Error(message(e));
  }
}

/** Add a vessel (the first one creates the account) with the invitation a Master issued. */
export async function join(imo: string, firstName: string, lastName: string, pin: string): Promise<ShoreSession> {
  try {
    const r = (
      await callable<ShoreReply>('enrolShore')({
        vessel: imo,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        pin: pin.trim(),
        deviceId: await fb.getLocalDeviceId(),
        deviceSecret: (await AsyncStorage.getItem(SECRET_KEY)) ?? undefined,
      })
    ).data;
    if (r.deviceSecret) await AsyncStorage.setItem(SECRET_KEY, r.deviceSecret);
    if (!r.token) throw new Error('No vessel is open to this account.');
    await signInWithCustomToken(auth(), r.token);
    const name = [r.firstName, r.lastName].filter(Boolean).join(' ');
    if (name) await AsyncStorage.setItem(NAME_KEY, name);
    return { vessels: r.vessels, name };
  } catch (e: any) {
    throw new Error(message(e));
  }
}

/** Forget the account on this browser. A Master's invitation is needed to come back. */
export async function forget(): Promise<void> {
  await signOut(auth()).catch(() => {});
  await AsyncStorage.multiRemove([SECRET_KEY, NAME_KEY]);
}

// ---- reading a vessel -----------------------------------------------------------

async function list<T>(imo: string, sub: string): Promise<T[]> {
  try {
    const snap = await getDocs(collection(db(), ROOT, imo, sub));
    const out: T[] = [];
    snap.forEach((d) => out.push(d.data() as T));
    return out;
  } catch {
    // A collection whose rule is not deployed yet reads as empty, not as a failure.
    return [];
  }
}

export async function loadVessel(imo: string): Promise<VesselData> {
  const snap = await getDoc(doc(db(), ROOT, imo));
  const data: any = snap.exists() ? snap.data() : {};
  let blob: any = {};
  try {
    blob = typeof data.register === 'string' && data.register ? JSON.parse(data.register) : {};
  } catch {
    blob = {};
  }
  const items: EquipmentItem[] = Object.values(blob.categories ?? {}).flatMap((l: any) => (Array.isArray(l) ? l : []));
  const [crew, docs, acks, machines, jobs, spares, moves] = await Promise.all([
    list<CrewMember>(imo, 'crew'),
    list<IsmDoc>(imo, 'ism_docs'),
    list<DocAck>(imo, 'ism_doc_acks'),
    list<any>(imo, 'pms_machines'),
    list<any>(imo, 'pms_jobs'),
    list<any>(imo, 'spares'),
    list<any>(imo, 'spare_moves'),
  ]);
  return {
    imo,
    name: blob.vessel_info?.vessel_name || `IMO ${imo}`,
    registerAt: data.registerUpdatedAt ?? 0,
    items,
    certificates: (blob.certificates ?? []) as Certificate[],
    crew,
    docs,
    acks,
    machines,
    jobs,
    spares,
    moves,
  };
}

// ---- writing --------------------------------------------------------------------

/** One certificate, merged into the vessel's register on the server. */
export async function saveCertificate(imo: string, certificate: Partial<Certificate> & { id: string }, remove = false): Promise<void> {
  try {
    await callable('shoreSaveCertificate')({ vessel: imo, certificate, remove });
  } catch (e: any) {
    throw new Error(message(e));
  }
}

/** An ISM document, written straight to the vessel (rules: `shore(v)`). */
export async function saveDoc(imo: string, d: IsmDoc): Promise<void> {
  // Firestore refuses `undefined`; drop empty optionals.
  const clean = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined));
  await setDoc(doc(db(), ROOT, imo, 'ism_docs', d.id), clean);
}

/** Upload a file (data: URI) for a document or certificate; returns its URL. */
export async function uploadFile(imo: string, ownerId: string, fileId: string, dataUri: string): Promise<string> {
  const mime = /^data:([^;,]+)/.exec(dataUri)?.[1] ?? 'application/octet-stream';
  const r = storageRef(getStorage(app()), `${ROOT}/${imo}/attachments/${ownerId}/${fileId}`);
  await uploadString(r, dataUri, 'data_url', { contentType: mime });
  return getDownloadURL(r);
}

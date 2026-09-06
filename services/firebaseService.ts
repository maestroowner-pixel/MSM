// ===================================
// Firebase sync — FIRESTORE storage for the register, the trail and the crew.
//
// THIS FILE NO LONGER SIGNS ANYONE IN. A device gets its session from
// `services/enrolment.ts`, which calls the `enrol` / `refresh` Cloud Functions
// and receives a custom token carrying `{ vessel, role, approved, deviceId }`;
// firestore.rules is written against those claims. What lives here is the
// storage layer that runs once a session exists.
//
// Removed in Sep 2026 (~500 lines): `signInVessel` / `changeConnectionPassword`
// and the whole shared-connection-password model, the client-side device
// approval it came with (`registerDevice`, `approveDevice`, `transferMaster`,
// `resetMaster`, ghost pruning) and the Windows REST auth path that existed only
// to serve them. Two reasons it had to go rather than sit dormant. It keyed the
// register by the Firebase uid, and since enrolment that uid is per-device
// (`<imo>__<deviceId>`) — so a device reaching that path wrote the vessel's
// register to a second document beside the real one. And it enforced roles by
// agreement between colleagues; the server enforces them now, which is what
// makes revoking one person possible without changing a password for everybody.
// Device management moved to `services/accounts.ts` + Settings → Accounts.
//
// Crew still do not have personal accounts. At 0300 on a shared bridge tablet a
// forgotten password must not be able to stop a safety round — the DEVICE is
// enrolled, and accountability comes from the SIGNATURE on each inspection.
//
// The TRANSPORT was Realtime Database and is now Firestore, following the
// approach proven in DEM/NSeaStoreManager (`/Users/DEM`). What that buys:
// per-document writes, so two officers inspecting on two phones write two
// documents instead of racing for one tree; a real offline queue; and live
// `onSnapshot` updates instead of manual Push/Pull.
//
// LAYOUT — the one thing to keep in your head:
//
//   safety_vessels/{uid}                     the account document
//       register        the whole equipment register as ONE JSON string
//       masterDeviceId, entitlement, trialFirstLaunch
//   safety_vessels/{uid}/devices/{deviceId}          written by functions/accounts
//   safety_vessels/{uid}/pending_devices/{deviceId}
//   safety_vessels/{uid}/inspections/{id}    ONE DOCUMENT PER SIGNED RECORD
//   safety_vessels/{uid}/crew/{id}
//
// The register is a JSON string rather than a nested map on purpose. Firestore
// limits a document to 1 MiB and ~20k index entries, and item `extra` keys come
// from arbitrary Excel column headers — as a map those become field names and
// every one of them gets indexed. As a string it is opaque, cannot collide with
// Firestore's field-name rules, and needs none of RTDB's `~xx` key escaping.
// 627 items is roughly 125 KB, comfortably inside the cap.
//
// Inspections are NOT in that string, and must never be moved into it: the trail
// is append-only and grows for the life of the vessel (~2 MB/year at 600 items a
// month), which would hit the 1 MiB ceiling inside the first year. One document
// per record has no ceiling and — because records are immutable and carry unique
// ids — cannot conflict between devices at all.
//
// ⚠️ PASTE YOUR FIREBASE WEB CONFIG BELOW to enable cloud sync.
// Until then isConfigured() returns false and the app stays local-only.
// ===================================

// IMPORTANT: import auth from the SCOPED @firebase/auth package, NOT the umbrella
// `firebase/auth`. The umbrella's export map has no `react-native` condition, so it
// resolves the browser ESM build (references DOMException/PerformanceEntry that Hermes
// lacks → "Property 'DOMException' doesn't exist"). @firebase/auth exposes a
// `react-native` export condition → clean RN build. (Same approach as MHM.)
import { Platform } from 'react-native';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, signOut as fbSignOut, Auth } from '@firebase/auth';
import {
  getFirestore,
  doc as fsDoc,
  collection as fsCollection,
  getDoc as fsGetDoc,
  getDocs as fsGetDocs,
  setDoc as fsSetDoc,
  deleteDoc as fsDeleteDoc,
  writeBatch as fsWriteBatch,
  onSnapshot as fsOnSnapshot,
  query as fsQuery,
  where as fsWhere,
  Firestore,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { normalizeCompressorState } from '../types/compressor';
import { Inspection } from '../types/inspection';
import { CrewMember } from '../types/crew';
import { CATEGORIES } from '../constants/categories';
import * as storage from './storage';
import { mergeCrew, mergeInspections } from './inspections';

// getReactNativePersistence ships only in the RN bundle (not in the default TS types).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('@firebase/auth') as {
  getReactNativePersistence: (s: any) => any;
};

// ---- CONFIG ---------------------------------------------------------------
// Project: marine-safety-manager.
// Storage is Firestore. `databaseURL` is kept only because the Realtime Database
// still holds the data of vessels that synced before this change — see the
// migration note in CLAUDE.md. Nothing in this file reads it any more.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDkYyhyLpz05Xsj0CLus3ncJmPQIk1FLR8',
  authDomain: 'marine-safety-manager.firebaseapp.com',
  databaseURL: 'https://marine-safety-manager-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'marine-safety-manager',
  storageBucket: 'marine-safety-manager.firebasestorage.app',
  messagingSenderId: '353177370508',
  appId: '1:353177370508:web:2a3bc4d5dd94bc15f8a0a9',
};
const ROOT = 'safety_vessels';
// --------------------------------------------------------------------------

export function isConfigured(): boolean {
  return !FIREBASE_CONFIG.apiKey.startsWith('PASTE');
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function ensureInit(): { auth: Auth | null; db: Firestore | null } {
  if (!isConfigured()) throw new Error('Firebase is not configured. Add your apiKey in firebaseService.ts.');
  // Windows talks to Firebase over REST (see below) — no JS SDK auth/db init.
  if (onWindows) return { auth: null, db: null };
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    try {
      // Persist the auth session across app restarts (RN has no default persistence).
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      // Already initialized (fast refresh) or persistence unavailable -> fall back.
      auth = getAuth(app);
    }
    db = getFirestore(app);
  }
  return { auth: auth!, db: db! };
}

// ============================================================================
// Windows REST path (react-native-windows)
//
// AUTH still works over REST here. STORAGE no longer does, and that is a
// deliberate, documented regression rather than an oversight:
//
// RTDB's REST API accepts the ID token as a query parameter (`?auth=<token>`),
// which is the only reason this path ever worked — `RNCWindowsFileManager
// .httpRequest` takes (method, url, body, contentType) and cannot set headers.
// Firestore's REST API has no query-parameter equivalent; it requires
// `Authorization: Bearer`. So syncing from react-native-windows needs the native
// module to grow header support first (FileManagerModule.h), which has to be
// built and tested on a Windows machine.
//
// This is a small loss in practice: the Windows story is now the browser build
// in `../MSM Win Web`, which runs the JS SDK and syncs normally. Everything else
// on Windows — local register, Excel import, XLSX export, .msm backup — is
// untouched, and `syncSupported()` lets the UI say so honestly instead of
// failing at the first write.
// ============================================================================
const onWindows = Platform.OS === 'windows';

/** Why Windows cannot sync, in the words the user should see. */
export const WINDOWS_SYNC_MESSAGE =
  'Cloud sync is not available in the Windows desktop build yet. Use the browser version, ' +
  'or move data with a .msm backup — the register, inspections and crew all travel in it.';

/** Can this platform sync at all? The UI asks before offering the buttons. */
export function syncSupported(): boolean {
  return !onWindows;
}
// ---- Firestore access layer -------------------------------------------------
// The `ref / get / set / update / remove` shape below is RTDB's, re-implemented
// over Firestore. It was kept because the device-approval code was written
// against it; that code is gone now, but the register and trail functions still
// read this way and there is nothing to gain from rewriting them a second time.
//
// Two things RTDB allowed that Firestore does not, handled here once:
//
//   1. A leaf can hold a bare scalar. `master_device_id` was a string sitting at
//      a path; Firestore has no such thing, so those paths are mapped to FIELDS
//      of the account document (ACCOUNT_FIELDS below).
//   2. `update` on a missing node creates it. Firestore's updateDoc throws, so
//      update() is implemented as setDoc(..., { merge: true }).

/** Paths that were RTDB leaves and are now fields of `safety_vessels/{uid}`. */
const ACCOUNT_FIELDS: Record<string, string> = {
  master_device_id: 'masterDeviceId',
  entitlement: 'entitlement',
  'trial/firstLaunch': 'trialFirstLaunch',
};

type Target =
  | { kind: 'doc'; path: string[] }
  | { kind: 'collection'; path: string[] }
  | { kind: 'field'; uid: string; field: string };

/**
 * Resolve `safety_vessels/{uid}/...` into what Firestore should touch.
 * An odd number of segments is a collection, an even number a document —
 * except the account-field paths above.
 */
function ref(_db: any, path: string): Target {
  const seg = path.split('/').filter(Boolean);
  if (seg[0] !== ROOT) throw new Error(`Unexpected sync path: ${path}`);
  const uid = seg[1];
  const rest = seg.slice(2).join('/');
  const field = ACCOUNT_FIELDS[rest];
  if (field) return { kind: 'field', uid, field };
  return { kind: seg.length % 2 === 0 ? 'doc' : 'collection', path: seg };
}

function requireDb(): Firestore {
  const { db: d } = ensureInit();
  if (!d) throw new Error(WINDOWS_SYNC_MESSAGE);
  return d;
}

function asDoc(t: Extract<Target, { kind: 'doc' }>) {
  const [head, ...tail] = t.path;
  return fsDoc(requireDb(), head, ...tail);
}

function asCollection(t: Extract<Target, { kind: 'collection' }>) {
  const [head, ...tail] = t.path;
  return fsCollection(requireDb(), head, ...tail);
}

function accountDoc(uid: string) {
  return fsDoc(requireDb(), ROOT, uid);
}

/**
 * Reads. Returns RTDB's `{ val() }` shape so the callers below read unchanged:
 * a document yields its data or null, a collection yields a map keyed by
 * document id (exactly what `Object.entries(...)` over an RTDB node gave).
 */
async function get(t: Target): Promise<{ val: () => any }> {
  if (t.kind === 'field') {
    const snap = await fsGetDoc(accountDoc(t.uid));
    const v = snap.exists() ? (snap.data() as any)[t.field] : undefined;
    return { val: () => (v === undefined ? null : v) };
  }
  if (t.kind === 'doc') {
    const snap = await fsGetDoc(asDoc(t));
    return { val: () => (snap.exists() ? snap.data() : null) };
  }
  const snap = await fsGetDocs(asCollection(t));
  if (snap.empty) return { val: () => null };
  const out: Record<string, any> = {};
  snap.forEach((d) => {
    out[d.id] = d.data();
  });
  return { val: () => out };
}

/** Replace. */
async function set(t: Target, data: any): Promise<void> {
  if (t.kind === 'field') {
    // stripUndefined here too, not only on whole documents. Firestore rejects an
    // `undefined` ANYWHERE in the payload, and the field branch skipped the
    // strip: saving a licence whose `instanceId` was absent — which happens the
    // moment activation falls back to validate — failed the entire write with
    // "Unsupported field value: undefined (found in field entitlement.instanceId)".
    await fsSetDoc(accountDoc(t.uid), { [t.field]: stripUndefined(data) }, { merge: true });
    return;
  }
  if (t.kind !== 'doc') throw new Error('Cannot write a whole collection at once.');
  await fsSetDoc(asDoc(t), stripUndefined(data));
}

/** Merge — and create if absent, which is what RTDB's update did. */
async function update(t: Target, data: any): Promise<void> {
  if (t.kind === 'field') {
    await fsSetDoc(accountDoc(t.uid), { [t.field]: stripUndefined(data) }, { merge: true });
    return;
  }
  if (t.kind !== 'doc') throw new Error('Cannot update a whole collection at once.');
  await fsSetDoc(asDoc(t), stripUndefined(data), { merge: true });
}

async function remove(t: Target): Promise<void> {
  if (t.kind === 'field') {
    await fsSetDoc(accountDoc(t.uid), { [t.field]: null }, { merge: true });
    return;
  }
  if (t.kind !== 'doc') throw new Error('Cannot delete a whole collection at once.');
  await fsDeleteDoc(asDoc(t));
}

/**
 * Firestore rejects `undefined` outright, where RTDB silently dropped the key.
 * Several device records are built with spreads that can leave one behind
 * (`...(hwId ? { hwId } : {})` guards some, `meta.vesselName` does not), so this
 * keeps a missing optional from turning into a failed write.
 */
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

const LEGACY_DEVICE_KEY = 'msm:device_id'; // AsyncStorage (legacy; used on Windows / as fallback)
const SECURE_DEVICE_KEY = 'msm_device_id'; // SecureStore key (only [A-Za-z0-9._-] allowed)
/** The device's enrolment secret — what `refresh` requires instead of a PIN. */
const SECURE_SECRET_KEY = 'msm_device_secret';

function genDeviceId(): string {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Lazily + defensively load expo-secure-store. If the native module isn't built
// into the current binary (e.g. JS updated but native not rebuilt), this returns
// null instead of crashing the app, and device_id falls back to AsyncStorage.
let _secureStore: any | null | undefined;
function getSecureStore(): any | null {
  if (_secureStore !== undefined) return _secureStore;
  _secureStore = null;
  if (Platform.OS === 'windows') return _secureStore;
  try {
    // Check the native module is actually present FIRST (returns null, never
    // throws). Only then load the expo-secure-store JS wrapper — requiring it
    // when the native module is missing throws "Cannot find native module
    // 'ExpoSecureStore'", which surfaces as a redbox even inside try/catch.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (requireOptionalNativeModule && requireOptionalNativeModule('ExpoSecureStore')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ss = require('expo-secure-store');
      if (ss && typeof ss.getItemAsync === 'function') _secureStore = ss;
    }
  } catch {
    _secureStore = null;
  }
  return _secureStore;
}

async function asyncStorageDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(LEGACY_DEVICE_KEY);
  if (!id) {
    id = genDeviceId();
    await AsyncStorage.setItem(LEGACY_DEVICE_KEY, id);
  }
  return id;
}

/**
 * Stable per-device id used as the cloud device identity (and the Master id).
 * Stored in the Keychain/Keystore via expo-secure-store when available, so it
 * SURVIVES an app reinstall (on iOS) → the Master keeps its identity instead of
 * becoming a new pending device. Existing AsyncStorage ids are migrated once.
 * Falls back to AsyncStorage on Windows / when the native module isn't present.
 */
async function deviceId(): Promise<string> {
  const SS = getSecureStore();
  if (!SS) return asyncStorageDeviceId();
  try {
    let id = await SS.getItemAsync(SECURE_DEVICE_KEY);
    if (!id) {
      id = (await AsyncStorage.getItem(LEGACY_DEVICE_KEY)) || genDeviceId();
      await SS.setItemAsync(SECURE_DEVICE_KEY, id);
    }
    return id;
  } catch {
    return asyncStorageDeviceId();
  }
}

/** Stable id for this device (exported for the UI to flag "this device"). */
/** The initialised app, or null when Firebase is unconfigured / on Windows. */
export function firebaseApp(): FirebaseApp | null {
  try {
    ensureInit();
    return app;
  } catch {
    return null;
  }
}

/** The Firestore handle, for the modules that talk to it directly. */
export function firestoreDb(): Firestore {
  return requireDb();
}

/** Auth for the enrolment client, which signs in with a custom token. */
export function ensureAuth(): Auth {
  const a = ensureInit().auth;
  if (!a) throw new Error(WINDOWS_SYNC_MESSAGE);
  return a;
}

/**
 * The enrolment secret. SecureStore where there is one, AsyncStorage otherwise —
 * the same fallback the device id already uses, and for the same reason: a
 * secret that cannot be stored is a device that can never refresh its token.
 */
/**
 * The last rank the vessel confirmed for this device, kept locally.
 *
 * The rank arrives in a token, so a device with no connection has no rank — and
 * gating the interface on that meant a Master who lost signal lost every data
 * control, including the backup and the roll-back, at exactly the moment those
 * matter most. The remembered rank is for the INTERFACE only; every write is
 * still checked against the claim in the token by firestore.rules, so a stale
 * copy here grants nothing. It is corrected on the next successful refresh.
 */
const ROLE_KEY = 'msm:device_role';

export async function saveKnownRole(role: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ROLE_KEY, role);
  } catch {
    /* remembering the rank is a convenience, never a requirement */
  }
}

export async function getKnownRole(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ROLE_KEY);
  } catch {
    return null;
  }
}

export async function clearKnownRole(): Promise<void> {
  await AsyncStorage.removeItem(ROLE_KEY).catch(() => {});
}

export async function saveDeviceSecret(secret: string): Promise<void> {
  const SS = getSecureStore();
  try {
    if (SS) {
      await SS.setItemAsync(SECURE_SECRET_KEY, secret);
      return;
    }
  } catch {
    /* fall through to AsyncStorage */
  }
  await AsyncStorage.setItem(`msm:${SECURE_SECRET_KEY}`, secret);
}

export async function getDeviceSecret(): Promise<string | null> {
  const SS = getSecureStore();
  try {
    if (SS) {
      const v = await SS.getItemAsync(SECURE_SECRET_KEY);
      if (v) return v;
    }
  } catch {
    /* fall through */
  }
  return AsyncStorage.getItem(`msm:${SECURE_SECRET_KEY}`);
}

/**
 * Give up this device's session and its right to come back on its own.
 *
 * Both halves matter. Signing out of Firebase ends the CURRENT session; clearing
 * the device secret is what stops `refresh` silently minting a new one on the
 * next launch — without it the device would sign itself back in and "sign off"
 * would last until the app was reopened. Deliberately does NOT touch local data:
 * erasing the register is a separate decision, and the caller asks it separately.
 */
export async function signOutDevice(): Promise<void> {
  await clearDeviceSecret();
  await clearKnownRole();
  try {
    await fbSignOut(ensureAuth());
  } catch {
    /* no session to end — clearing the secret was the part that mattered */
  }
}

export async function clearDeviceSecret(): Promise<void> {
  const SS = getSecureStore();
  try {
    if (SS) await SS.deleteItemAsync(SECURE_SECRET_KEY);
  } catch {
    /* ignore */
  }
  await AsyncStorage.removeItem(`msm:${SECURE_SECRET_KEY}`);
}

export async function getLocalDeviceId(): Promise<string> {
  return deviceId();
}

// ---- Register + inspections + crew ------------------------------------------
// RTDB's `~xx` key escaping used to live here, because item `extra` keys come
// from Excel column headers ("PLB (Ser.#)") and RTDB forbids . # $ / [ ] in a
// key. It is gone: the register now travels as ONE JSON STRING, so those keys
// are never field names at all and nothing needs escaping. That also keeps the
// arbitrary headers out of Firestore's index, which has its own per-document
// limits and would have been the next thing to break.

const REGISTER_FIELD = 'register';
/** Firestore caps a document at 1 MiB; warn with room to act. */
const REGISTER_WARN_BYTES = 700 * 1024;

/** Everything the register blob carries. Inspections are deliberately not in it. */
interface RegisterBlob {
  categories: Record<string, EquipmentItem[]>;
  vessel_info?: any;
  certificates?: Certificate[];
  compressor?: any;
}

/** Push the whole register as one document write. */
export async function pushAll(uid: string): Promise<number> {
  const byCategory = await storage.loadAll();
  let total = 0;
  const categories: Record<string, EquipmentItem[]> = {};
  for (const c of CATEGORIES) {
    categories[c.key] = byCategory[c.key];
    total += byCategory[c.key].length;
  }
  const blob: RegisterBlob = {
    categories,
    vessel_info: (await storage.loadVessel()) ?? undefined,
    certificates: await storage.loadCertificates(),
    compressor: await storage.loadCompressor(),
  };

  const json = JSON.stringify(blob);
  if (json.length > REGISTER_WARN_BYTES) {
    console.warn(
      `[sync] register is ${(json.length / 1024).toFixed(0)} KB — Firestore caps a document at ` +
        `1 MiB. Time to split the categories into their own documents.`
    );
  }

  // Named separately so a refusal says WHICH write was refused. One catch around
  // three different documents with three different rules told us only that
  // something, somewhere, was not allowed.
  try {
    await fsSetDoc(
      accountDoc(uid),
      { [REGISTER_FIELD]: json, registerUpdatedAt: Date.now(), registerDeviceId: await deviceId() },
      { merge: true }
    );
  } catch (e: any) {
    throw new Error(`register: ${e?.message ?? e}`);
  }
  await pushInspections(uid);
  return total;
}

/** Pull the register (replaces local) and merge the trail into it. */
export async function pullAll(uid: string): Promise<number> {
  const snap = await fsGetDoc(accountDoc(uid));
  const raw = snap.exists() ? (snap.data() as any)[REGISTER_FIELD] : null;
  let total = 0;

  if (typeof raw === 'string' && raw) {
    let blob: RegisterBlob;
    try {
      blob = JSON.parse(raw) as RegisterBlob;
    } catch {
      throw new Error('The register stored in the cloud could not be read.');
    }

    // ---- refuse to wipe a good local register --------------------------------
    //
    // This replaces every category with whatever arrived, so an empty or
    // malformed blob erases the vessel's entire register — and the next push
    // then writes that emptiness back to the cloud, which is how a recoverable
    // glitch becomes permanent. Seen for real on 4 Sep 2026: a device came up,
    // pulled an empty blob, lost 13 items, and pushed the emptiness over the
    // good copy within the same minute.
    //
    // So: a blob with no `categories` object is not a register, and a blob with
    // ZERO items does not get to overwrite a local copy that has some. A vessel
    // that genuinely wants to clear its register does it locally and pushes —
    // that direction is deliberate and reversible from a .msm backup. This one
    // is neither.
    if (!blob.categories || typeof blob.categories !== 'object') {
      throw new Error('The register stored in the cloud is not in a readable shape.');
    }
    const incoming = CATEGORIES.reduce((n, c) => n + (blob.categories[c.key]?.length ?? 0), 0);
    if (incoming === 0) {
      const localCount = (await storage.loadFlat()).length;
      if (localCount > 0) {
        console.warn(
          `[sync] refused an empty cloud register — this device holds ${localCount} items. ` +
            'Push from here if the register really should be empty.'
        );
        await pullInspections(uid);
        return localCount;
      }
    }

    for (const c of CATEGORIES) {
      const items = (blob.categories?.[c.key] ?? []) as EquipmentItem[];
      await storage.replaceCategory(c.key as CategoryKey, items);
      total += items.length;
    }
    if (blob.vessel_info) await storage.saveVessel(blob.vessel_info);
    if (blob.certificates) await storage.saveCertificates(blob.certificates);
    if (blob.compressor) await storage.saveCompressor(normalizeCompressorState(blob.compressor));
  }

  await pullInspections(uid);
  return total;
}

// ---- Inspections + crew: merge, not overwrite -------------------------------
// The register is one document, so two devices editing the same ITEM still
// conflict and the later write wins — honest, and unchanged from before.
//
// Inspections are different in kind. Records are append-only and carry a unique
// id (types/inspection.ts), so two devices can never produce conflicting
// versions of the SAME record, only different records. One Firestore document
// per record turns that from "a merge we perform carefully" into "a collision
// that cannot occur": several officers can work a round on separate phones all
// day and nothing of anyone's is lost. `mergeInspections` still runs on pull to
// settle the one case that CAN differ — a defect closed on one device while the
// other still holds it open — by taking the later `updatedAt`.
//
// Known limit: the record travels, its photo FILES do not — binaries are not
// uploaded (only the .msm backup carries them). A photo taken on one phone shows
// as missing on another until Cloud Storage is added, which needs the Blaze plan.

/** Firestore batches cap at 500 writes. */
const BATCH_LIMIT = 450;

async function writeInBatches(uid: string, sub: string, rows: Array<{ id: string; data: any }>): Promise<void> {
  const d = requireDb();
  for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
    const batch = fsWriteBatch(d);
    for (const row of rows.slice(i, i + BATCH_LIMIT)) {
      batch.set(fsDoc(d, ROOT, uid, sub, row.id), stripUndefined(row.data));
    }
    await batch.commit();
  }
}

/**
 * Push local records. Only what this device does not know to be already up
 * there is written, so a routine sync on a vessel with two years of history
 * costs a handful of writes rather than thousands.
 */
/**
 * Ids this device knows are already in the vessel's trail.
 *
 * Re-writing the whole trail on every sync was wrong twice over. By the rules it
 * is an UPDATE, and an inspection may only be updated by an officer and only in
 * its `defect` — so a crew device was refused for re-sending a record that had
 * not changed at all, and the refusal read as "Could not connect". And on a ship
 * it is paid for: the trail grows for the life of the vessel and every launch
 * was pushing all of it back up a VSAT link that charges by the megabyte.
 *
 * A record is immutable once signed, so "already up there" is permanent
 * knowledge — the only later change is a defect closing, which goes up on its own
 * through pushOneInspection.
 */
const PUSHED_KEY = 'msm:pushed_inspections';

async function knownPushed(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(PUSHED_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

async function rememberPushed(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const set = await knownPushed();
    ids.forEach((id) => set.add(id));
    await AsyncStorage.setItem(PUSHED_KEY, JSON.stringify([...set]));
  } catch {
    /* the worst case is pushing them again next time */
  }
}

export async function pushInspections(uid: string): Promise<number> {
  const list = await storage.loadInspections();
  const crew = await storage.loadCrew();

  const already = await knownPushed();
  const fresh = list.filter((i) => !already.has(i.id));
  if (fresh.length) {
    try {
      await writeInBatches(uid, 'inspections', fresh.map((i) => ({ id: i.id, data: i })));
      await rememberPushed(fresh.map((i) => i.id));
    } catch (e: any) {
      throw new Error(`inspections: ${e?.message ?? e}`);
    }
  }

  // THE CREW LIST IS THE MASTER'S. firestore.rules gates it on `isSuper`, and
  // this function ran on every sync from every device — so on any other device
  // the whole push failed, and the failure surfaced as "Could not connect" while
  // the connection was perfectly good. A device that may not write it must not
  // try: there is nothing for it to contribute, since only a Master can have
  // changed the list in the first place.
  if (crew.length && (await claimedRole()) === 'superadmin') {
    try {
      await writeInBatches(uid, 'crew', crew.map((c) => ({ id: c.id, data: c })));
    } catch (e: any) {
      throw new Error(`crew: ${e?.message ?? e}`);
    }
  }
  return list.length;
}

/** Pull the trail and the crew list, merging both into what this device holds. */
export async function pullInspections(uid: string): Promise<number> {
  const d = requireDb();

  const iSnap = await fsGetDocs(fsCollection(d, ROOT, uid, 'inspections'));
  const remote: Inspection[] = [];
  iSnap.forEach((doc) => remote.push(doc.data() as Inspection));
  const merged = mergeInspections(await storage.loadInspections(), remote);
  await storage.saveInspections(merged);
  // Anything the vessel just handed us is, by definition, already up there.
  await rememberPushed(remote.map((r) => r.id));

  const cSnap = await fsGetDocs(fsCollection(d, ROOT, uid, 'crew'));
  const remoteCrew: CrewMember[] = [];
  cSnap.forEach((doc) => remoteCrew.push(doc.data() as CrewMember));
  await storage.saveCrew(mergeCrew(await storage.loadCrew(), remoteCrew));

  return merged.length;
}

// ---- Live subscriptions -----------------------------------------------------
// The reason for moving to Firestore. `onSnapshot` keeps its own socket, replays
// from cache instantly, and re-attaches after a dropped connection without being
// asked — so a mate approving a defect on the bridge shows up in the engineer's
// hand without either of them pressing anything.
//
// Every callback is fed from the LOCAL cache first and the server second, which
// is what makes the app usable the moment it opens rather than after a round
// trip. `fromCache` is passed through so the caller can avoid treating a cached
// echo of its own write as remote news.

export interface RegisterSnapshot {
  json: string | null;
  deviceId: string | null;
  updatedAt: number | null;
  fromCache: boolean;
}

export function subscribeRegister(uid: string, cb: (snap: RegisterSnapshot) => void): () => void {
  if (!syncSupported()) return () => {};
  return fsOnSnapshot(
    accountDoc(uid),
    (snap) => {
      const data = snap.exists() ? (snap.data() as any) : null;
      cb({
        json: typeof data?.[REGISTER_FIELD] === 'string' ? data[REGISTER_FIELD] : null,
        deviceId: data?.registerDeviceId ?? null,
        updatedAt: data?.registerUpdatedAt ?? null,
        fromCache: snap.metadata.fromCache,
      });
    },
    (err) => console.warn('[sync] register listener stopped:', err?.message ?? err)
  );
}

/**
 * Watch the trail. `since` limits the window — a vessel with three years of
 * history has no reason to hold all of it open in a listener, and the reports
 * read from local storage anyway.
 */
export function subscribeInspections(
  uid: string,
  since: number,
  cb: (rows: Inspection[]) => void
): () => void {
  if (!syncSupported()) return () => {};
  const q = fsQuery(fsCollection(requireDb(), ROOT, uid, 'inspections'), fsWhere('at', '>=', since));
  return fsOnSnapshot(
    q,
    (snap) => {
      const rows: Inspection[] = [];
      snap.forEach((d) => rows.push(d.data() as Inspection));
      cb(rows);
    },
    (err) => console.warn('[sync] inspection listener stopped:', err?.message ?? err)
  );
}

export function subscribeCrew(uid: string, cb: (rows: CrewMember[]) => void): () => void {
  if (!syncSupported()) return () => {};
  return fsOnSnapshot(
    fsCollection(requireDb(), ROOT, uid, 'crew'),
    (snap) => {
      const rows: CrewMember[] = [];
      snap.forEach((d) => rows.push(d.data() as CrewMember));
      cb(rows);
    },
    (err) => console.warn('[sync] crew listener stopped:', err?.message ?? err)
  );
}

/** Write one signed record straight through — used the moment it is signed. */
export async function pushOneInspection(uid: string, insp: Inspection): Promise<void> {
  if (!syncSupported()) return;
  await fsSetDoc(fsDoc(requireDb(), ROOT, uid, 'inspections', insp.id), stripUndefined(insp));
}

// ---- Entitlement (web subscription / license) ------------------------------
// The web build stores the vessel's MSM Pro entitlement (a validated
// LemonSqueezy license) under the account, so it follows the vessel across
// browsers/devices and can't be reset by clearing local storage. Not used on
// Windows (no JS SDK path here) — web/mobile only.

export interface Entitlement {
  active: boolean;
  provider?: 'lemonsqueezy';
  licenseKey?: string;
  instanceId?: string;
  activatedAt?: number;
  /** ms epoch, or null — which for a SUBSCRIPTION key means "no end date yet",
   *  not "perpetual". LemonSqueezy keeps a subscription key active and flips its
   *  status when the subscription ends, so the status from a re-validation is the
   *  authority. See services/purchases.ts `revalidateLicence`. */
  expiresAt?: number | null;
  /** When the licence was last confirmed with LemonSqueezy (ms epoch). */
  lastCheckedAt?: number;
}

/** uid of the currently signed-in vessel, or null if not signed in. */
/**
 * The key the vessel's data actually lives under: the IMO digits.
 *
 * NOT the same as `currentUid()`, and the difference caused a real failure. Since
 * enrolment, a device signs in with a CUSTOM TOKEN whose uid is
 * `<imo>__<deviceId>` — unique per device. The register, the licence and
 * everything else are stored under the VESSEL, and firestore.rules authorises by
 * the `vessel` claim. Writing to `safety_vessels/<uid>` therefore lands on a
 * document the rules do not recognise and is rejected with "Missing or
 * insufficient permissions" — which is exactly what activating a licence did.
 *
 * Read from the token's claims where possible, because that is what the rules
 * check; the stored vessel info is a fallback for the legacy password path.
 */
/**
 * The vessel this device's TOKEN says it may write to — no fallback.
 *
 * `currentVesselKey` falls back to the stored IMO, which is right for addressing
 * a document and wrong for diagnosing a refusal: the fallback would hand back
 * the very number that was rejected and the mismatch would stay invisible. This
 * one answers only what the claim says, so a write refused for the wrong vessel
 * can say which vessel it was actually issued for.
 */
/** The role this device's token carries — what the rules will actually allow. */
export async function claimedRole(): Promise<string | null> {
  try {
    const user = ensureInit().auth?.currentUser;
    if (!user) return null;
    const token = await user.getIdTokenResult();
    const role = (token.claims as { role?: string }).role;
    return role ? String(role) : null;
  } catch {
    return null;
  }
}

export async function claimedVessel(): Promise<string | null> {
  try {
    const user = ensureInit().auth?.currentUser;
    if (!user) return null;
    const token = await user.getIdTokenResult();
    const claimed = (token.claims as { vessel?: string }).vessel;
    return claimed ? String(claimed).replace(/\D/g, '') || null : null;
  } catch {
    return null;
  }
}

export async function currentVesselKey(): Promise<string | null> {
  if (onWindows) return null;
  try {
    const user = ensureInit().auth?.currentUser;
    if (user) {
      const token = await user.getIdTokenResult();
      const claimed = (token.claims as { vessel?: string }).vessel;
      if (claimed) return String(claimed).replace(/\D/g, '') || null;
      // Legacy path: the uid IS the account key.
      return user.uid;
    }
  } catch {
    /* fall through to the stored vessel */
  }
  const vessel = await storage.loadVessel();
  const imo = (vessel?.imo ?? '').replace(/\D/g, '');
  return imo || null;
}

export function currentUid(): string | null {
  if (onWindows) return null;
  try {
    return ensureInit().auth?.currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

/** Read the account's stored entitlement (null if none / not signed in). */
export async function getEntitlement(uid: string): Promise<Entitlement | null> {
  const { db } = ensureInit();
  const snap = await get(ref(db, `${ROOT}/${uid}/entitlement`));
  return (snap.val() as Entitlement) ?? null;
}

/** Persist the account's entitlement. */
export async function saveEntitlement(uid: string, ent: Entitlement): Promise<void> {
  const { db } = ensureInit();
  await set(ref(db, `${ROOT}/${uid}/entitlement`), ent);
}

/** The vessel account's recorded trial-start (ms epoch), or null if none. */
export async function getAccountTrialStart(uid: string): Promise<number | null> {
  const { db } = ensureInit();
  const snap = await get(ref(db, `${ROOT}/${uid}/trial/firstLaunch`));
  const v = snap.val();
  return typeof v === 'number' && v > 0 ? v : null;
}

/** Record the vessel account's trial-start. */
export async function setAccountTrialStart(uid: string, ts: number): Promise<void> {
  const { db } = ensureInit();
  await set(ref(db, `${ROOT}/${uid}/trial/firstLaunch`), ts);
}

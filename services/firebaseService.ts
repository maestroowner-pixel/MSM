// ===================================
// Firebase sync (mirrors MHM's firebaseService pattern)
// Auth via IMO -> fake email, Realtime DB per-category sync,
// simple device-approval (first device = Master).
//
// ⚠️ PASTE YOUR FIREBASE WEB CONFIG BELOW to enable cloud sync.
// Until then isConfigured() returns false and the app stays local-only.
// ===================================

// IMPORTANT: import auth from the SCOPED @firebase/auth package, NOT the umbrella
// `firebase/auth`. The umbrella's export map has no `react-native` condition, so it
// resolves the browser ESM build (references DOMException/PerformanceEntry that Hermes
// lacks → "Property 'DOMException' doesn't exist"). @firebase/auth exposes a
// `react-native` export condition → clean RN build. (Same approach as MHM.)
import { Platform, NativeModules } from 'react-native';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, Auth } from '@firebase/auth';
import {
  getDatabase,
  ref as fbRef,
  get as fbGet,
  set as fbSet,
  update as fbUpdate,
  remove as fbRemove,
  Database,
} from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { normalizeCompressorState } from '../types/compressor';
import { CATEGORIES } from '../constants/categories';
import * as storage from './storage';

// getReactNativePersistence ships only in the RN bundle (not in the default TS types).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('@firebase/auth') as {
  getReactNativePersistence: (s: any) => any;
};

// ---- CONFIG ---------------------------------------------------------------
// Project: marine-safety-manager.
// NOTE: databaseURL is NOT in the web config until the Realtime Database is
// created in the console. After creating it, confirm the region matches below
// (assumed europe-west1, same as MHM); the console shows the exact URL.
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
let db: Database | null = null;

function ensureInit(): { auth: Auth | null; db: Database | null } {
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
    db = getDatabase(app);
  }
  return { auth: auth!, db: db! };
}

function imoEmail(imo: string): string {
  return `imo.${imo.replace(/\D/g, '')}@marinesafety.app`;
}

// ============================================================================
// Windows REST path (react-native-windows)
// firebase/auth's RN persistence and the JS DB transport don't run on rnw, so on
// Windows we talk to Firebase Auth + Realtime Database over REST via the native
// RNCWindowsFileManager.httpRequest module. The local ref/get/set/update/remove
// wrappers below branch on platform, so the rest of this file is unchanged.
// ============================================================================
const onWindows = Platform.OS === 'windows';
const AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';
const SECURETOKEN_URL = 'https://securetoken.googleapis.com/v1/token';
const FB_ID_TOKEN_KEY = 'msm:fb_id_token';
const FB_REFRESH_TOKEN_KEY = 'msm:fb_refresh_token';
const FB_UID_KEY = 'msm:fb_uid';

let _idToken: string | null = null;

async function nativeHttp(method: string, url: string, body?: object): Promise<any> {
  const fn = (NativeModules as any).RNCWindowsFileManager?.httpRequest;
  if (typeof fn !== 'function') {
    throw new Error('Native HTTP module (RNCWindowsFileManager) is not available.');
  }
  const text: string = await fn(method, url, body ? JSON.stringify(body) : '', 'application/json');
  if (!text) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from Firebase.');
  }
  if (parsed?.error) {
    const msg = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message ?? 'Firebase error';
    throw new Error(msg);
  }
  return parsed;
}

/** POST to the Identity Toolkit (REST auth). Maps the error to an auth/* code. */
async function authRest(endpoint: string, body: object): Promise<any> {
  const data = await nativeHttp('POST', `${AUTH_URL}:${endpoint}?key=${FIREBASE_CONFIG.apiKey}`, body);
  if (data?.error) {
    const code = data.error.message ?? 'UNKNOWN_ERROR';
    const err: any = new Error(code);
    err.code = 'auth/' + String(code).toLowerCase().replace(/[_\s:.]+/g, '-');
    throw err;
  }
  return data;
}

async function persistWindowsAuth(data: any): Promise<void> {
  _idToken = data.idToken;
  await AsyncStorage.multiSet([
    [FB_ID_TOKEN_KEY, data.idToken],
    [FB_REFRESH_TOKEN_KEY, data.refreshToken],
    [FB_UID_KEY, data.localId],
  ]);
}

async function refreshWindowsToken(): Promise<boolean> {
  try {
    const refreshToken = await AsyncStorage.getItem(FB_REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;
    const data = await nativeHttp('POST', `${SECURETOKEN_URL}?key=${FIREBASE_CONFIG.apiKey}`, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    if (!data?.id_token) return false;
    _idToken = data.id_token;
    await AsyncStorage.multiSet([
      [FB_ID_TOKEN_KEY, data.id_token],
      [FB_REFRESH_TOKEN_KEY, data.refresh_token ?? refreshToken],
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Load a saved token so RTDB calls work after an app restart on Windows. */
async function restoreWindowsToken(): Promise<void> {
  if (_idToken) return;
  _idToken = await AsyncStorage.getItem(FB_ID_TOKEN_KEY);
  if (_idToken) refreshWindowsToken().catch(() => {});
}

function dbUrl(path: string): string {
  return `${FIREBASE_CONFIG.databaseURL}/${path}.json?auth=${_idToken}`;
}

/** RTDB over REST (Windows), with one transparent token refresh on auth failure. */
async function winDb(method: string, path: string, body?: object): Promise<any> {
  if (!_idToken) await restoreWindowsToken();
  if (!_idToken) throw new Error('Not signed in.');
  try {
    return await nativeHttp(method, dbUrl(path), body);
  } catch (e: any) {
    const msg: string = e?.message ?? '';
    if (/expired|invalid|INVALID_ID_TOKEN|401|403|permission/i.test(msg)) {
      if (await refreshWindowsToken()) return await nativeHttp(method, dbUrl(path), body);
    }
    throw e;
  }
}

// ---- Platform-branching DB ops (drop-in for firebase/database) --------------
function ref(db: any, path: string): any {
  return onWindows ? { __path: path } : fbRef(db, path);
}
async function get(r: any): Promise<{ val: () => any }> {
  if (onWindows) {
    const v = await winDb('GET', r.__path);
    return { val: () => v ?? null };
  }
  return fbGet(r);
}
async function set(r: any, data: any): Promise<void> {
  if (onWindows) {
    await winDb('PUT', r.__path, data);
    return;
  }
  await fbSet(r, data);
}
async function update(r: any, data: any): Promise<void> {
  if (onWindows) {
    await winDb('PATCH', r.__path, data);
    return;
  }
  await fbUpdate(r, data);
}
async function remove(r: any): Promise<void> {
  if (onWindows) {
    await winDb('DELETE', r.__path);
    return;
  }
  await fbRemove(r);
}

// ---- Connection password ---------------------------------------------------
// The vessel's Firebase account password. The first device to connect creates
// the account with this password; every later device must supply the same one,
// so knowing the (public) IMO alone is not enough to join the vessel.
export const MIN_PASSWORD_LENGTH = 6; // Firebase Auth minimum
const CONN_PW_KEY = 'msm:conn_password';

/** The connection password saved on this device (so the user re-enters it rarely). */
export async function getSavedPassword(): Promise<string | null> {
  return AsyncStorage.getItem(CONN_PW_KEY);
}
export async function savePassword(pw: string): Promise<void> {
  await AsyncStorage.setItem(CONN_PW_KEY, pw);
}
export async function clearSavedPassword(): Promise<void> {
  await AsyncStorage.removeItem(CONN_PW_KEY);
}

const PLATFORM_LABELS: Record<string, string> = {
  ios: 'iPhone / iPad',
  android: 'Android',
  macos: 'macOS',
  windows: 'Windows',
};

const LEGACY_DEVICE_KEY = 'msm:device_id'; // AsyncStorage (legacy; used on Windows / as fallback)
const SECURE_DEVICE_KEY = 'msm_device_id'; // SecureStore key (only [A-Za-z0-9._-] allowed)

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
export async function getLocalDeviceId(): Promise<string> {
  return deviceId();
}

/** Metadata stored for a device record (vessel name read from local storage). */
async function deviceMeta() {
  const vessel = await storage.loadVessel().catch(() => null);
  return {
    platform: Platform.OS,
    platformLabel: PLATFORM_LABELS[Platform.OS] ?? Platform.OS,
    vesselName: vessel?.vessel_name ?? '',
    lastSeen: Date.now(),
  };
}

/**
 * Sign in to the vessel account (IMO → email) with the connection password.
 * If the account doesn't exist yet, the first device provisions it with this
 * password. A wrong password for an existing vessel is rejected by Firebase.
 */
export async function signInVessel(imo: string, password: string): Promise<string> {
  const email = imoEmail(imo);
  const pass = (password ?? '').trim();
  if (pass.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Connection password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  // Windows: REST auth (sign in; if the account doesn't exist, provision it).
  if (onWindows) {
    if (!isConfigured()) throw new Error('Firebase is not configured. Add your apiKey in firebaseService.ts.');
    try {
      const data = await authRest('signInWithPassword', { email, password: pass, returnSecureToken: true });
      await persistWindowsAuth(data);
      return data.localId;
    } catch (e: any) {
      const code: string = e?.code ?? '';
      if (/invalid-credential|invalid-login|email-not-found|invalid-password|user-not-found|wrong-password/.test(code)) {
        try {
          const data = await authRest('signUp', { email, password: pass, returnSecureToken: true });
          await persistWindowsAuth(data);
          return data.localId;
        } catch (e2: any) {
          const c2: string = e2?.code ?? '';
          if (c2.includes('email-exists')) throw new Error('Wrong connection password for this vessel.');
          if (c2.includes('weak-password')) {
            throw new Error(`Connection password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
          }
          throw e2;
        }
      }
      throw e;
    }
  }

  const auth = ensureInit().auth!;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user.uid;
  } catch (e: any) {
    const code: string = e?.code ?? '';
    // Modern Firebase (email-enumeration protection) returns 'auth/invalid-credential'
    // for BOTH a missing account and a wrong password, so we can't tell them apart
    // from the sign-in error alone. Try to provision: if the account already exists,
    // the create call fails with email-already-in-use → the password was wrong.
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        return cred.user.uid;
      } catch (e2: any) {
        if (e2?.code === 'auth/email-already-in-use') {
          throw new Error('Wrong connection password for this vessel.');
        }
        if (e2?.code === 'auth/weak-password') {
          throw new Error(`Connection password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        }
        throw e2;
      }
    }
    throw e;
  }
}

export type ApprovalStatus = 'master' | 'approved' | 'pending';

export interface ConnectedDevice {
  deviceId: string;
  platform: string;
  platformLabel: string;
  vesselName?: string;
  customName?: string;
  lastSeen: number;
  role: 'master' | 'member';
  isThisDevice: boolean;
}

export interface PendingDevice {
  deviceId: string;
  platform: string;
  platformLabel: string;
  vesselName?: string;
  requestedAt: number;
  isThisDevice: boolean;
}

/**
 * Register this device under the vessel.
 * First device to connect becomes the Master and is auto-approved; every later
 * device lands in `pending_devices` until the Master approves it.
 */
export async function registerDevice(uid: string): Promise<ApprovalStatus> {
  const { db } = ensureInit();
  const id = await deviceId();
  const meta = await deviceMeta();

  const masterId = (await get(ref(db, `${ROOT}/${uid}/master_device_id`))).val() as string | null;

  // No master yet → claim it (first connected device wins).
  if (!masterId) {
    await set(ref(db, `${ROOT}/${uid}/master_device_id`), id);
    await set(ref(db, `${ROOT}/${uid}/devices/${id}`), { deviceId: id, role: 'master', ...meta });
    return 'master';
  }

  // This device IS the Master (per master_device_id) → always recognized, even
  // if its devices/ record was lost after a dropped connection. Re-assert the
  // record and clear any stale pending request so it never gets stuck pending.
  if (masterId === id) {
    await set(ref(db, `${ROOT}/${uid}/devices/${id}`), { deviceId: id, role: 'master', ...meta });
    await remove(ref(db, `${ROOT}/${uid}/pending_devices/${id}`));
    return 'master';
  }

  // Already an approved device → just refresh its lastSeen / vessel name.
  const existing = (await get(ref(db, `${ROOT}/${uid}/devices/${id}`))).val();
  if (existing) {
    await update(ref(db, `${ROOT}/${uid}/devices/${id}`), { vesselName: meta.vesselName, lastSeen: meta.lastSeen });
    return 'approved';
  }

  // Otherwise it's pending — (re)write the request so the Master can approve it.
  await set(ref(db, `${ROOT}/${uid}/pending_devices/${id}`), {
    deviceId: id,
    platform: meta.platform,
    platformLabel: meta.platformLabel,
    vesselName: meta.vesselName,
    requestedAt: meta.lastSeen,
  });
  return 'pending';
}

/** Where does this device currently stand? (cheap re-check after registration). */
export async function checkApprovalStatus(uid: string): Promise<ApprovalStatus | 'unknown'> {
  const { db } = ensureInit();
  const id = await deviceId();
  // The Master is recognized by master_device_id even if its devices/ record is missing.
  const masterId = (await get(ref(db, `${ROOT}/${uid}/master_device_id`))).val();
  if (masterId === id) return 'master';
  const approved = (await get(ref(db, `${ROOT}/${uid}/devices/${id}`))).val();
  if (approved) return 'approved';
  const pending = (await get(ref(db, `${ROOT}/${uid}/pending_devices/${id}`))).val();
  if (pending) return 'pending';
  return 'unknown';
}

/** True if this device is the vessel's Master (the one that approves others). */
export async function isMasterDevice(uid: string): Promise<boolean> {
  const { db } = ensureInit();
  const id = await deviceId();
  const masterId = (await get(ref(db, `${ROOT}/${uid}/master_device_id`))).val();
  return masterId === id;
}

/** All approved devices for the vessel, master first. */
export async function getConnectedDevices(uid: string): Promise<ConnectedDevice[]> {
  const { db } = ensureInit();
  const id = await deviceId();
  const masterId = (await get(ref(db, `${ROOT}/${uid}/master_device_id`))).val() as string | null;
  const data = (await get(ref(db, `${ROOT}/${uid}/devices`))).val() as Record<string, any> | null;
  if (!data) return [];
  return Object.entries(data)
    .map(([key, v]) => ({
      deviceId: v.deviceId ?? key,
      platform: v.platform ?? 'unknown',
      platformLabel: v.platformLabel ?? v.platform ?? 'Device',
      vesselName: v.vesselName,
      customName: v.customName,
      lastSeen: v.lastSeen ?? 0,
      role: (v.role === 'master' || (v.deviceId ?? key) === masterId ? 'master' : 'member') as 'master' | 'member',
      isThisDevice: (v.deviceId ?? key) === id,
    }))
    .sort((a, b) => (a.role === 'master' ? -1 : b.role === 'master' ? 1 : b.lastSeen - a.lastSeen));
}

/** Devices waiting for the Master to approve them. */
export async function getPendingDevices(uid: string): Promise<PendingDevice[]> {
  const { db } = ensureInit();
  const id = await deviceId();
  const data = (await get(ref(db, `${ROOT}/${uid}/pending_devices`))).val() as Record<string, any> | null;
  if (!data) return [];
  return Object.entries(data).map(([key, v]) => ({
    deviceId: v.deviceId ?? key,
    platform: v.platform ?? 'unknown',
    platformLabel: v.platformLabel ?? v.platform ?? 'Device',
    vesselName: v.vesselName,
    requestedAt: v.requestedAt ?? 0,
    isThisDevice: (v.deviceId ?? key) === id,
  }));
}

/** Master action: approve a pending device → move it into `devices`. */
export async function approveDevice(uid: string, targetId: string): Promise<void> {
  const { db } = ensureInit();
  const pending = (await get(ref(db, `${ROOT}/${uid}/pending_devices/${targetId}`))).val();
  if (!pending) throw new Error('Request not found (it may have been withdrawn).');
  await set(ref(db, `${ROOT}/${uid}/devices/${targetId}`), {
    deviceId: targetId,
    platform: pending.platform ?? 'unknown',
    platformLabel: pending.platformLabel ?? 'Device',
    vesselName: pending.vesselName ?? '',
    lastSeen: Date.now(),
    role: 'member',
  });
  await remove(ref(db, `${ROOT}/${uid}/pending_devices/${targetId}`));
}

/** Master action: reject (delete) a pending request. */
export async function rejectDevice(uid: string, targetId: string): Promise<void> {
  const { db } = ensureInit();
  await remove(ref(db, `${ROOT}/${uid}/pending_devices/${targetId}`));
}

/** Master action: revoke an approved device. The Master cannot remove itself. */
export async function removeDevice(uid: string, targetId: string): Promise<void> {
  const { db } = ensureInit();
  const masterId = (await get(ref(db, `${ROOT}/${uid}/master_device_id`))).val();
  if (targetId === masterId) throw new Error('The Master device cannot be removed.');
  await remove(ref(db, `${ROOT}/${uid}/devices/${targetId}`));
}

/** Give a device a friendly name shown in the device list. */
export async function renameDevice(uid: string, targetId: string, customName: string): Promise<void> {
  const { db } = ensureInit();
  await update(ref(db, `${ROOT}/${uid}/devices/${targetId}`), { customName: customName.trim() || null });
}

/**
 * Master action: hand the Master role to another approved device. The current
 * Master is demoted to a regular member.
 */
export async function transferMaster(uid: string, targetId: string): Promise<void> {
  const { db } = ensureInit();
  const target = (await get(ref(db, `${ROOT}/${uid}/devices/${targetId}`))).val();
  if (!target) throw new Error('That device is no longer connected.');
  const prevMaster = (await get(ref(db, `${ROOT}/${uid}/master_device_id`))).val() as string | null;
  await set(ref(db, `${ROOT}/${uid}/master_device_id`), targetId);
  await update(ref(db, `${ROOT}/${uid}/devices/${targetId}`), { role: 'master' });
  if (prevMaster && prevMaster !== targetId) {
    await update(ref(db, `${ROOT}/${uid}/devices/${prevMaster}`), { role: 'member' });
  }
}

/**
 * Make THIS device the Master, taking over from whoever currently holds it
 * (use when the old Master device is lost/unavailable). The previous Master, if
 * any, is demoted to a member but kept in the list.
 */
export async function resetMaster(uid: string): Promise<void> {
  const { db } = ensureInit();
  const id = await deviceId();
  const meta = await deviceMeta();
  const prevMaster = (await get(ref(db, `${ROOT}/${uid}/master_device_id`))).val() as string | null;
  // Ensure this device is an approved device, then claim master.
  await set(ref(db, `${ROOT}/${uid}/devices/${id}`), { deviceId: id, role: 'master', ...meta });
  await set(ref(db, `${ROOT}/${uid}/master_device_id`), id);
  if (prevMaster && prevMaster !== id) {
    await update(ref(db, `${ROOT}/${uid}/devices/${prevMaster}`), { role: 'member' });
  }
  // No longer pending if it ever was.
  await remove(ref(db, `${ROOT}/${uid}/pending_devices/${id}`));
}

// ---- RTDB key safety -------------------------------------------------------
// Realtime Database forbids these characters in keys: . # $ / [ ] (plus ASCII
// control chars). Item `extra` keys come from Excel column headers (e.g.
// "PLB (Ser.#)"), which can contain them. We reversibly encode every object key
// to a `~xx` hex escape on push and decode it on pull, so the data round-trips
// exactly while staying RTDB-legal. (Values are never touched — only keys.)
function encodeKey(k: string): string {
  // Single pass over the original string (matches are not re-scanned), so
  // encoding '~' itself to '~7e' first is unnecessary — it's handled here too.
  return k.replace(/[~.#$/[\]\x00-\x1f\x7f]/g, (c) => '~' + c.charCodeAt(0).toString(16).padStart(2, '0'));
}
function decodeKey(k: string): string {
  return k.replace(/~([0-9a-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function transformKeys(value: any, fn: (k: string) => string): any {
  if (Array.isArray(value)) return value.map((v) => transformKeys(v, fn));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[fn(k)] = transformKeys(v, fn);
    return out;
  }
  return value;
}

/** Push all local categories + vessel info to the cloud. */
export async function pushAll(uid: string): Promise<number> {
  const { db } = ensureInit();
  const byCategory = await storage.loadAll();
  const payload: Record<string, any> = { updatedAt: Date.now() };
  let total = 0;
  for (const c of CATEGORIES) {
    payload[c.key] = transformKeys(byCategory[c.key], encodeKey);
    total += byCategory[c.key].length;
  }
  const vessel = await storage.loadVessel();
  if (vessel) payload.vessel_info = vessel;
  // Certificates + BA compressor logs (encode keys for symmetry with the rest).
  payload.certificates = transformKeys(await storage.loadCertificates(), encodeKey);
  payload.compressor = transformKeys(await storage.loadCompressor(), encodeKey);
  await update(ref(db, `${ROOT}/${uid}/inventory`), payload);
  return total;
}

/** Pull cloud categories into local storage (overwrites local). */
export async function pullAll(uid: string): Promise<number> {
  const { db } = ensureInit();
  const snap = await get(ref(db, `${ROOT}/${uid}/inventory`));
  const data = snap.val() as Record<string, any> | null;
  if (!data) return 0;
  let total = 0;
  for (const c of CATEGORIES) {
    const items = (data[c.key] ? transformKeys(data[c.key], decodeKey) : []) as EquipmentItem[];
    await storage.replaceCategory(c.key as CategoryKey, items);
    total += items.length;
  }
  if (data.vessel_info) await storage.saveVessel(data.vessel_info);
  if (data.certificates) {
    await storage.saveCertificates(transformKeys(data.certificates, decodeKey) as Certificate[]);
  }
  if (data.compressor) {
    await storage.saveCompressor(normalizeCompressorState(transformKeys(data.compressor, decodeKey)));
  }
  return total;
}

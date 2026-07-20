// ===================================
// Bluetooth-LE transport to the label printer (Xprinter XP-420B and kin).
//
// The XP-420B's Bluetooth is dual-mode; over BLE we don't know its service /
// characteristic UUIDs up front, so instead of hard-coding them we connect, walk
// every service, and pick the first WRITABLE characteristic — the one the printer
// exposes for its command stream. TSPL (services/tspl.ts) is written to it in
// small chunks (BLE payloads are tiny), base64-encoded as react-native-ble-plx
// requires.
//
// Portable across the portfolio: nothing here is DEM-specific. iOS + Android both
// go through CoreBluetooth / the Android BLE stack via react-native-ble-plx.
// ===================================

import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Types only — erased at compile time, so importing this module does NOT load the
// native library.
import type { BleManager, Device, Characteristic } from 'react-native-ble-plx';

// react-native-ble-plx (3.5.x) has no New-Architecture TurboModule and builds its
// NativeEventEmitter the moment it is imported. Under bridgeless New Arch the native
// module isn't ready during bundle evaluation, so a top-level import crashes the whole
// app on launch. We therefore require it LAZILY — only when the keeper actually reaches
// for the printer, by which time the runtime (and the interop module) is ready.
let manager: BleManager | null = null;
export function ble(): BleManager {
  if (!manager) {
    const { BleManager } = require('react-native-ble-plx');
    manager = new BleManager();
  }
  return manager as BleManager;
}

/** ble-plx State enum values are these strings; comparing avoids importing the enum. */
const STATE_POWERED_ON = 'PoweredOn';

const DEFAULT_PRINTER_KEY = 'printer.default';

export interface SavedPrinter {
  id: string;
  name: string;
}

export async function getSavedPrinter(): Promise<SavedPrinter | null> {
  try {
    const raw = await AsyncStorage.getItem(DEFAULT_PRINTER_KEY);
    return raw ? (JSON.parse(raw) as SavedPrinter) : null;
  } catch {
    return null;
  }
}

export async function savePrinter(p: SavedPrinter): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_PRINTER_KEY, JSON.stringify(p));
}

export async function clearSavedPrinter(): Promise<void> {
  await AsyncStorage.removeItem(DEFAULT_PRINTER_KEY);
}

/** Android 12+ needs BLUETOOTH_SCAN/CONNECT at runtime; older needs location for
 *  a BLE scan. iOS handles this via Info.plist usage strings + the system prompt. */
export async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const api = Platform.Version as number;
  try {
    if (api >= 31) {
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return (
        res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === 'granted' &&
        res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'granted'
      );
    }
    const loc = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return loc === 'granted';
  } catch {
    return false;
  }
}

/** Wait until the adapter is powered on (or fail fast if unauthorized/off). */
export async function ensurePoweredOn(timeoutMs = 4000): Promise<boolean> {
  const state = await ble().state();
  if (state === STATE_POWERED_ON) return true;
  return new Promise((resolve) => {
    const sub = ble().onStateChange((s) => {
      if (s === STATE_POWERED_ON) {
        sub.remove();
        resolve(true);
      }
    }, true);
    setTimeout(() => {
      sub.remove();
      resolve(false);
    }, timeoutMs);
  });
}

export interface FoundDevice {
  id: string;
  name: string;
}

/**
 * Scan for nearby BLE peripherals. Calls onFound for each unique device; returns a
 * stop() to end the scan. Names are the only filter a user can reason about, so we
 * surface every named device and let them pick their printer.
 */
export async function scanPrinters(
  onFound: (d: FoundDevice) => void,
  onError?: (e: Error) => void
): Promise<() => void> {
  const ok = (await ensurePermissions()) && (await ensurePoweredOn());
  if (!ok) {
    onError?.(new Error('Bluetooth is off or permission was denied.'));
    return () => {};
  }
  const seen = new Set<string>();
  ble().startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
    if (error) {
      onError?.(error);
      return;
    }
    if (!device || seen.has(device.id)) return;
    const name = device.name || device.localName || '';
    if (!name) return; // unnamed peripherals are noise for printer picking
    seen.add(device.id);
    onFound({ id: device.id, name });
  });
  return () => ble().stopDeviceScan();
}

/** The first characteristic that accepts writes — the printer's command sink. */
async function findWriteCharacteristic(device: Device): Promise<Characteristic> {
  const services = await device.services();
  for (const s of services) {
    const chars = await s.characteristics();
    const w =
      chars.find((c) => c.isWritableWithoutResponse) ||
      chars.find((c) => c.isWritableWithResponse);
    if (w) return w;
  }
  throw new Error('No writable characteristic found on this device.');
}

// ---- base64 (bytes, not UTF-16) — ble-plx writes take base64 -----------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytesToBase64(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
}
/** TSPL is 8-bit ASCII; take the low byte of each char. */
function strToBytes(s: string): number[] {
  const a: number[] = [];
  for (let i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 0xff);
  return a;
}

/**
 * Connect (if needed), find the write characteristic, and stream the TSPL in
 * MTU-sized chunks. Returns when the whole job is written. Leaves the connection
 * open — a keeper prints several labels in a row — the caller disconnects when done.
 */
export async function printTspl(deviceId: string, tspl: string): Promise<void> {
  const ok = (await ensurePermissions()) && (await ensurePoweredOn());
  if (!ok) throw new Error('Bluetooth is off or permission was denied.');

  let device = await ble().connectToDevice(deviceId, { timeout: 8000 });
  await device.discoverAllServicesAndCharacteristics();

  // Bigger MTU = fewer round-trips. Android honours requestMTU; iOS negotiates on
  // its own and ignores the call, so fall back to a safe chunk if it throws.
  let chunk = 20;
  try {
    const withMtu = await device.requestMTU(247);
    chunk = Math.max(20, (withMtu.mtu || 23) - 3);
  } catch {
    chunk = 180; // iOS default negotiated MTU is comfortably above this
  }

  const ch = await findWriteCharacteristic(device);
  const bytes = strToBytes(tspl);
  const withoutResponse = ch.isWritableWithoutResponse;

  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.slice(i, i + chunk);
    const b64 = bytesToBase64(slice);
    if (withoutResponse) {
      await ch.writeWithoutResponse(b64);
    } else {
      await ch.writeWithResponse(b64);
    }
  }
}

export async function disconnect(deviceId: string): Promise<void> {
  try {
    await ble().cancelDeviceConnection(deviceId);
  } catch {
    /* already gone */
  }
}

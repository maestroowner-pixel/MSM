// ===================================
// The phone's NFC reader (react-native-nfc-manager) — read a tag's UID and words, write words.
//
// The library throws at import when its native module is not in the build (2.75 is the
// first with it), so it is required lazily and a failure is "no NFC here", like a phone
// without the chip. Browser: services/nfcReader.web.ts — none.
//
// iOS shows its own sheet for every read ("Hold near the wristband"); Android reads with
// no sheet while the screen asks. A tag is read with the TAG session (NfcA / MIFARE),
// not the NDEF one: only the tag session gives the UID, which is what proves the tag
// (types/nfc.ts). Its words are read in the same touch.
// ===================================

import { Platform } from 'react-native';

let lib: any | null | undefined;
let started: Promise<boolean> | null = null;

function nfc(): any | null {
  if (lib !== undefined) return lib;
  lib = null;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return lib;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    lib = require('react-native-nfc-manager');
  } catch {
    lib = null;
  }
  return lib;
}

/** The chip is there and switched on. On Android a phone with NFC switched off says false. */
export async function nfcReady(): Promise<boolean> {
  const m = nfc();
  if (!m) return false;
  try {
    started ??= m.default.isSupported().then(async (ok: boolean) => (ok ? (await m.default.start(), true) : false));
    if (!(await started)) return false;
    return Platform.OS === 'ios' ? true : await m.default.isEnabled();
  } catch {
    started = null;
    return false;
  }
}

/** Present, but switched off in the phone's settings (Android). */
export async function nfcSwitchedOff(): Promise<boolean> {
  const m = nfc();
  if (!m || Platform.OS !== 'android') return false;
  try {
    return (await m.default.isSupported()) && !(await m.default.isEnabled());
  } catch {
    return false;
  }
}

export interface TagRead {
  uid: string;
  /** The first URI or text record, when the tag has one. */
  payload: string | null;
}

function firstWords(m: any, tag: any): string | null {
  const recs: any[] = tag?.ndefMessage ?? [];
  for (const r of recs) {
    try {
      const bytes = Uint8Array.from(r.payload ?? []);
      if (m.Ndef.isType(r, m.Ndef.TNF_WELL_KNOWN, m.Ndef.RTD_URI)) return m.Ndef.uri.decodePayload(bytes);
      if (m.Ndef.isType(r, m.Ndef.TNF_WELL_KNOWN, m.Ndef.RTD_TEXT)) return m.Ndef.text.decodePayload(bytes);
    } catch {
      /* the next record */
    }
  }
  return null;
}

/** Waiting for a tag; `cancelRead` ends the wait (the screen closing, Stop pressed). */
let reading = false;
/** The read in progress is the app-wide listener's (components/NfcListener): any other read takes the reader from it. */
let background = false;
/** Screens listening for taps of their own (useNfcTaps): while any does, the app-wide listener stands aside. */
let claims = 0;

/** A screen takes the taps for itself; the returned function gives them back. */
export function claimNfc(): () => void {
  claims++;
  if (reading && background) void cancelRead();
  let given = false;
  return () => {
    if (given) return;
    given = true;
    claims = Math.max(0, claims - 1);
  };
}

export const nfcClaimed = () => claims > 0;

/** The reader for this read. A screen's read ends the app-wide listener's wait; two screens' reads do not share. */
async function takeReader(bg: boolean): Promise<boolean> {
  if (reading) {
    if (bg || !background) return false;
    await cancelRead();
    for (let i = 0; i < 40 && reading; i++) await new Promise((r) => setTimeout(r, 50));
    if (reading) return false;
  }
  reading = true;
  background = bg;
  return true;
}

/**
 * One tag: its UID and words. null when cancelled, timed out (iOS, 60 s), or the reader
 * is busy with another read. `prompt` is the iOS sheet's line.
 */
export async function readTag(prompt: string, opts?: { background?: boolean }): Promise<TagRead | null> {
  const m = nfc();
  if (!m || !(await nfcReady()) || !(await takeReader(!!opts?.background))) return null;
  try {
    await m.default.requestTechnology([m.NfcTech.NfcA, m.NfcTech.Ndef], { alertMessage: prompt });
    const tag = await m.default.getTag();
    if (!tag?.id) return null;
    if (Platform.OS === 'ios') await m.default.setAlertMessageIOS('✓').catch(() => {});
    return { uid: String(tag.id), payload: firstWords(m, tag) };
  } catch {
    return null;
  } finally {
    await m.default.cancelTechnologyRequest().catch(() => {});
    reading = false;
    background = false;
  }
}

export async function cancelRead(): Promise<void> {
  const m = nfc();
  if (!m) return;
  await m.default.cancelTechnologyRequest().catch(() => {});
}

/**
 * Write `uri` onto the tag held to the phone and return its UID. Throws with a reason a
 * person can act on (not writable, too small, moved away).
 */
export async function writeTag(uri: string, prompt: string): Promise<string> {
  const m = nfc();
  if (!m || !(await nfcReady())) throw new Error('nfc');
  if (!(await takeReader(false))) {
    // Another screen's read: this one is asked for, so it wins.
    await cancelRead();
    for (let i = 0; i < 40 && reading; i++) await new Promise((r) => setTimeout(r, 50));
    reading = true;
    background = false;
  }
  try {
    await m.default.requestTechnology(m.NfcTech.Ndef, { alertMessage: prompt });
    const tag = await m.default.getTag();
    if (!tag?.id) throw new Error('read');
    const bytes = m.Ndef.encodeMessage([m.Ndef.uriRecord(uri)]);
    await m.default.ndefHandler.writeNdefMessage(bytes);
    if (Platform.OS === 'ios') await m.default.setAlertMessageIOS('✓').catch(() => {});
    return String(tag.id);
  } finally {
    await m.default.cancelTechnologyRequest().catch(() => {});
    reading = false;
    background = false;
  }
}

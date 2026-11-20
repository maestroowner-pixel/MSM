// ===================================
// The Master's signed copies kept on the device (20 Nov 2026, MEPC.312(74) §4.4.2:
// "automatic backup of data in the system to offline storage … updated
// automatically every time changes are made", so the backing up "is not
// forgotten by the user").
//
// Every Master's verification makes the month's signed copy (services/signedCopy)
// with the same signature and keeps it here without asking: a phone writes the ZIP
// into the app's documents (`record-books/`), a browser into its own storage
// (IndexedDB through the async-storage shim). Nothing is ever replaced — each
// verification is its own file, so an earlier state of the month stays provable.
// "Copies on this device" lists them; one can be shared or saved from there.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { deliverFile, onWeb, onWindows } from './fileShare';
import { saveFileWeb } from './webSave';
import { base64Bytes } from './signedCopyFile';
import { ERB_COPIES_KEY } from '../services/storage';

export interface KeptCopy {
  name: string;
  at: number;
}

const DIR = () => `${FileSystem.documentDirectory}record-books/`;

/** `<copy name without .zip>_<UTC stamp>.zip` — one file per verification, never overwritten. */
export function keptName(zipName: string, at: number): string {
  const stamp = new Date(at).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  return `${zipName.replace(/\.zip$/i, '')}_${stamp}Z.zip`;
}

/** Keep the ZIP on this device. Throws when it cannot — the caller says so; the verification itself is already saved. */
export async function keepCopy(zipName: string, base64: string, at: number): Promise<KeptCopy> {
  const name = keptName(zipName, at);
  if (onWindows) throw new Error('Not on Windows.');
  if (onWeb) {
    const list = await readWeb();
    if (!list.some((c) => c.name === name)) list.push({ name, at, b64: base64 });
    await AsyncStorage.setItem(ERB_COPIES_KEY, JSON.stringify(list));
    return { name, at };
  }
  await FileSystem.makeDirectoryAsync(DIR(), { intermediates: true }).catch(() => {});
  await FileSystem.writeAsStringAsync(DIR() + name, base64, { encoding: 'base64' as any });
  return { name, at };
}

/** Every copy kept here, newest first. */
export async function keptCopies(): Promise<KeptCopy[]> {
  if (onWindows) return [];
  if (onWeb) return (await readWeb()).map(({ name, at }) => ({ name, at })).sort((a, b) => b.at - a.at);
  const names = await FileSystem.readDirectoryAsync(DIR()).catch(() => [] as string[]);
  const out: KeptCopy[] = [];
  for (const name of names.filter((n) => n.endsWith('.zip'))) {
    const info: any = await FileSystem.getInfoAsync(DIR() + name).catch(() => null);
    out.push({ name, at: info?.modificationTime ? info.modificationTime * 1000 : 0 });
  }
  return out.sort((a, b) => b.at - a.at);
}

/** Hand one over — the browser's save, a phone's share sheet. */
export async function shareKept(name: string): Promise<string | null | void> {
  if (onWeb) {
    const c = (await readWeb()).find((x) => x.name === name);
    if (!c) throw new Error('This copy is no longer on the device.');
    return saveFileWeb(new Blob([base64Bytes(c.b64) as BlobPart], { type: 'application/zip' }), name, 'reports');
  }
  const b64 = await FileSystem.readAsStringAsync(DIR() + name, { encoding: 'base64' as any });
  await deliverFile(name, b64, true, 'application/zip');
}

async function readWeb(): Promise<(KeptCopy & { b64: string })[]> {
  try {
    const raw = await AsyncStorage.getItem(ERB_COPIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

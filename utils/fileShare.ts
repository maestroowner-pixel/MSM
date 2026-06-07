// ===================================
// Cross-platform file delivery / pick.
// iOS/Android: write to cache + expo-sharing share sheet, or expo-document-picker.
// Windows: native Save / Open dialogs (RNCWindowsFileManager). One code path for
// callers (export.ts, backup.ts, ImportSc) so the platform branch lives here.
// ===================================

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { saveFileViaSavePanel, openFileViaPicker } from './WindowsFileManager';

export const onWindows = Platform.OS === 'windows';

/** Deliver generated content to the user (share sheet on mobile, Save dialog on Windows). */
export async function deliverFile(
  fileName: string,
  data: string,
  isBase64: boolean,
  mimeType: string
): Promise<void> {
  if (onWindows) {
    await saveFileViaSavePanel(fileName, data, isBase64);
    return;
  }
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, data, {
    encoding: isBase64 ? ('base64' as any) : ('utf8' as any),
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: fileName });
  }
}

/** Windows-only file pick → base64 content. Returns null off-Windows or on cancel. */
export async function pickFileBase64(
  extensions: string[]
): Promise<{ name: string; base64: string } | null> {
  if (!onWindows) return null;
  const r = await openFileViaPicker(extensions);
  return r ? { name: r.name, base64: r.content } : null;
}

/** Decode base64 (of UTF-8 bytes) to a JS string — for reading text files picked on Windows. */
export function base64ToUtf8(b64: string): string {
  const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const c = b64[i];
    if (c === '=') break;
    const idx = CH.indexOf(c);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b < 0xe0) out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    else if (b < 0xf0)
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    else {
      const cp =
        ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      const c2 = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (c2 >> 10), 0xdc00 + (c2 & 0x3ff));
    }
  }
  return out;
}

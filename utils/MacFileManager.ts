// ===================================
// MacFileManager — file I/O + HTML→PDF for react-native-macos via the native
// RNCMacFileManager module (FileManagerModule.m). Mirrors WindowsFileManager.
// On iOS/Android this module is unused (those use expo-file-system + sharing).
// ===================================

import { NativeModules, Alert } from 'react-native';

const { RNCMacFileManager } = NativeModules as any;

/**
 * Save content via the macOS Save panel (NSSavePanel).
 * `isBase64` = true for binary files (xlsx/pdf/zip) — the native side base64-decodes
 * before writing; false writes UTF-8 text (e.g. a .msm JSON backup).
 * Returns true if saved, false on cancel / when the module is missing.
 */
export async function macSaveFile(
  filename: string,
  content: string,
  isBase64: boolean = false
): Promise<boolean> {
  if (RNCMacFileManager) {
    const method = isBase64 ? 'saveFileBase64' : 'saveFile';
    try {
      const savedPath = await RNCMacFileManager[method](filename, content);
      return !!savedPath;
    } catch (e: any) {
      if (e?.code !== 'CANCELLED') {
        Alert.alert('Export error', e?.message || 'Could not save file.');
      }
      return false;
    }
  }
  Alert.alert('Export ready', `Native save dialog not available.\nFile: ${filename}`);
  return false;
}

/**
 * Open a file via the macOS Open panel (NSOpenPanel). Returns the file name and
 * its **base64** content, or null on cancel / when the module is missing.
 */
export async function macOpenFile(
  extensions: string[]
): Promise<{ name: string; content: string } | null> {
  if (RNCMacFileManager?.openFilePicker) {
    try {
      const result = await RNCMacFileManager.openFilePicker(extensions);
      return JSON.parse(result);
    } catch (e: any) {
      if (e?.code !== 'CANCELLED') {
        Alert.alert('Import error', e?.message || 'Could not open file.');
      }
      return null;
    }
  }
  Alert.alert('Not available', 'The RNCMacFileManager native module is not built in.');
  return null;
}

/** Render report HTML to a PDF, returned as base64. Null if the module is missing. */
export async function macHtmlToPdfBase64(html: string): Promise<string | null> {
  if (RNCMacFileManager?.htmlToPdfBase64) {
    try {
      return await RNCMacFileManager.htmlToPdfBase64(html);
    } catch (e: any) {
      Alert.alert('PDF error', e?.message || 'Could not render PDF.');
      return null;
    }
  }
  return null;
}

/** Write base64 content into the app's attachments dir; returns a file:// URI (or null). */
export async function macPersistFile(filename: string, base64: string): Promise<string | null> {
  if (RNCMacFileManager?.persistBase64) {
    try {
      return await RNCMacFileManager.persistBase64(filename, base64);
    } catch (e: any) {
      Alert.alert('Attach error', e?.message || 'Could not save the file.');
      return null;
    }
  }
  return null;
}

/** Open a stored file (file:// URI or path) with the default macOS app. */
export async function macOpenPath(uri: string): Promise<void> {
  try {
    await RNCMacFileManager?.openPath?.(uri);
  } catch {
    /* best-effort */
  }
}

/** Delete a stored file (file:// URI or path). Best-effort. */
export async function macDeletePath(uri: string): Promise<void> {
  try {
    await RNCMacFileManager?.deletePath?.(uri);
  } catch {
    /* best-effort */
  }
}

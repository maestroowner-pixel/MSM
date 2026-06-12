// ===================================
// WindowsFileManager — file I/O for react-native-windows via the native
// RNCWindowsFileManager module (FileManagerModule.h). Save dialog + open dialog.
// On iOS/Android this module is unused (those use expo-file-system + sharing).
// ===================================

import { NativeModules, Alert } from 'react-native';

const { RNCWindowsFileManager } = NativeModules as any;

/**
 * Save content via the Windows Save dialog.
 * `isBase64` = true for binary files (xlsx, zip) — the native side base64-decodes
 * before writing; false writes text (e.g. a .msm JSON backup).
 */
export async function saveFileViaSavePanel(
  filename: string,
  content: string,
  isBase64: boolean = false
): Promise<boolean> {
  if (RNCWindowsFileManager) {
    const method = isBase64 ? 'saveFileBase64' : 'saveFile';
    if (RNCWindowsFileManager[method]) {
      try {
        const savedPath = await RNCWindowsFileManager[method](filename, content);
        return !!savedPath;
      } catch (e: any) {
        if (e?.code !== 'CANCELLED') {
          Alert.alert('Export error', e?.message || 'Could not save file.');
        }
        return false;
      }
    }
  }
  Alert.alert(
    'Export ready',
    `Native save dialog not available.\nFile: ${filename}\n\nThe RNCWindowsFileManager native module is not built in.`
  );
  return false;
}

/**
 * Open a file via the Windows Open dialog. Returns the file name and its
 * **base64** content (the native module always returns base64), or null on
 * cancel / when the module is missing.
 */
export async function openFileViaPicker(
  extensions: string[]
): Promise<{ name: string; path?: string; content: string } | null> {
  if (RNCWindowsFileManager?.openFilePicker) {
    try {
      const result = await RNCWindowsFileManager.openFilePicker(extensions);
      return JSON.parse(result);
    } catch (e: any) {
      if (e?.code !== 'CANCELLED') {
        Alert.alert('Import error', e?.message || 'Could not open file.');
      }
      return null;
    }
  }
  Alert.alert('Not available', 'The RNCWindowsFileManager native module is not built in.');
  return null;
}

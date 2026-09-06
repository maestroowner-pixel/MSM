// ===================================
// Attachments — WEB implementation (Metro loads this instead of attachments.ts
// on web). Browsers have no expo-file-system document directory, so instead of
// copying files to disk we store each file INLINE as a base64 data: URI on the
// attachment record (persisted with the item in localStorage). Data URIs render
// directly in <Image> and open in a new tab, so no path resolution is needed.
//
// NOTE: localStorage is size-limited (~5 MB/origin), so this suits a handful of
// photos/PDFs. A larger IndexedDB-backed store is a future upgrade.
// ===================================

import { uid } from '../utils/id';

// Kept for API compatibility (backup service imports it). Unused on web.
export const ATTACHMENTS_DIR = 'web-attachments/';

export async function ensureAttachmentsDir(): Promise<void> {}
export async function clearAttachmentsDir(): Promise<void> {}
export async function deleteFile(_uri?: string): Promise<void> {} // data lives in the record

/** Data URIs are self-contained — nothing to re-base. */
/**
 * A uri fit to hand to <Image> or a link.
 *
 * On web an attachment is its own data, so there is normally nothing to resolve.
 * The exception is the marker the sync layer leaves where an inline file could
 * not be uploaded (firebaseService.stripInlineFiles): it names a file that lives
 * on ANOTHER device, and feeding it to an <Image> draws a broken picture instead
 * of nothing. Returning undefined lets the UI show its ordinary "no file" state,
 * which is the truth here.
 */
export function resolveUri(uri?: string): string | undefined {
  if (uri === 'msm:inline-not-synced') return undefined;
  return uri;
}

export interface PickedFile {
  uri: string;
  name?: string;
  kind: 'photo' | 'document';
}

const g: any = globalThis as any;

/** Open a browser file dialog and read the chosen file as a base64 data URI. */
function pickFileWeb(accept: string, capture?: boolean): Promise<{ dataUri: string; name: string; isImage: boolean } | null> {
  return new Promise((resolve) => {
    const input = g.document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) input.capture = 'environment';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files && input.files[0];
      g.document.body.removeChild(input);
      if (!file) return resolve(null);
      const reader = new g.FileReader();
      reader.onload = () => resolve({ dataUri: String(reader.result), name: file.name, isImage: String(file.type || '').startsWith('image/') });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    g.document.body.appendChild(input);
    input.click();
  });
}

export async function pickFromCamera(): Promise<PickedFile | null> {
  // Web: request the device camera via the capture hint (falls back to a file pick).
  const r = await pickFileWeb('image/*', true);
  return r ? { uri: r.dataUri, name: r.name || 'Photo', kind: 'photo' } : null;
}

export async function pickFromLibrary(): Promise<PickedFile | null> {
  const r = await pickFileWeb('image/*');
  return r ? { uri: r.dataUri, name: r.name || 'Photo', kind: 'photo' } : null;
}

export async function pickDocument(): Promise<PickedFile | null> {
  const r = await pickFileWeb('application/pdf,image/*');
  return r ? { uri: r.dataUri, name: r.name || 'Document', kind: r.isImage ? 'photo' : 'document' } : null;
}

/** Preview/open a stored file: pop it into a new tab (image/PDF preview inline). */
export async function openFile(uri: string): Promise<void> {
  try {
    const win = g.window.open('', '_blank');
    if (win && win.document) {
      win.document.write(
        `<title>Attachment</title><body style="margin:0;background:#111">` +
          `<iframe src="${uri}" style="border:0;width:100vw;height:100vh"></iframe></body>`
      );
      win.document.close();
    } else {
      g.window.location.href = uri;
    }
  } catch {
    /* ignore */
  }
}

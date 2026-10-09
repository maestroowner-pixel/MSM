// ===================================
// ISM document files — getting the office's PDF to every device on board.
//
// A document is synced as a small record (types/docs.ts); its FILE goes to Cloud
// Storage and the record carries the download URL, the same arrangement as item
// attachments (services/attachmentStorage.ts). A file is never pushed inside the
// record: a PDF is easily larger than the 1 MiB a Firestore document may hold,
// and one oversized record would stop the whole list syncing.
//
// When the upload cannot happen (no signal, not joined to a vessel) the file
// stays where it is — a local path on a phone, a data URI on the web, kept in a
// device-only map rather than in the record — and the record says `filePending`.
// The device that has it offers "Share the file" again; nobody else is shown a
// link that cannot open.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';

import { uploadInline, isRemote } from './attachmentStorage';
import { toDataUri } from './attachments';

const PENDING_KEY = 'msm:docfiles_pending';

type Pending = Record<string, { uri: string; name: string }>;

async function loadPending(): Promise<Pending> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function savePending(p: Pending): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(p));
}

/** The file this device is still holding for a document, if any. */
export async function pendingFile(docId: string): Promise<{ uri: string; name: string } | null> {
  return (await loadPending())[docId] ?? null;
}

/**
 * Upload a document's file and return its URL; on failure keep it on this device
 * and return null. Never throws — saving the document must not wait on a signal.
 */
export async function shareDocFile(
  vessel: string | undefined,
  docId: string,
  revision: number,
  file: { uri: string; name: string }
): Promise<string | null> {
  if (isRemote(file.uri)) return file.uri;
  const imo = (vessel ?? '').replace(/\D/g, '');
  try {
    if (!imo) throw new Error('not joined to a vessel');
    const url = await uploadInline(imo, docId, `doc_${docId}_r${revision}`, await toDataUri(file.uri, file.name));
    const p = await loadPending();
    delete p[docId];
    await savePending(p);
    return url;
  } catch (e: any) {
    console.warn(`[docs] file for ${docId} stays on this device: ${e?.message ?? e}`);
    const p = await loadPending();
    p[docId] = file;
    await savePending(p);
    return null;
  }
}

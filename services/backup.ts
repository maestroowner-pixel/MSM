// ===================================
// Backup service
// Full app snapshot to a single self-contained .msm file: all categories +
// vessel info + certificates + the inspection trail and crew list, AND the
// attachment/certificate/inspection binaries (photos, PDFs) embedded as base64.
// One file in, one file out — restore re-creates the files on the new device and
// rewrites their paths.
//
// The inspection trail is the part of this file that cannot be reconstructed
// from anything else: a register can be re-imported from the vessel's
// spreadsheet, but two years of signed rounds exist nowhere but here. Its photos
// are collected exactly like the items' own, or a restored backup would show
// evidence photos as blanks — which is worse than not carrying them at all.
// ===================================

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { deliverFile, pickFileBase64, base64ToUtf8, onWeb, onWindows } from '../utils/fileShare';
import { pickTextFileWeb } from '../utils/webFile';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { CompressorState, normalizeCompressorState } from '../types/compressor';
import { Inspection } from '../types/inspection';
import { CrewMember } from '../types/crew';
import { CATEGORIES } from '../constants/categories';
import * as storage from '../services/storage';
import { VesselInfo } from '../services/storage';
import { ATTACHMENTS_DIR, ensureAttachmentsDir, resolveUri } from '../services/attachments';
import { fileDateStamp } from '../utils/dates';

const BACKUP_MAGIC = 'MarineSafetyManager';
const BACKUP_VERSION = 3;

export interface BackupFile {
  app: typeof BACKUP_MAGIC;
  version: number;
  exportedAt: number;
  vessel: VesselInfo | null;
  categories: Partial<Record<CategoryKey, EquipmentItem[]>>;
  certificates: Certificate[];
  compressor?: CompressorState;
  /** v3+. Absent in a v2 file — restored as empty, never as a failure. */
  inspections?: Inspection[];
  crew?: CrewMember[];
  files?: Record<string, string>; // basename -> base64 of the file contents
}

export interface BackupSummary {
  /** The file it came from, where the platform gave us one. */
  fileName?: string;
  items: number;
  certificates: number;
  categories: number;
  files: number;
  inspections: number;
  crew: number;
  vessel: string | null;
}

function basenameOf(uri?: string): string | null {
  if (!uri) return null;
  const name = uri.split('/').pop();
  return name || null;
}

function summarize(b: BackupFile): BackupSummary {
  let items = 0;
  let categories = 0;
  for (const c of CATEGORIES) {
    const n = b.categories[c.key]?.length ?? 0;
    items += n;
    if (n > 0) categories++;
  }
  return {
    items,
    certificates: b.certificates?.length ?? 0,
    categories,
    files: b.files ? Object.keys(b.files).length : 0,
    inspections: b.inspections?.length ?? 0,
    crew: b.crew?.length ?? 0,
    vessel: b.vessel?.vessel_name || (b.vessel?.imo ? `IMO ${b.vessel.imo}` : null),
  };
}

/** Every file uri referenced by items + certificates that lives in our dir. */
function collectFileUris(
  categories: Record<CategoryKey, EquipmentItem[]>,
  certificates: Certificate[],
  inspections: Inspection[] = []
): string[] {
  const uris = new Set<string>();
  // Re-base onto the current document dir first: iOS container UUIDs change on
  // reinstall, so a saved uri may carry a stale prefix that no longer matches
  // ATTACHMENTS_DIR — without this, such files would be silently dropped.
  const add = (uri?: string) => {
    const r = resolveUri(uri);
    if (r?.startsWith(ATTACHMENTS_DIR)) uris.add(r);
  };
  for (const c of CATEGORIES) {
    for (const it of categories[c.key] ?? []) {
      for (const att of it.attachments ?? []) add(att.uri);
    }
  }
  for (const cert of certificates) add(cert.fileUri);
  for (const insp of inspections) {
    for (const photo of insp.photos ?? []) add(photo.uri);
  }
  return Array.from(uris);
}

/** Gather everything + embedded files, then write+share a .msm file. */
export async function exportBackup(vessel: VesselInfo | null): Promise<BackupSummary> {
  const categories = await storage.loadAll();
  const certificates = await storage.loadCertificates();
  const compressor = await storage.loadCompressor();
  const inspections = await storage.loadInspections();
  const crew = await storage.loadCrew();

  // Read each referenced binary into a basename -> base64 map.
  const files: Record<string, string> = {};
  for (const uri of collectFileUris(categories, certificates, inspections)) {
    const base = basenameOf(uri);
    if (!base || files[base]) continue;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) files[base] = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    } catch {
      /* skip unreadable file, keep the rest of the backup */
    }
  }

  const backup: BackupFile = {
    app: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    vessel,
    categories,
    certificates,
    compressor,
    inspections,
    crew,
    files,
  };

  const fileName = `MSM_backup_${fileDateStamp()}.msm`;
  await deliverFile(fileName, JSON.stringify(backup), false, 'application/json');
  return summarize(backup);
}

/** Parse + validate a .msm payload. Throws on a non-backup file. */
export function parseBackup(text: string, fileName?: string): BackupFile {
  // The name is carried into every message on purpose. "Not a valid backup" with
  // no subject is indistinguishable from the app ignoring the click, which is
  // exactly how this failure was described from the outside.
  const who = fileName ? `"${fileName}"` : 'This file';
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e: any) {
    throw new Error(
      `${who} is not readable as a backup — its contents are not valid JSON ` +
        `(${String(e?.message ?? e).slice(0, 120)}).`
    );
  }
  if (!data || typeof data !== 'object') {
    throw new Error(`${who} does not contain a backup object.`);
  }
  if (data.app !== BACKUP_MAGIC) {
    throw new Error(
      `${who} is not a Marine Safety Manager backup` +
        (data.app ? ` — it says it belongs to "${String(data.app).slice(0, 40)}".` : '.')
    );
  }
  if (!data.categories) {
    throw new Error(`${who} is a Marine Safety Manager backup but carries no register.`);
  }
  return data as BackupFile;
}

/** Let the user pick a .msm file and return its parsed contents + a summary. */
export async function pickBackup(): Promise<{ backup: BackupFile; summary: BackupSummary } | null> {
  if (onWindows) {
    const picked = await pickFileBase64(['msm']);
    if (!picked) return null;
    const backup = parseBackup(base64ToUtf8(picked.base64));
    return { backup, summary: summarize(backup) };
  }
  // WEB: our own file input, filtered BY EXTENSION. expo-document-picker builds
  // its `accept` from MIME types, and `.msm` has none — macOS then greys the
  // backup out and it cannot be selected at all. Reading it is ours too, because
  // expo-file-system has no readAsStringAsync in a browser.
  if (onWeb) {
    const file = await pickTextFileWeb('.msm,.json,application/json');
    if (file == null) return null; // a real cancel — the picker no longer guesses
    if (!file.text.trim()) {
      throw new Error(`"${file.name}" is empty (0 of ${file.size} bytes could be read).`);
    }
    const backup = parseBackup(file.text, file.name);
    return { backup, summary: { ...summarize(backup), fileName: file.name } };
  }

  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: 'utf8' });
  const backup = parseBackup(text);
  return { backup, summary: summarize(backup) };
}

/**
 * Overwrite all local data from a parsed backup: re-create the embedded files
 * in this device's attachments dir and rewrite every uri to the local path.
 */
/** MIME type for an embedded backup file, from its extension. */
function mimeOf(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

export async function restoreBackup(backup: BackupFile): Promise<void> {
  const files = backup.files ?? {};
  const restored = new Map<string, string>(); // basename -> uri to point at

  if (Object.keys(files).length) {
    if (onWeb) {
      // A browser has no writable attachments directory — on web an attachment
      // IS its data URI (see services/attachments.web.ts). Turning the embedded
      // base64 into data URIs is what lets a backup made on a PHONE restore into
      // the web app WITH its photographs; before this the writes threw, were
      // swallowed one by one, and the register came back with every image broken.
      for (const [base, b64] of Object.entries(files)) {
        restored.set(base, `data:${mimeOf(base)};base64,${b64}`);
      }
    } else {
      await ensureAttachmentsDir();
      for (const [base, b64] of Object.entries(files)) {
        try {
          await FileSystem.writeAsStringAsync(`${ATTACHMENTS_DIR}${base}`, b64, { encoding: 'base64' });
          restored.set(base, `${ATTACHMENTS_DIR}${base}`);
        } catch {
          /* skip a single bad file */
        }
      }
    }
  }

  // Point each reference at the local copy (documentDirectory differs per install).
  const relink = (uri?: string): string | undefined => {
    const base = basenameOf(uri);
    return (base && restored.get(base)) || uri;
  };

  for (const c of CATEGORIES) {
    const items = (backup.categories[c.key] ?? []).map((it) =>
      it.attachments?.length
        ? { ...it, attachments: it.attachments.map((a) => ({ ...a, uri: relink(a.uri) ?? a.uri })) }
        : it
    );
    await storage.replaceCategory(c.key, items);
  }

  const certs = (backup.certificates ?? []).map((cert) =>
    cert.fileUri ? { ...cert, fileUri: relink(cert.fileUri) } : cert
  );
  await storage.saveCertificates(certs);

  // Inspection photos are relinked the same way the items' are — an evidence
  // photo that restores as a broken path makes the record look falsified.
  if (backup.inspections) {
    await storage.saveInspections(
      backup.inspections.map((i) =>
        i.photos?.length
          ? { ...i, photos: i.photos.map((p) => ({ ...p, uri: relink(p.uri) ?? p.uri })) }
          : i
      )
    );
  }
  if (backup.crew) await storage.saveCrew(backup.crew);

  if (backup.compressor) await storage.saveCompressor(normalizeCompressorState(backup.compressor));
  if (backup.vessel) await storage.saveVessel(backup.vessel);
}

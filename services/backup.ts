// ===================================
// Backup service
// Full app snapshot to a single self-contained .msm file: all categories +
// vessel info + certificates, AND the attachment/certificate binaries (photos,
// PDFs) embedded as base64. One file in, one file out — restore re-creates the
// files on the new device and rewrites their paths.
// ===================================

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { deliverFile, pickFileBase64, base64ToUtf8, onDesktop } from '../utils/fileShare';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { CompressorState, normalizeCompressorState } from '../types/compressor';
import { CATEGORIES } from '../constants/categories';
import * as storage from '../services/storage';
import { VesselInfo } from '../services/storage';
import { ATTACHMENTS_DIR, ensureAttachmentsDir } from '../services/attachments';
import { fileDateStamp } from '../utils/dates';

const BACKUP_MAGIC = 'MarineSafetyManager';
const BACKUP_VERSION = 2;

export interface BackupFile {
  app: typeof BACKUP_MAGIC;
  version: number;
  exportedAt: number;
  vessel: VesselInfo | null;
  categories: Partial<Record<CategoryKey, EquipmentItem[]>>;
  certificates: Certificate[];
  compressor?: CompressorState;
  files?: Record<string, string>; // basename -> base64 of the file contents
}

export interface BackupSummary {
  items: number;
  certificates: number;
  categories: number;
  files: number;
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
    vessel: b.vessel?.vessel_name || (b.vessel?.imo ? `IMO ${b.vessel.imo}` : null),
  };
}

/** Every file uri referenced by items + certificates that lives in our dir. */
function collectFileUris(
  categories: Record<CategoryKey, EquipmentItem[]>,
  certificates: Certificate[]
): string[] {
  const uris = new Set<string>();
  for (const c of CATEGORIES) {
    for (const it of categories[c.key] ?? []) {
      for (const att of it.attachments ?? []) {
        if (att.uri?.startsWith(ATTACHMENTS_DIR)) uris.add(att.uri);
      }
    }
  }
  for (const cert of certificates) {
    if (cert.fileUri?.startsWith(ATTACHMENTS_DIR)) uris.add(cert.fileUri);
  }
  return Array.from(uris);
}

/** Gather everything + embedded files, then write+share a .msm file. */
export async function exportBackup(vessel: VesselInfo | null): Promise<BackupSummary> {
  const categories = await storage.loadAll();
  const certificates = await storage.loadCertificates();
  const compressor = await storage.loadCompressor();

  // Read each referenced binary into a basename -> base64 map.
  const files: Record<string, string> = {};
  for (const uri of collectFileUris(categories, certificates)) {
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
    files,
  };

  const fileName = `MSM_backup_${fileDateStamp()}.msm`;
  await deliverFile(fileName, JSON.stringify(backup), false, 'application/json');
  return summarize(backup);
}

/** Parse + validate a .msm payload. Throws on a non-backup file. */
export function parseBackup(text: string): BackupFile {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Not a valid .msm backup (could not read file).');
  }
  if (!data || data.app !== BACKUP_MAGIC || !data.categories) {
    throw new Error('This file is not a Marine Safety Manager backup.');
  }
  return data as BackupFile;
}

/** Let the user pick a .msm file and return its parsed contents + a summary. */
export async function pickBackup(): Promise<{ backup: BackupFile; summary: BackupSummary } | null> {
  if (onDesktop) {
    const picked = await pickFileBase64(['msm']);
    if (!picked) return null;
    const backup = parseBackup(base64ToUtf8(picked.base64));
    return { backup, summary: summarize(backup) };
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
export async function restoreBackup(backup: BackupFile): Promise<void> {
  const files = backup.files ?? {};
  const restored = new Set<string>();
  if (Object.keys(files).length) {
    await ensureAttachmentsDir();
    for (const [base, b64] of Object.entries(files)) {
      try {
        await FileSystem.writeAsStringAsync(`${ATTACHMENTS_DIR}${base}`, b64, { encoding: 'base64' });
        restored.add(base);
      } catch {
        /* skip a single bad file */
      }
    }
  }

  // Point each reference at the local copy (documentDirectory differs per install).
  const relink = (uri?: string): string | undefined => {
    const base = basenameOf(uri);
    if (base && restored.has(base)) return `${ATTACHMENTS_DIR}${base}`;
    return uri;
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

  if (backup.compressor) await storage.saveCompressor(normalizeCompressorState(backup.compressor));
  if (backup.vessel) await storage.saveVessel(backup.vessel);
}

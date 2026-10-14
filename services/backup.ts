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
import { RestDay } from '../types/rest';
import { Machine, PmsDone, PmsJob, PmsDeferral, PmsDefect, PmsProject } from '../types/pms';
import { SpareMove, SparePart } from '../types/spares';
import { DocAck, IsmDoc } from '../types/docs';
import { CrewPrivate } from '../types/crew';
import { Permit, RiskAssessment } from '../types/permits';
import { FuelBunker, FuelDailySent, FuelReading, FuelTank, FuelTransfer } from '../types/fuel';
import { GarbageEntry, GarbageMasterSign } from '../types/garbage';
import { OrbEntry, OrbMasterSign } from '../types/orb';
import { LogEntry, LogMonthSign } from '../types/logbook';
import { InspectionRound } from '../types/round';
import { SopepCheck, SopepDrill, SopepItem, SopepLocker } from '../types/sopep';
import { Survey, SurveyDone } from '../types/survey';
import { NonConformity, SafetyObservation } from '../types/safety';
import { Drill } from '../types/drills';
import { MedCheck, MedItem, MedMove, MedOrder, MedTreatment } from '../types/hospital';
import { Passenger, PassengerPrivate } from '../types/passengers';
import { SafetyMeeting } from '../types/meetings';
import { StoreItem, StoreMove } from '../types/stores';
import { CrewMove, SecurityDrill, SecurityLevelRec, Visitor } from '../types/security';
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
  /** Hours of rest, one record per person per day. Absent in backups made before it existed. */
  rest?: RestDay[];
  /** Planned maintenance. Absent in backups made before it existed. */
  pms?: { machines: Machine[]; jobs: PmsJob[]; done: PmsDone[]; deferrals?: PmsDeferral[]; defects?: PmsDefect[]; projects?: PmsProject[] };
  /** Spare parts and their movements. Absent in backups made before it existed. */
  spares?: { parts: SparePart[]; moves: SpareMove[] };
  /** ISM documents (records; files are links) and read-and-sign signatures. */
  docs?: { docs: IsmDoc[]; acks: DocAck[] };
  /** Crew personal details and next of kin (the Master's backup). */
  crewPrivate?: CrewPrivate[];
  /** Permits to work and risk assessments. */
  ptw?: { permits: Permit[]; risks: RiskAssessment[] };
  /** Fuel tanks, soundings, bunkerings, transfers. */
  fuel?: { tanks: FuelTank[]; readings: FuelReading[]; bunkers: FuelBunker[]; transfers: FuelTransfer[]; daily?: FuelDailySent[] };
  /** Garbage Record Book entries and the Master's monthly signatures. */
  garbage?: { entries: GarbageEntry[]; signs: GarbageMasterSign[] };
  /** Oil Record Book Part I. */
  orb?: { entries: OrbEntry[]; signs: OrbMasterSign[] };
  /** Inspection rounds. */
  rounds?: InspectionRound[];
  /** Sewage and Ballast Water record books. */
  sewage?: { entries: LogEntry[]; signs: LogMonthSign[] };
  ballast?: { entries: LogEntry[]; signs: LogMonthSign[] };
  /** SOPEP locker, checks, drills; ISPS visitor log and security levels. */
  sopep?: { lockers?: SopepLocker[]; items: SopepItem[]; checks: SopepCheck[]; drills: SopepDrill[] };
  /** Surveys & audits: the plan and what was carried out. */
  surveys?: { plan: Survey[]; done: SurveyDone[] };
  /** QHSE: observation cards and non-conformities. */
  qhse?: { observations: SafetyObservation[]; ncs: NonConformity[] };
  /** Drills: planned and carried out. */
  drills?: Drill[];
  /** Hospital: the chest, its moves, the medical log. */
  hospital?: { items: MedItem[]; moves: MedMove[]; treatments: MedTreatment[]; orders?: MedOrder[]; checks?: MedCheck[] };
  passengers?: { list: Passenger[]; private?: PassengerPrivate[] };
  safetyMeetings?: SafetyMeeting[];
  stores?: { items: StoreItem[]; moves: StoreMove[] };
  security?: { visitors: Visitor[]; levels: SecurityLevelRec[]; drills?: SecurityDrill[]; crewMoves?: CrewMove[] };
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
  rest: number;
  pmsJobs: number;
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
  for (const list of Object.values(b.categories ?? {})) {
    const n = list?.length ?? 0;
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
    rest: b.rest?.length ?? 0,
    pmsJobs: b.pms?.jobs?.length ?? 0,
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
  for (const items of Object.values(categories ?? {})) {
    for (const it of items ?? []) {
      for (const att of it.attachments ?? []) add(att.uri);
    }
  }
  for (const cert of certificates) add(cert.fileUri);
  for (const insp of inspections) {
    for (const photo of insp.photos ?? []) add(photo.uri);
  }
  return Array.from(uris);
}

/**
 * Save one of the device's automatic copies as a `.msm` file, WITHOUT rolling
 * back to it — so an old register can be handed over for repair (relinking
 * inspections) while the device keeps working on today's data. Records only:
 * the copies never held photos.
 */
export async function saveCopyAsFile(b: BackupFile): Promise<void> {
  const d = new Date(b.exportedAt);
  const stamp = `${fileDateStamp(d)}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  await deliverFile(`MSM_copy_${stamp}.msm`, JSON.stringify(b), false, 'application/json');
}

/** Gather everything + embedded files, then write+share a .msm file. */
export async function exportBackup(vessel: VesselInfo | null): Promise<BackupSummary> {
  // Every bucket, including any this build cannot name — a backup that drops a
  // module's categories restores as a deletion. See storage.loadAllWithForeign.
  const categories = await storage.loadAllWithForeign();
  const certificates = await storage.loadCertificates();
  const compressor = await storage.loadCompressor();
  const inspections = await storage.loadInspections();
  const crew = await storage.loadCrew();
  const rest = await storage.loadRest();
  const pms = {
    machines: await storage.loadList<Machine>(storage.PMS_MACHINES_KEY),
    jobs: await storage.loadList<PmsJob>(storage.PMS_JOBS_KEY),
    done: await storage.loadList<PmsDone>(storage.PMS_DONE_KEY),
    deferrals: await storage.loadList<PmsDeferral>(storage.PMS_DEFERRALS_KEY),
    defects: await storage.loadList<PmsDefect>(storage.PMS_DEFECTS_KEY),
    projects: await storage.loadList<PmsProject>(storage.PMS_PROJECTS_KEY),
  };
  const spares = {
    parts: await storage.loadList<SparePart>(storage.SPARES_KEY),
    moves: await storage.loadList<SpareMove>(storage.SPARE_MOVES_KEY),
  };
  const docs = {
    docs: await storage.loadList<IsmDoc>(storage.DOCS_KEY),
    acks: await storage.loadList<DocAck>(storage.DOC_ACKS_KEY),
  };
  const crewPrivate = await storage.loadList<CrewPrivate>(storage.CREW_PRIVATE_KEY);
  const ptw = { permits: await storage.loadList<Permit>(storage.PERMITS_KEY), risks: await storage.loadList<RiskAssessment>(storage.RISKS_KEY) };
  const fuel = {
    tanks: await storage.loadList<FuelTank>(storage.FUEL_TANKS_KEY),
    readings: await storage.loadList<FuelReading>(storage.FUEL_READINGS_KEY),
    bunkers: await storage.loadList<FuelBunker>(storage.FUEL_BUNKERS_KEY),
    transfers: await storage.loadList<FuelTransfer>(storage.FUEL_TRANSFERS_KEY),
    daily: await storage.loadList<FuelDailySent>(storage.FUEL_DAILY_KEY),
  };
  const rounds = await storage.loadList<InspectionRound>(storage.ROUNDS_KEY);
  const sewage = { entries: await storage.loadList<LogEntry>(storage.SEWAGE_KEY), signs: await storage.loadList<LogMonthSign>(storage.SEWAGE_SIGNS_KEY) };
  const ballast = { entries: await storage.loadList<LogEntry>(storage.BALLAST_KEY), signs: await storage.loadList<LogMonthSign>(storage.BALLAST_SIGNS_KEY) };
  const orb = { entries: await storage.loadList<OrbEntry>(storage.ORB_KEY), signs: await storage.loadList<OrbMasterSign>(storage.ORB_SIGNS_KEY) };
  const garbage = { entries: await storage.loadList<GarbageEntry>(storage.GARBAGE_KEY), signs: await storage.loadList<GarbageMasterSign>(storage.GARBAGE_SIGNS_KEY) };
  const qhse = { observations: await storage.loadList<SafetyObservation>(storage.OBSERVATIONS_KEY), ncs: await storage.loadList<NonConformity>(storage.NCS_KEY) };
  const drills = await storage.loadList<Drill>(storage.DRILLS_KEY);
  const safetyMeetings = await storage.loadList<SafetyMeeting>(storage.SAFETY_MEETINGS_KEY);
  const stores = { items: await storage.loadList<StoreItem>(storage.STORE_ITEMS_KEY), moves: await storage.loadList<StoreMove>(storage.STORE_MOVES_KEY) };
  const passengers = { list: await storage.loadList<Passenger>(storage.PASSENGERS_KEY), private: await storage.loadList<PassengerPrivate>(storage.PASSENGERS_PRIVATE_KEY) };
  const hospital = { items: await storage.loadList<MedItem>(storage.MED_ITEMS_KEY), moves: await storage.loadList<MedMove>(storage.MED_MOVES_KEY), treatments: await storage.loadList<MedTreatment>(storage.MED_TREATMENTS_KEY), orders: await storage.loadList<MedOrder>(storage.MED_ORDERS_KEY), checks: await storage.loadList<MedCheck>(storage.MED_CHECKS_KEY) };
  const surveys = { plan: await storage.loadList<Survey>(storage.SURVEYS_KEY), done: await storage.loadList<SurveyDone>(storage.SURVEYS_DONE_KEY) };
  const sopep = { lockers: await storage.loadList<SopepLocker>(storage.SOPEP_LOCKERS_KEY), items: await storage.loadList<SopepItem>(storage.SOPEP_ITEMS_KEY), checks: await storage.loadList<SopepCheck>(storage.SOPEP_CHECKS_KEY), drills: await storage.loadList<SopepDrill>(storage.SOPEP_DRILLS_KEY) };
  const security = { visitors: await storage.loadList<Visitor>(storage.VISITORS_KEY), levels: await storage.loadList<SecurityLevelRec>(storage.SECURITY_LEVEL_KEY), drills: await storage.loadList<SecurityDrill>(storage.SECURITY_DRILLS_KEY), crewMoves: await storage.loadList<CrewMove>(storage.CREW_MOVES_KEY) };

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
    rest,
    pms,
    spares,
    docs,
    crewPrivate,
    ptw,
    fuel,
    garbage,
    orb,
    rounds,
    sewage,
    ballast,
    sopep,
    security,
    surveys,
    qhse,
    drills,
    hospital,
    passengers,
    safetyMeetings,
    stores,
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
      `${who} is not an ISMpilot backup` +
        (data.app ? ` — it says it belongs to "${String(data.app).slice(0, 40)}".` : '.')
    );
  }
  if (!data.categories) {
    throw new Error(`${who} is an ISMpilot backup but carries no register.`);
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

  // The registry AND whatever the file carries: a backup taken on a build that
  // knew more categories than this one restores whole, and the extra buckets are
  // recorded so this device forwards them instead of deleting them.
  const known = CATEGORIES.map((c) => String(c.key));
  const keys = new Set<string>([...known, ...Object.keys(backup.categories ?? {})]);
  const foreign: string[] = [];
  for (const key of keys) {
    const items = ((backup.categories as Record<string, EquipmentItem[]>)[key] ?? []).map((it) =>
      it.attachments?.length
        ? { ...it, attachments: it.attachments.map((a) => ({ ...a, uri: relink(a.uri) ?? a.uri })) }
        : it
    );
    await storage.replaceCategory(key as CategoryKey, items);
    if (!known.includes(key) && items.length) foreign.push(key);
  }
  await storage.saveForeignCategories(foreign);

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
  if (backup.rest) await storage.saveRest(backup.rest);
  if (backup.pms) {
    await storage.saveList(storage.PMS_MACHINES_KEY, backup.pms.machines ?? []);
    await storage.saveList(storage.PMS_JOBS_KEY, backup.pms.jobs ?? []);
    await storage.saveList(storage.PMS_DONE_KEY, backup.pms.done ?? []);
    await storage.saveList(storage.PMS_DEFERRALS_KEY, backup.pms.deferrals ?? []);
    await storage.saveList(storage.PMS_DEFECTS_KEY, backup.pms.defects ?? []);
    await storage.saveList(storage.PMS_PROJECTS_KEY, backup.pms.projects ?? []);
  }
  if (backup.spares) {
    await storage.saveList(storage.SPARES_KEY, backup.spares.parts ?? []);
    await storage.saveList(storage.SPARE_MOVES_KEY, backup.spares.moves ?? []);
  }
  if (backup.docs) {
    await storage.saveList(storage.DOCS_KEY, backup.docs.docs ?? []);
    await storage.saveList(storage.DOC_ACKS_KEY, backup.docs.acks ?? []);
  }
  if (backup.crewPrivate) {
    await storage.saveList(storage.CREW_PRIVATE_KEY, backup.crewPrivate);
  }
  if (backup.ptw) {
    await storage.saveList(storage.PERMITS_KEY, backup.ptw.permits ?? []);
    await storage.saveList(storage.RISKS_KEY, backup.ptw.risks ?? []);
  }
  if (backup.fuel) {
    await storage.saveList(storage.FUEL_TANKS_KEY, backup.fuel.tanks ?? []);
    await storage.saveList(storage.FUEL_READINGS_KEY, backup.fuel.readings ?? []);
    await storage.saveList(storage.FUEL_BUNKERS_KEY, backup.fuel.bunkers ?? []);
    await storage.saveList(storage.FUEL_TRANSFERS_KEY, backup.fuel.transfers ?? []);
    await storage.saveList(storage.FUEL_DAILY_KEY, backup.fuel.daily ?? []);
  }
  if (backup.rounds) await storage.saveList(storage.ROUNDS_KEY, backup.rounds);
  if (backup.sewage) {
    await storage.saveList(storage.SEWAGE_KEY, backup.sewage.entries ?? []);
    await storage.saveList(storage.SEWAGE_SIGNS_KEY, backup.sewage.signs ?? []);
  }
  if (backup.ballast) {
    await storage.saveList(storage.BALLAST_KEY, backup.ballast.entries ?? []);
    await storage.saveList(storage.BALLAST_SIGNS_KEY, backup.ballast.signs ?? []);
  }
  if (backup.orb) {
    await storage.saveList(storage.ORB_KEY, backup.orb.entries ?? []);
    await storage.saveList(storage.ORB_SIGNS_KEY, backup.orb.signs ?? []);
  }
  if (backup.garbage) {
    await storage.saveList(storage.GARBAGE_KEY, backup.garbage.entries ?? []);
    await storage.saveList(storage.GARBAGE_SIGNS_KEY, backup.garbage.signs ?? []);
  }
  if (backup.qhse) {
    await storage.saveList(storage.OBSERVATIONS_KEY, backup.qhse.observations ?? []);
    await storage.saveList(storage.NCS_KEY, backup.qhse.ncs ?? []);
  }
  if (backup.drills) await storage.saveList(storage.DRILLS_KEY, backup.drills);
  if (backup.safetyMeetings) await storage.saveList(storage.SAFETY_MEETINGS_KEY, backup.safetyMeetings);
  if (backup.stores) {
    await storage.saveList(storage.STORE_ITEMS_KEY, backup.stores.items ?? []);
    await storage.saveList(storage.STORE_MOVES_KEY, backup.stores.moves ?? []);
  }
  if (backup.passengers) {
    await storage.saveList(storage.PASSENGERS_KEY, backup.passengers.list ?? []);
    await storage.saveList(storage.PASSENGERS_PRIVATE_KEY, backup.passengers.private ?? []);
  }
  if (backup.hospital) {
    await storage.saveList(storage.MED_ITEMS_KEY, backup.hospital.items ?? []);
    await storage.saveList(storage.MED_MOVES_KEY, backup.hospital.moves ?? []);
    await storage.saveList(storage.MED_TREATMENTS_KEY, backup.hospital.treatments ?? []);
    await storage.saveList(storage.MED_ORDERS_KEY, backup.hospital.orders ?? []);
    await storage.saveList(storage.MED_CHECKS_KEY, backup.hospital.checks ?? []);
  }
  if (backup.surveys) {
    await storage.saveList(storage.SURVEYS_KEY, backup.surveys.plan ?? []);
    await storage.saveList(storage.SURVEYS_DONE_KEY, backup.surveys.done ?? []);
  }
  if (backup.sopep) {
    await storage.saveList(storage.SOPEP_ITEMS_KEY, backup.sopep.items ?? []);
    await storage.saveList(storage.SOPEP_LOCKERS_KEY, backup.sopep.lockers ?? []);
    await storage.saveList(storage.SOPEP_CHECKS_KEY, backup.sopep.checks ?? []);
    await storage.saveList(storage.SOPEP_DRILLS_KEY, backup.sopep.drills ?? []);
  }
  if (backup.security) {
    await storage.saveList(storage.VISITORS_KEY, backup.security.visitors ?? []);
    await storage.saveList(storage.SECURITY_LEVEL_KEY, backup.security.levels ?? []);
    await storage.saveList(storage.SECURITY_DRILLS_KEY, backup.security.drills ?? []);
    await storage.saveList(storage.CREW_MOVES_KEY, backup.security.crewMoves ?? []);
  }

  if (backup.compressor) await storage.saveCompressor(normalizeCompressorState(backup.compressor));
  if (backup.vessel) await storage.saveVessel(backup.vessel);
}

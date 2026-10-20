// ===================================
// Data context
// Holds all equipment items in memory + vessel info, with a reload()
// so screens refresh after import / edit. Backed by AsyncStorage.
// ===================================

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { CompressorState } from '../types/compressor';
import { Inspection, InspectionPeriod } from '../types/inspection';
import { CrewMember, CrewPrivate, liveCrew } from '../types/crew';
import { RestDay } from '../types/rest';
import { Machine, PmsDone, PmsJob, PmsDeferral, PmsDefect, PmsProject , finishedOneOff } from '../types/pms';
import { SpareMove, SparePart } from '../types/spares';
import { DocAck, IsmDoc } from '../types/docs';
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
import { Passenger, PassengerPrivate } from '../types/passengers';
import { SafetyMeeting } from '../types/meetings';
import { DpCheck, DpDay, DpInfo, DpTemplate } from '../types/dp';
import { StoreItem, StoreMove, StoreRoom } from '../types/stores';
import { OfficerDoc } from '../types/officerDocs';
import type { DrillYearPlan } from '../services/drillPlan';
import { SearchPlan, SecuritySearch } from '../types/searches';
import { Checkpoint, Patrol, PatrolPlan } from '../types/patrols';
import { KeyItem, KeyMove } from '../types/keys';
import { MedCheck, MedItem, MedMove, MedOrder, MedTreatment } from '../types/hospital';
import { WatchEntry, WatchTemplate } from '../types/watchLog';
import { DeckEntry } from '../types/deckLog';
import { GmdssEntry } from '../types/gmdss';
import { InternalAudit } from '../types/audit';
import { ItemMovement, LandingReport } from '../types/movement';
import { OrderGroup, PurchaseOrder } from '../types/orders';
import { GalleyOrder } from '../types/galley';
import { live } from '../services/versions';
import { CrewMove, SecurityDrill, SecurityLevelRec, Visitor } from '../types/security';
import { ChecklistTemplate } from '../constants/checklists';
import { CategoryMeta, setVesselCategories } from '../constants/categories';
import { CATEGORIES, CATEGORY_MAP } from '../constants/categories';
import * as storage from '../services/storage';
import { followerReadings } from '../services/pmsMachines';
import * as snapshot from '../services/snapshot';
import { ScanEntry, loadScanHistory, recordScan as persistScan } from '../services/scanHistory';
import { rescheduleExpiryReminders } from '../services/notifications';
import { syncFlaggedWidget } from '../services/widgetBridge';
import { limitsActive, overflowLockedIds } from '../services/trial';
import { onEntitlementChange } from '../services/purchases';
import { DEFAULT_POLICY, SigningPolicy } from '../services/signingPolicy';
import { DEFAULT_ARCHIVE, PhotoArchiveState } from '../services/photoArchive';
import { setSoundsMuted } from '../utils/sound';

/** The logs whose records are changed by versions (Edit / Delete, Master only). */
const VERSIONED_KEYS = [storage.PMS_DONE_KEY, storage.SEWAGE_KEY, storage.BALLAST_KEY, storage.ORB_KEY, storage.FUEL_READINGS_KEY, storage.FUEL_BUNKERS_KEY, storage.FUEL_TRANSFERS_KEY, storage.SOPEP_CHECKS_KEY, storage.SOPEP_DRILLS_KEY, storage.VISITORS_KEY, storage.SECURITY_DRILLS_KEY, storage.SURVEYS_DONE_KEY];

interface DataContextType {
  loading: boolean;
  byCategory: Record<CategoryKey, EquipmentItem[]>;
  flat: EquipmentItem[];
  certificates: Certificate[];
  vessel: storage.VesselInfo | null;
  compressor: CompressorState;
  prefs: storage.Prefs;
  /** The vessel's "scan before you sign" rule (services/signingPolicy.ts). */
  signingPolicy: SigningPolicy;
  /** Store the rule on this device. Reaching the vessel is SyncContext's job. */
  setSigningPolicy: (policy: SigningPolicy) => Promise<void>;
  /** What the vessel has archived, and what the last sweep did (services/photoArchive.ts). */
  photoArchive: PhotoArchiveState;
  setPhotoArchive: (state: PhotoArchiveState) => Promise<void>;
  /** The vessel's inspection trail, append-only (see types/inspection.ts). */
  inspections: Inspection[];
  /** Who can sign an inspection. */
  crew: CrewMember[];
  /** Hours of rest, every person, every recorded day. */
  rest: RestDay[];
  saveRestDay: (day: RestDay) => Promise<void>;
  /** Planned maintenance — live records only (tombstones are kept in storage). */
  machines: Machine[];
  /** Taken out of service (Machine.scrapped): kept for their history, off everything else. */
  scrappedMachines: Machine[];
  pmsJobs: PmsJob[];
  pmsDone: PmsDone[];
  /** Jobs deferred by the Master (types/pms PmsDeferral). */
  pmsDeferrals: PmsDeferral[];
  /** Defects found on machinery, open and closed. */
  pmsDefects: PmsDefect[];
  /** Projects — yard periods, dry docks — jobs are deferred to. */
  pmsProjects: PmsProject[];
  /** Engine-room round templates (backlog #9). */
  watchTemplates: WatchTemplate[];
  /** Signed engine-room round entries — append-only. */
  watchLog: WatchEntry[];
  /** Deck watch log entries — position, course, weather, watch officer signature. */
  deckLog: DeckEntry[];
  /** GMDSS journal — daily/weekly/monthly checks, radar events, signed entries. */
  gmdssLog: GmdssEntry[];
  /** Internal audits — ISM / MLC / custom (backlog #12). */
  internalAudits: InternalAudit[];
  /** Shore movement records per equipment item — append-only (#27). */
  itemMovements: ItemMovement[];
  /** Landing / handover reports (#27). */
  landings: LandingReport[];
  saveLanding: (r: LandingReport, movements: ItemMovement[]) => Promise<void>;
  saveMovement: (m: ItemMovement) => Promise<void>;
  saveMachine: (m: Machine) => Promise<void>;
  savePmsJob: (j: PmsJob) => Promise<void>;
  /** Many systems and jobs at once — a plan loaded from the template; read back once. */
  savePlan: (machines: Machine[], jobs: PmsJob[]) => Promise<void>;
  /**
   * Record a completion and move its job's baseline, in one step — and, when the
   * job takes parts, the "used" movements that take them out of the stores.
   */
  completePmsJob: (done: PmsDone, job: PmsJob, moves?: SpareMove[]) => Promise<void>;
  /** Spare parts — live lines only — and every stock movement. */
  spares: SparePart[];
  spareMoves: SpareMove[];
  saveSpare: (p: SparePart) => Promise<void>;
  addSpareMoves: (moves: SpareMove[]) => Promise<void>;
  /** ISM documents — live only — and every read-and-sign signature. */
  docs: IsmDoc[];
  docAcks: DocAck[];
  saveDoc: (d: IsmDoc) => Promise<void>;
  addDocAck: (a: DocAck) => Promise<void>;
  /** Crew personal details and next of kin — present on Officers' and the Master's devices only. */
  crewPrivate: CrewPrivate[];
  saveCrewPrivate: (p: CrewPrivate) => Promise<void>;
  /** Permits to work and risk assessments — live only. */
  permits: Permit[];
  risks: RiskAssessment[];
  savePermit: (p: Permit) => Promise<void>;
  saveRisk: (r: RiskAssessment) => Promise<void>;
  /** Fuel — tanks (live), soundings, bunkerings, transfers. */
  fuelTanks: FuelTank[];
  fuelReadings: FuelReading[];
  fuelBunkers: FuelBunker[];
  fuelTransfers: FuelTransfer[];
  saveFuel: (kind: 'tank' | 'reading' | 'bunker' | 'transfer', row: any) => Promise<void>;
  /** Garbage Record Book — entries and the Master's monthly signatures (append-only). */
  fuelDailySent: FuelDailySent[];
  garbage: GarbageEntry[];
  /** Oil Record Book Part I — live entries (versionsOf(ORB_KEY) for every version) and the Master's months. */
  orb: OrbEntry[];
  orbSigns: OrbMasterSign[];
  /** Sewage and Ballast Water record books — live entries and the Master's months. */
  /** Inspection rounds, open and closed. */
  rounds: InspectionRound[];
  sewage: LogEntry[];
  sewageSigns: LogMonthSign[];
  ballast: LogEntry[];
  ballastSigns: LogMonthSign[];
  garbageSigns: GarbageMasterSign[];
  addGarbage: (e: GarbageEntry) => Promise<void>;
  signGarbageMonth: (s: GarbageMasterSign) => Promise<void>;
  /** SOPEP and security. */
  sopepItems: SopepItem[];
  sopepLockers: SopepLocker[];
  sopepChecks: SopepCheck[];
  sopepDrills: SopepDrill[];
  visitors: Visitor[];
  securityLevels: SecurityLevelRec[];
  securityDrills: SecurityDrill[];
  crewMoves: CrewMove[];
  /** Surveys & audits — the plan (edited) and the occasions carried out (append-only). */
  surveys: Survey[];
  /** QHSE: safety observation cards and non-conformities. */
  observations: SafetyObservation[];
  ncs: NonConformity[];
  drills: Drill[];
  /** The drill calendar — one plan per year (services/drillPlan.ts). */
  drillPlans: DrillYearPlan[];
  medItems: MedItem[];
  medMoves: MedMove[];
  medTreatments: MedTreatment[];
  passengers: Passenger[];
  safetyMeetings: SafetyMeeting[];
  /** Dynamic positioning (types/dp.ts). */
  dpChecks: DpCheck[];
  dpDays: DpDay[];
  dpInfo: DpInfo | null;
  dpTemplates: DpTemplate[];
  storeItems: StoreItem[];
  storeMoves: StoreMove[];
  /** The vessel's own stores and the built-in ones as renamed — storeRooms() puts them in order. */
  storeRoomList: StoreRoom[];
  /** Officers only (types/officerDocs.ts): the SOPEP's papers, the Ship Security Plan. */
  sopepDocs: OfficerDoc[];
  sspDocs: OfficerDoc[];
  /** Stowaway / bomb searches (types/searches.ts): the plan record (if saved) and the searches. */
  searchPlans: SearchPlan[];
  searches: SecuritySearch[];
  /** Security rounds (types/patrols.ts) and the key register (types/keys.ts). */
  checkpoints: Checkpoint[];
  patrolPlans: PatrolPlan[];
  patrols: Patrol[];
  keyList: KeyItem[];
  keyMoves: KeyMove[];
  passengersPrivate: PassengerPrivate[];
  medOrders: MedOrder[];
  medChecks: MedCheck[];
  surveysDone: SurveyDone[];
  /** Purchase orders / requisitions (types/orders.ts). */
  purchaseOrders: PurchaseOrder[];
  /** Named order groups — charters, drydocks, etc. */
  orderGroups: OrderGroup[];
  /** Galley (food & beverage) purchase orders. */
  galleyOrders: GalleyOrder[];
  /**
   * Every version of an amendable log (services/versions) by storage key. The
   * lists above (fuelReadings, visitors…) hold only the live versions.
   */
  versionsOf: (key: string) => any[];
  /** Upsert (lists edited in place) or append (records) by storage key. */
  saveRow: <T extends { id: string }>(key: string, row: T) => Promise<void>;
  /**
   * Many rows, written together and loaded back ONCE. Saving them one by one
   * reloads every list per row — fifty rows in a row ran React into its nested
   * update limit (error 185, 13 Oct 2026, the hospital scale).
   */
  saveRows: <T extends { id: string }>(key: string, rows: T[]) => Promise<void>;
  appendRow: <T extends { id: string }>(key: string, row: T) => Promise<void>;
  /** The vessel's own checklists; they replace the built-in for their category. */
  templates: ChecklistTemplate[];
  /** Headings this vessel invented, on top of the 23 the app ships. */
  categories: CategoryMeta[];
  /** Device-local scan trail, newest first (see services/scanHistory.ts). */
  recentScans: ScanEntry[];
  /** Note that this item was just scanned on this device. */
  recordScan: (id: string) => Promise<void>;
  /** Free-tier overflow-locked item ids (read-only in the UI; empty when subscribed / in trial). */
  isLocked: (id: string) => boolean;
  /** Recompute locks (call after a purchase/restore changes subscription state). */
  refreshLocks: () => Promise<void>;
  reload: () => Promise<void>;
  saveItem: (item: EquipmentItem) => Promise<void>;
  removeItem: (category: CategoryKey, id: string) => Promise<void>;
  /** Move an item to another category, keeping its id, history and certificates. */
  moveItem: (item: EquipmentItem, to: CategoryKey) => Promise<void>;
  saveCertificate: (cert: Certificate) => Promise<void>;
  /** Many certificates in one write and one reload (an SDM import brings dozens). */
  saveCertificates: (certs: Certificate[]) => Promise<void>;
  removeCertificate: (id: string) => Promise<void>;
  saveCompressor: (state: CompressorState) => Promise<void>;
  /** Record a signed inspection. Records are never edited afterwards. */
  addInspection: (insp: Inspection) => Promise<void>;
  /** Write back a record — legitimate ONLY for opening/closing its defect. */
  saveInspection: (insp: Inspection) => Promise<void>;
  saveCrewMember: (member: CrewMember) => Promise<void>;
  removeCrewMember: (id: string) => Promise<void>;
  saveTemplate: (template: ChecklistTemplate) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  /** Which frequencies this vessel works to for a category (constants/checklists `roundsFor`). */
  setRoundEnabled: (category: CategoryKey, period: InspectionPeriod, on: boolean) => Promise<void>;
  saveVesselCategory: (meta: CategoryMeta) => Promise<void>;
  /** Show or hide a category — built-in or the vessel's own (constants/categories). */
  setCategoryHidden: (key: CategoryKey, hidden: boolean) => Promise<void>;
  removeVesselCategory: (key: string) => Promise<void>;
  setPrefs: (patch: Partial<storage.Prefs>) => Promise<void>;
  setVessel: (info: storage.VesselInfo) => Promise<void>;
  countFor: (category: CategoryKey) => number;
}

const emptyByCategory = () =>
  CATEGORIES.reduce((acc, c) => {
    acc[c.key] = [];
    return acc;
  }, {} as Record<CategoryKey, EquipmentItem[]>);

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [byCategory, setByCategory] = useState<Record<CategoryKey, EquipmentItem[]>>(emptyByCategory());
  const [flat, setFlat] = useState<EquipmentItem[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [vessel, setVesselState] = useState<storage.VesselInfo | null>(null);
  const [compressor, setCompressorState] = useState<CompressorState>({ compressors: [] });
  const [prefs, setPrefsState] = useState<storage.Prefs>({});
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [rest, setRest] = useState<RestDay[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [scrappedMachines, setScrappedMachines] = useState<Machine[]>([]);
  const [pmsJobs, setPmsJobs] = useState<PmsJob[]>([]);
  const [pmsDone, setPmsDone] = useState<PmsDone[]>([]);
  const [pmsDeferrals, setPmsDeferrals] = useState<PmsDeferral[]>([]);
  const [pmsDefects, setPmsDefects] = useState<PmsDefect[]>([]);
  const [pmsProjects, setPmsProjects] = useState<PmsProject[]>([]);
  const [watchTemplates, setWatchTemplates] = useState<WatchTemplate[]>([]);
  const [internalAudits, setInternalAudits] = useState<InternalAudit[]>([]);
  const [watchLog, setWatchLog] = useState<WatchEntry[]>([]);
  const [deckLog, setDeckLog] = useState<DeckEntry[]>([]);
  const [gmdssLog, setGmdssLog] = useState<GmdssEntry[]>([]);
  const [itemMovements, setItemMovements] = useState<ItemMovement[]>([]);
  const [landings, setLandings] = useState<LandingReport[]>([]);
  const [spares, setSpares] = useState<SparePart[]>([]);
  const [spareMoves, setSpareMoves] = useState<SpareMove[]>([]);
  const [docs, setDocs] = useState<IsmDoc[]>([]);
  const [docAcks, setDocAcks] = useState<DocAck[]>([]);
  const [crewPrivate, setCrewPrivate] = useState<CrewPrivate[]>([]);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [risks, setRisks] = useState<RiskAssessment[]>([]);
  const [fuelTanks, setFuelTanks] = useState<FuelTank[]>([]);
  const [fuelReadings, setFuelReadings] = useState<FuelReading[]>([]);
  const [fuelBunkers, setFuelBunkers] = useState<FuelBunker[]>([]);
  const [fuelTransfers, setFuelTransfers] = useState<FuelTransfer[]>([]);
  const [fuelDailySent, setFuelDailySent] = useState<FuelDailySent[]>([]);
  const [garbage, setGarbage] = useState<GarbageEntry[]>([]);
  const [orb, setOrb] = useState<OrbEntry[]>([]);
  const [orbSigns, setOrbSigns] = useState<OrbMasterSign[]>([]);
  const [rounds, setRounds] = useState<InspectionRound[]>([]);
  const [sewage, setSewage] = useState<LogEntry[]>([]);
  const [sewageSigns, setSewageSigns] = useState<LogMonthSign[]>([]);
  const [ballast, setBallast] = useState<LogEntry[]>([]);
  const [ballastSigns, setBallastSigns] = useState<LogMonthSign[]>([]);
  const [garbageSigns, setGarbageSigns] = useState<GarbageMasterSign[]>([]);
  const [sopepItems, setSopepItems] = useState<SopepItem[]>([]);
  const [sopepLockers, setSopepLockers] = useState<SopepLocker[]>([]);
  const [sopepChecks, setSopepChecks] = useState<SopepCheck[]>([]);
  const [sopepDrills, setSopepDrills] = useState<SopepDrill[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [securityLevels, setSecurityLevels] = useState<SecurityLevelRec[]>([]);
  const [securityDrills, setSecurityDrills] = useState<SecurityDrill[]>([]);
  const [crewMoves, setCrewMoves] = useState<CrewMove[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [observations, setObservations] = useState<SafetyObservation[]>([]);
  const [ncs, setNcs] = useState<NonConformity[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [drillPlans, setDrillPlans] = useState<DrillYearPlan[]>([]);
  const [medItems, setMedItems] = useState<MedItem[]>([]);
  const [medMoves, setMedMoves] = useState<MedMove[]>([]);
  const [medTreatments, setMedTreatments] = useState<MedTreatment[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [safetyMeetings, setSafetyMeetings] = useState<SafetyMeeting[]>([]);
  const [dpChecks, setDpChecks] = useState<DpCheck[]>([]);
  const [dpDays, setDpDays] = useState<DpDay[]>([]);
  const [dpInfo, setDpInfo] = useState<DpInfo | null>(null);
  const [dpTemplates, setDpTemplates] = useState<DpTemplate[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [storeMoves, setStoreMoves] = useState<StoreMove[]>([]);
  const [storeRoomList, setStoreRoomList] = useState<StoreRoom[]>([]);
  const [sopepDocs, setSopepDocs] = useState<OfficerDoc[]>([]);
  const [sspDocs, setSspDocs] = useState<OfficerDoc[]>([]);
  const [searchPlans, setSearchPlans] = useState<SearchPlan[]>([]);
  const [searches, setSearches] = useState<SecuritySearch[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [patrolPlans, setPatrolPlans] = useState<PatrolPlan[]>([]);
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const [keyList, setKeyList] = useState<KeyItem[]>([]);
  const [keyMoves, setKeyMoves] = useState<KeyMove[]>([]);
  const [passengersPrivate, setPassengersPrivate] = useState<PassengerPrivate[]>([]);
  const [medOrders, setMedOrders] = useState<MedOrder[]>([]);
  const [medChecks, setMedChecks] = useState<MedCheck[]>([]);
  const [surveysDone, setSurveysDone] = useState<SurveyDone[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [galleyOrders, setGalleyOrders] = useState<GalleyOrder[]>([]);
  // Every version of the logs that can be amended — for the history and the struck-through lines.
  const [versions, setVersions] = useState<Record<string, any[]>>({});
  const versionsOf = useCallback((key: string) => versions[key] ?? [], [versions]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [recentScans, setRecentScans] = useState<ScanEntry[]>([]);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [signingPolicy, setSigningPolicyState] = useState<SigningPolicy>(DEFAULT_POLICY);
  const [photoArchive, setPhotoArchiveState] = useState<PhotoArchiveState>(DEFAULT_ARCHIVE);

  // Recompute the free-tier overflow lock from a category map: locked only when
  // limits are active (trial ended, not subscribed, enforced on this platform).
  const computeLocks = useCallback(async (map: Record<CategoryKey, EquipmentItem[]>) => {
    const locked = (await limitsActive()) ? overflowLockedIds(map) : new Set<string>();
    setLockedIds(locked);
  }, []);

  const reload = useCallback(async () => {
    // FIRST, before the register is read. `storage.loadAll` enumerates the
    // registry to decide which buckets to open, so a vessel category installed
    // after this line would leave its items in storage and off every screen.
    const ownCats = await storage.loadVesselCategories();
    setVesselCategories(ownCats);
    setCategories(ownCats);

    const all = await storage.loadAll();
    const flatArr = CATEGORIES.flatMap((c) => all[c.key]);
    setByCategory(all);
    setFlat(flatArr);
    const certs = await storage.loadCertificates();
    setCertificates(certs);
    // Read everything first, then set it all in one synchronous block: a setState
    // between awaits commits on its own, and ~40 of them in a row tripped React's
    // nested-update limit (error 185) once two more lists were added (12 Oct 2026).
    const _vesselState = await storage.loadVessel();
    const _compressorState = await storage.loadCompressor();
    const _inspections = await storage.loadInspections();
    const _crew = liveCrew(await storage.loadCrew());
    const _rest = await storage.loadRest();
    const _allMachines = (await storage.loadList<Machine>(storage.PMS_MACHINES_KEY)).filter((m) => !m.deleted);
    const _machines = _allMachines.filter((m) => !m.scrapped);
    const _pmsJobs = (await storage.loadList<PmsJob>(storage.PMS_JOBS_KEY)).filter((j) => !j.deleted && !finishedOneOff(j));
    const _pmsDone = live(await storage.loadList<PmsDone>(storage.PMS_DONE_KEY));
    const _pmsDeferrals = await storage.loadList<PmsDeferral>(storage.PMS_DEFERRALS_KEY);
    const _pmsDefects = await storage.loadList<PmsDefect>(storage.PMS_DEFECTS_KEY);
    const _pmsProjects = (await storage.loadList<PmsProject>(storage.PMS_PROJECTS_KEY)).filter((x) => !x.deleted);
    const _watchTemplates = (await storage.loadList<WatchTemplate>(storage.WATCH_TEMPLATES_KEY)).filter((x) => !x.deleted);
    const _watchLog = await storage.loadList<WatchEntry>(storage.WATCH_LOG_KEY);
    const _deckLog = await storage.loadList<DeckEntry>(storage.DECK_LOG_KEY);
    const _gmdssLog = await storage.loadList<GmdssEntry>(storage.GMDSS_KEY);
    const _internalAudits = (await storage.loadList<InternalAudit>(storage.INTERNAL_AUDITS_KEY)).filter((x) => !x.deleted);
    const _itemMovements = await storage.loadList<ItemMovement>(storage.ITEM_MOVEMENTS_KEY);
    const _landings = (await storage.loadList<LandingReport>(storage.LANDINGS_KEY)).filter((x) => !x.deleted);
    const _spares = (await storage.loadList<SparePart>(storage.SPARES_KEY)).filter((p) => !p.deleted);
    const _spareMoves = await storage.loadList<SpareMove>(storage.SPARE_MOVES_KEY);
    const _docs = (await storage.loadList<IsmDoc>(storage.DOCS_KEY)).filter((d) => !d.deleted);
    const _docAcks = await storage.loadList<DocAck>(storage.DOC_ACKS_KEY);
    const _crewPrivate = await storage.loadList<CrewPrivate>(storage.CREW_PRIVATE_KEY);
    const _permits = (await storage.loadList<Permit>(storage.PERMITS_KEY)).filter((x) => !x.deleted);
    const _risks = (await storage.loadList<RiskAssessment>(storage.RISKS_KEY)).filter((x) => !x.deleted);
    const _fuelTanks = (await storage.loadList<FuelTank>(storage.FUEL_TANKS_KEY)).filter((x) => !x.deleted).sort((a, b) => a.order - b.order);
    const _fuelReadings = live(await storage.loadList<FuelReading>(storage.FUEL_READINGS_KEY));
    const _fuelBunkers = live(await storage.loadList<FuelBunker>(storage.FUEL_BUNKERS_KEY));
    const _fuelTransfers = live(await storage.loadList<FuelTransfer>(storage.FUEL_TRANSFERS_KEY));
    const _fuelDailySent = await storage.loadList<FuelDailySent>(storage.FUEL_DAILY_KEY);
    const _garbage = await storage.loadList<GarbageEntry>(storage.GARBAGE_KEY);
    const _orb = live(await storage.loadList<OrbEntry>(storage.ORB_KEY));
    const _orbSigns = await storage.loadList<OrbMasterSign>(storage.ORB_SIGNS_KEY);
    const _rounds = await storage.loadList<InspectionRound>(storage.ROUNDS_KEY);
    const _sewage = live(await storage.loadList<LogEntry>(storage.SEWAGE_KEY));
    const _sewageSigns = await storage.loadList<LogMonthSign>(storage.SEWAGE_SIGNS_KEY);
    const _ballast = live(await storage.loadList<LogEntry>(storage.BALLAST_KEY));
    const _ballastSigns = await storage.loadList<LogMonthSign>(storage.BALLAST_SIGNS_KEY);
    const _garbageSigns = await storage.loadList<GarbageMasterSign>(storage.GARBAGE_SIGNS_KEY);
    const _sopepItems = (await storage.loadList<SopepItem>(storage.SOPEP_ITEMS_KEY)).filter((x) => !x.deleted).sort((a, b) => a.order - b.order);
    const _sopepLockers = await storage.loadList<SopepLocker>(storage.SOPEP_LOCKERS_KEY);
    const _sopepChecks = live(await storage.loadList<SopepCheck>(storage.SOPEP_CHECKS_KEY));
    const _sopepDrills = live(await storage.loadList<SopepDrill>(storage.SOPEP_DRILLS_KEY));
    const _visitors = live(await storage.loadList<Visitor>(storage.VISITORS_KEY));
    const _securityLevels = await storage.loadList<SecurityLevelRec>(storage.SECURITY_LEVEL_KEY);
    const _securityDrills = live(await storage.loadList<SecurityDrill>(storage.SECURITY_DRILLS_KEY));
    const _crewMoves = await storage.loadList<CrewMove>(storage.CREW_MOVES_KEY);
    const _surveys = (await storage.loadList<Survey>(storage.SURVEYS_KEY)).filter((x) => !x.deleted);
    const _observations = await storage.loadList<SafetyObservation>(storage.OBSERVATIONS_KEY);
    const _ncs = await storage.loadList<NonConformity>(storage.NCS_KEY);
    const _drills = (await storage.loadList<Drill>(storage.DRILLS_KEY)).filter((x) => !x.deleted);
    const _drillPlans = await storage.loadList<DrillYearPlan>(storage.DRILL_PLANS_KEY);
    const _medItems = (await storage.loadList<MedItem>(storage.MED_ITEMS_KEY)).filter((x) => !x.deleted).sort((x, y) => x.order - y.order);
    const _medMoves = await storage.loadList<MedMove>(storage.MED_MOVES_KEY);
    const _medTreatments = await storage.loadList<MedTreatment>(storage.MED_TREATMENTS_KEY);
    const _passengers = (await storage.loadList<Passenger>(storage.PASSENGERS_KEY)).filter((x) => !x.deleted);
    const _safetyMeetings = (await storage.loadList<SafetyMeeting>(storage.SAFETY_MEETINGS_KEY)).filter((x) => !x.deleted);
    const _dpChecks = await storage.loadList<DpCheck>(storage.DP_CHECKS_KEY);
    const _dpDays = (await storage.loadList<DpDay>(storage.DP_DAYS_KEY)).filter((x) => !x.deleted);
    const _dpInfo = (await storage.loadList<DpInfo>(storage.DP_INFO_KEY)).find((x) => x.id === 'info') ?? null;
    const _dpTemplates = await storage.loadList<DpTemplate>(storage.DP_TEMPLATES_KEY);
    const _storeItems = (await storage.loadList<StoreItem>(storage.STORE_ITEMS_KEY)).filter((x) => !x.deleted).sort((a, b) => a.order - b.order);
    const _storeMoves = await storage.loadList<StoreMove>(storage.STORE_MOVES_KEY);
    const _storeRooms = await storage.loadList<StoreRoom>(storage.STORE_ROOMS_KEY);
    const _sopepDocs = (await storage.loadList<OfficerDoc>(storage.SOPEP_DOCS_KEY)).filter((x) => !x.deleted);
    const _sspDocs = (await storage.loadList<OfficerDoc>(storage.SSP_DOCS_KEY)).filter((x) => !x.deleted);
    const _searchPlans = await storage.loadList<SearchPlan>(storage.SEARCH_PLAN_KEY);
    const _searches = await storage.loadList<SecuritySearch>(storage.SEARCHES_KEY);
    const _checkpoints = (await storage.loadList<Checkpoint>(storage.CHECKPOINTS_KEY)).filter((x) => !x.deleted).sort((a, b) => a.order - b.order);
    const _patrolPlans = await storage.loadList<PatrolPlan>(storage.PATROL_PLANS_KEY);
    const _patrols = await storage.loadList<Patrol>(storage.PATROLS_KEY);
    const _keyList = (await storage.loadList<KeyItem>(storage.KEYS_KEY)).filter((x) => !x.deleted);
    const _keyMoves = await storage.loadList<KeyMove>(storage.KEY_MOVES_KEY);
    const _passengersPrivate = await storage.loadList<PassengerPrivate>(storage.PASSENGERS_PRIVATE_KEY);
    const _medOrders = await storage.loadList<MedOrder>(storage.MED_ORDERS_KEY);
    const _medChecks = await storage.loadList<MedCheck>(storage.MED_CHECKS_KEY);
    const _surveysDone = live(await storage.loadList<SurveyDone>(storage.SURVEYS_DONE_KEY));
    const _purchaseOrders = (await storage.loadList<PurchaseOrder>(storage.PURCHASE_ORDERS_KEY)).filter((x) => !x.deleted);
    const _orderGroups1 = (await storage.loadList<OrderGroup>(storage.ORDER_GROUPS_KEY)).filter((x) => !x.deleted);
    const _galleyOrders1 = (await storage.loadList<GalleyOrder>(storage.GALLEY_ORDERS_KEY)).filter((x) => !x.deleted);
    const _versions = Object.fromEntries(await Promise.all(VERSIONED_KEYS.map(async (k) => [k, await storage.loadList<any>(k)] as const)));
    const _templates = await storage.loadTemplates();
    const _signingPolicyState = (await storage.loadSigningPolicy()) ?? DEFAULT_POLICY;
    const _photoArchiveState = (await storage.loadPhotoArchive()) ?? DEFAULT_ARCHIVE;
    const _recentScans = await loadScanHistory();
    setVesselState(_vesselState);
    setCompressorState(_compressorState);
    setInspections(_inspections);
    setCrew(_crew);
    setRest(_rest);
    setMachines(_machines);
    setScrappedMachines(_allMachines.filter((m) => m.scrapped));
    setPmsJobs(_pmsJobs);
    setPmsDone(_pmsDone);
    setPmsDeferrals(_pmsDeferrals);
    setPmsDefects(_pmsDefects);
    setPmsProjects(_pmsProjects);
    setWatchTemplates(_watchTemplates);
    setWatchLog(_watchLog);
    setDeckLog(_deckLog);
    setGmdssLog(_gmdssLog);
    setInternalAudits(_internalAudits);
    setItemMovements(_itemMovements);
    setLandings(_landings);
    setSpares(_spares);
    setSpareMoves(_spareMoves);
    setDocs(_docs);
    setDocAcks(_docAcks);
    setCrewPrivate(_crewPrivate);
    setPermits(_permits);
    setRisks(_risks);
    setFuelTanks(_fuelTanks);
    setFuelReadings(_fuelReadings);
    setFuelBunkers(_fuelBunkers);
    setFuelTransfers(_fuelTransfers);
    setFuelDailySent(_fuelDailySent);
    setGarbage(_garbage);
    setOrb(_orb);
    setOrbSigns(_orbSigns);
    setRounds(_rounds);
    setSewage(_sewage);
    setSewageSigns(_sewageSigns);
    setBallast(_ballast);
    setBallastSigns(_ballastSigns);
    setGarbageSigns(_garbageSigns);
    setSopepItems(_sopepItems);
    setSopepLockers(_sopepLockers);
    setSopepChecks(_sopepChecks);
    setSopepDrills(_sopepDrills);
    setVisitors(_visitors);
    setSecurityLevels(_securityLevels);
    setSecurityDrills(_securityDrills);
    setCrewMoves(_crewMoves);
    setSurveys(_surveys);
    setObservations(_observations);
    setNcs(_ncs);
    setDrills(_drills);
    setDrillPlans(_drillPlans);
    setMedItems(_medItems);
    setMedMoves(_medMoves);
    setMedTreatments(_medTreatments);
    setPassengers(_passengers);
    setSafetyMeetings(_safetyMeetings);
    setDpChecks(_dpChecks);
    setDpDays(_dpDays);
    setDpInfo(_dpInfo);
    setDpTemplates(_dpTemplates);
    setStoreItems(_storeItems);
    setStoreMoves(_storeMoves);
    setStoreRoomList(_storeRooms);
    setSopepDocs(_sopepDocs);
    setSspDocs(_sspDocs);
    setSearchPlans(_searchPlans);
    setSearches(_searches);
    setCheckpoints(_checkpoints);
    setPatrolPlans(_patrolPlans);
    setPatrols(_patrols);
    setKeyList(_keyList);
    setKeyMoves(_keyMoves);
    setPassengersPrivate(_passengersPrivate);
    setMedOrders(_medOrders);
    setMedChecks(_medChecks);
    setSurveysDone(_surveysDone);
    setPurchaseOrders(_purchaseOrders);
    setOrderGroups(_orderGroups1);
    setGalleyOrders(_galleyOrders1);
    setVersions(_versions);
    setTemplates(_templates);
    setSigningPolicyState(_signingPolicyState);
    setPhotoArchiveState(_photoArchiveState);
    setRecentScans(_recentScans);
    const p = await storage.loadPrefs();
    setPrefsState(p);
    setLoading(false);
    void computeLocks(all);
    // Keep expiry reminders in sync with the data (no-op unless enabled/supported).
    if (p.notificationsEnabled) rescheduleExpiryReminders(flatArr, certs);
  }, [computeLocks]);

  const refreshLocks = useCallback(async () => {
    await computeLocks(byCategory);
  }, [computeLocks, byCategory]);

  // A licence arriving (or lapsing) changes which items are locked, wherever it
  // came from. Only the paywall used to recompute, so a licence adopted from the
  // vessel on connect left every locked row locked until the app was restarted.
  useEffect(() => onEntitlementChange(() => void computeLocks(byCategory)), [computeLocks, byCategory]);

  const isLocked = useCallback((id: string) => lockedIds.has(id), [lockedIds]);

  useEffect(() => {
    reload();
  }, [reload]);

  /**
   * One automatic snapshot per launch, once the data is actually loaded.
   *
   * AFTER `loading` clears, never before: a snapshot taken mid-load would record
   * a half-empty register and, three launches later, be the only copy left. It
   * runs once per session (the ref), because the point is a picture of what the
   * app opened with — not a running mirror of every edit, which is what sync is
   * for. Failures are swallowed inside takeSnapshot: a safety net that can stop
   * the app starting is worse than no safety net.
   */
  const snapshotDone = useRef(false);
  useEffect(() => {
    if (loading || snapshotDone.current) return;
    snapshotDone.current = true;
    void snapshot.takeSnapshot(vessel).then((r) => {
      if (r !== 'unchanged' && r !== 'nothing-to-save') console.log('[snapshot]', r);
    });
    // vessel is read inside; re-running on its arrival would take a second
    // snapshot of the same launch for no gain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Keep the home-screen widgets' flagged snapshot in step with the register.
  // Debounced because a burst of edits (an import, clearing several flags) would
  // otherwise reload the widget timelines repeatedly for no visible gain. Waits
  // for the first load so the widget is never blanked by an empty pre-load state.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      void syncFlaggedWidget(flat);
    }, 400);
    return () => clearTimeout(t);
  }, [flat, loading]);

  const saveItem = useCallback(
    async (item: EquipmentItem) => {
      await storage.upsertItem(item);
      await reload();
    },
    [reload]
  );

  // Its own key, its own state: no register write, so nothing here can be undone
  // by the item screen the scan is about to open (see services/scanHistory.ts).
  const recordScan = useCallback(async (id: string) => {
    setRecentScans(await persistScan(id));
  }, []);

  const removeItem = useCallback(
    async (category: CategoryKey, id: string) => {
      await storage.deleteItem(category, id);
      await reload();
    },
    [reload]
  );

  const moveItem = useCallback(
    async (item: EquipmentItem, to: CategoryKey) => {
      await storage.moveItem(item, to);
      await reload();
    },
    [reload]
  );

  const saveCertificate = useCallback(
    async (cert: Certificate) => {
      await storage.upsertCertificate(cert);
      await reload();
    },
    [reload]
  );

  const saveCertificates = useCallback(
    async (certs: Certificate[]) => {
      if (!certs.length) return;
      const list = await storage.loadCertificates();
      const byId = new Map(list.map((c, i) => [c.id, i]));
      const now = Date.now();
      for (const c of certs) {
        const next = { ...c, updatedAt: now };
        const i = byId.get(c.id);
        if (i != null) list[i] = next;
        else {
          byId.set(c.id, list.length);
          list.push(next);
        }
      }
      await storage.saveCertificates(list);
      await reload();
    },
    [reload]
  );

  const removeCertificate = useCallback(
    async (id: string) => {
      await storage.deleteCertificate(id);
      await reload();
    },
    [reload]
  );

  const saveCompressor = useCallback(
    async (state: CompressorState) => {
      await storage.saveCompressor(state);
      setCompressorState(state);
    },
    []
  );

  // Append-only: the state update mirrors what storage did rather than re-reading
  // the whole trail, and nothing here touches the register — an inspection says
  // what a person did, not what the equipment is. A defect raised by a failed
  // round lives ON the record (and shows on the item and in the defect list from
  // there); it deliberately does not set the item's `flagged`, which stays the
  // separate human "come back to this" it has always been.
  const addInspection = useCallback(async (insp: Inspection) => {
    await storage.appendInspection(insp);
    setInspections((prev) => (prev.some((i) => i.id === insp.id) ? prev : [insp, ...prev]));
  }, []);

  const saveInspection = useCallback(async (insp: Inspection) => {
    await storage.updateInspection(insp);
    setInspections((prev) => prev.map((i) => (i.id === insp.id ? insp : i)));
  }, []);

  const loadPms = useCallback(async () => {
    // Read everything first, then set it all in one synchronous block: a setState
    // between awaits commits on its own, and ~40 of them in a row tripped React's
    // nested-update limit (error 185) once two more lists were added (12 Oct 2026).
    const _allMachines = (await storage.loadList<Machine>(storage.PMS_MACHINES_KEY)).filter((m) => !m.deleted);
    const _machines = _allMachines.filter((m) => !m.scrapped);
    const _pmsJobs = (await storage.loadList<PmsJob>(storage.PMS_JOBS_KEY)).filter((j) => !j.deleted && !finishedOneOff(j));
    const _pmsDone = live(await storage.loadList<PmsDone>(storage.PMS_DONE_KEY));
    const _pmsDeferrals = await storage.loadList<PmsDeferral>(storage.PMS_DEFERRALS_KEY);
    const _pmsDefects = await storage.loadList<PmsDefect>(storage.PMS_DEFECTS_KEY);
    const _pmsProjects = (await storage.loadList<PmsProject>(storage.PMS_PROJECTS_KEY)).filter((x) => !x.deleted);
    const _watchTemplates = (await storage.loadList<WatchTemplate>(storage.WATCH_TEMPLATES_KEY)).filter((x) => !x.deleted);
    const _watchLog = await storage.loadList<WatchEntry>(storage.WATCH_LOG_KEY);
    const _deckLog = await storage.loadList<DeckEntry>(storage.DECK_LOG_KEY);
    const _gmdssLog = await storage.loadList<GmdssEntry>(storage.GMDSS_KEY);
    const _internalAudits = (await storage.loadList<InternalAudit>(storage.INTERNAL_AUDITS_KEY)).filter((x) => !x.deleted);
    const _itemMovements = await storage.loadList<ItemMovement>(storage.ITEM_MOVEMENTS_KEY);
    const _landings = (await storage.loadList<LandingReport>(storage.LANDINGS_KEY)).filter((x) => !x.deleted);
    const _spares = (await storage.loadList<SparePart>(storage.SPARES_KEY)).filter((p) => !p.deleted);
    const _spareMoves = await storage.loadList<SpareMove>(storage.SPARE_MOVES_KEY);
    const _docs = (await storage.loadList<IsmDoc>(storage.DOCS_KEY)).filter((d) => !d.deleted);
    const _docAcks = await storage.loadList<DocAck>(storage.DOC_ACKS_KEY);
    const _crewPrivate = await storage.loadList<CrewPrivate>(storage.CREW_PRIVATE_KEY);
    const _permits = (await storage.loadList<Permit>(storage.PERMITS_KEY)).filter((x) => !x.deleted);
    const _risks = (await storage.loadList<RiskAssessment>(storage.RISKS_KEY)).filter((x) => !x.deleted);
    const _fuelTanks = (await storage.loadList<FuelTank>(storage.FUEL_TANKS_KEY)).filter((x) => !x.deleted).sort((a, b) => a.order - b.order);
    const _fuelReadings = live(await storage.loadList<FuelReading>(storage.FUEL_READINGS_KEY));
    const _fuelBunkers = live(await storage.loadList<FuelBunker>(storage.FUEL_BUNKERS_KEY));
    const _fuelTransfers = live(await storage.loadList<FuelTransfer>(storage.FUEL_TRANSFERS_KEY));
    const _fuelDailySent = await storage.loadList<FuelDailySent>(storage.FUEL_DAILY_KEY);
    const _garbage = await storage.loadList<GarbageEntry>(storage.GARBAGE_KEY);
    const _orb = live(await storage.loadList<OrbEntry>(storage.ORB_KEY));
    const _orbSigns = await storage.loadList<OrbMasterSign>(storage.ORB_SIGNS_KEY);
    const _rounds = await storage.loadList<InspectionRound>(storage.ROUNDS_KEY);
    const _sewage = live(await storage.loadList<LogEntry>(storage.SEWAGE_KEY));
    const _sewageSigns = await storage.loadList<LogMonthSign>(storage.SEWAGE_SIGNS_KEY);
    const _ballast = live(await storage.loadList<LogEntry>(storage.BALLAST_KEY));
    const _ballastSigns = await storage.loadList<LogMonthSign>(storage.BALLAST_SIGNS_KEY);
    const _garbageSigns = await storage.loadList<GarbageMasterSign>(storage.GARBAGE_SIGNS_KEY);
    const _sopepItems = (await storage.loadList<SopepItem>(storage.SOPEP_ITEMS_KEY)).filter((x) => !x.deleted).sort((a, b) => a.order - b.order);
    const _sopepLockers = await storage.loadList<SopepLocker>(storage.SOPEP_LOCKERS_KEY);
    const _sopepChecks = live(await storage.loadList<SopepCheck>(storage.SOPEP_CHECKS_KEY));
    const _sopepDrills = live(await storage.loadList<SopepDrill>(storage.SOPEP_DRILLS_KEY));
    const _visitors = live(await storage.loadList<Visitor>(storage.VISITORS_KEY));
    const _securityLevels = await storage.loadList<SecurityLevelRec>(storage.SECURITY_LEVEL_KEY);
    const _securityDrills = live(await storage.loadList<SecurityDrill>(storage.SECURITY_DRILLS_KEY));
    const _crewMoves = await storage.loadList<CrewMove>(storage.CREW_MOVES_KEY);
    const _surveys = (await storage.loadList<Survey>(storage.SURVEYS_KEY)).filter((x) => !x.deleted);
    const _observations = await storage.loadList<SafetyObservation>(storage.OBSERVATIONS_KEY);
    const _ncs = await storage.loadList<NonConformity>(storage.NCS_KEY);
    const _drills = (await storage.loadList<Drill>(storage.DRILLS_KEY)).filter((x) => !x.deleted);
    const _drillPlans = await storage.loadList<DrillYearPlan>(storage.DRILL_PLANS_KEY);
    const _medItems = (await storage.loadList<MedItem>(storage.MED_ITEMS_KEY)).filter((x) => !x.deleted).sort((x, y) => x.order - y.order);
    const _medMoves = await storage.loadList<MedMove>(storage.MED_MOVES_KEY);
    const _medTreatments = await storage.loadList<MedTreatment>(storage.MED_TREATMENTS_KEY);
    const _passengers = (await storage.loadList<Passenger>(storage.PASSENGERS_KEY)).filter((x) => !x.deleted);
    const _safetyMeetings = (await storage.loadList<SafetyMeeting>(storage.SAFETY_MEETINGS_KEY)).filter((x) => !x.deleted);
    const _dpChecks = await storage.loadList<DpCheck>(storage.DP_CHECKS_KEY);
    const _dpDays = (await storage.loadList<DpDay>(storage.DP_DAYS_KEY)).filter((x) => !x.deleted);
    const _dpInfo = (await storage.loadList<DpInfo>(storage.DP_INFO_KEY)).find((x) => x.id === 'info') ?? null;
    const _dpTemplates = await storage.loadList<DpTemplate>(storage.DP_TEMPLATES_KEY);
    const _storeItems = (await storage.loadList<StoreItem>(storage.STORE_ITEMS_KEY)).filter((x) => !x.deleted).sort((a, b) => a.order - b.order);
    const _storeMoves = await storage.loadList<StoreMove>(storage.STORE_MOVES_KEY);
    const _storeRooms = await storage.loadList<StoreRoom>(storage.STORE_ROOMS_KEY);
    const _sopepDocs = (await storage.loadList<OfficerDoc>(storage.SOPEP_DOCS_KEY)).filter((x) => !x.deleted);
    const _sspDocs = (await storage.loadList<OfficerDoc>(storage.SSP_DOCS_KEY)).filter((x) => !x.deleted);
    const _searchPlans = await storage.loadList<SearchPlan>(storage.SEARCH_PLAN_KEY);
    const _searches = await storage.loadList<SecuritySearch>(storage.SEARCHES_KEY);
    const _checkpoints = (await storage.loadList<Checkpoint>(storage.CHECKPOINTS_KEY)).filter((x) => !x.deleted).sort((a, b) => a.order - b.order);
    const _patrolPlans = await storage.loadList<PatrolPlan>(storage.PATROL_PLANS_KEY);
    const _patrols = await storage.loadList<Patrol>(storage.PATROLS_KEY);
    const _keyList = (await storage.loadList<KeyItem>(storage.KEYS_KEY)).filter((x) => !x.deleted);
    const _keyMoves = await storage.loadList<KeyMove>(storage.KEY_MOVES_KEY);
    const _passengersPrivate = await storage.loadList<PassengerPrivate>(storage.PASSENGERS_PRIVATE_KEY);
    const _medOrders = await storage.loadList<MedOrder>(storage.MED_ORDERS_KEY);
    const _medChecks = await storage.loadList<MedCheck>(storage.MED_CHECKS_KEY);
    const _surveysDone = live(await storage.loadList<SurveyDone>(storage.SURVEYS_DONE_KEY));
    const _purchaseOrders = (await storage.loadList<PurchaseOrder>(storage.PURCHASE_ORDERS_KEY)).filter((x) => !x.deleted);
    const _orderGroups2 = (await storage.loadList<OrderGroup>(storage.ORDER_GROUPS_KEY)).filter((x) => !x.deleted);
    const _galleyOrders2 = (await storage.loadList<GalleyOrder>(storage.GALLEY_ORDERS_KEY)).filter((x) => !x.deleted);
    const _versions = Object.fromEntries(await Promise.all(VERSIONED_KEYS.map(async (k) => [k, await storage.loadList<any>(k)] as const)));
    setMachines(_machines);
    setScrappedMachines(_allMachines.filter((m) => m.scrapped));
    setPmsJobs(_pmsJobs);
    setPmsDone(_pmsDone);
    setPmsDeferrals(_pmsDeferrals);
    setPmsDefects(_pmsDefects);
    setPmsProjects(_pmsProjects);
    setWatchTemplates(_watchTemplates);
    setWatchLog(_watchLog);
    setDeckLog(_deckLog);
    setGmdssLog(_gmdssLog);
    setInternalAudits(_internalAudits);
    setItemMovements(_itemMovements);
    setLandings(_landings);
    setSpares(_spares);
    setSpareMoves(_spareMoves);
    setDocs(_docs);
    setDocAcks(_docAcks);
    setCrewPrivate(_crewPrivate);
    setPermits(_permits);
    setRisks(_risks);
    setFuelTanks(_fuelTanks);
    setFuelReadings(_fuelReadings);
    setFuelBunkers(_fuelBunkers);
    setFuelTransfers(_fuelTransfers);
    setFuelDailySent(_fuelDailySent);
    setGarbage(_garbage);
    setOrb(_orb);
    setOrbSigns(_orbSigns);
    setRounds(_rounds);
    setSewage(_sewage);
    setSewageSigns(_sewageSigns);
    setBallast(_ballast);
    setBallastSigns(_ballastSigns);
    setGarbageSigns(_garbageSigns);
    setSopepItems(_sopepItems);
    setSopepLockers(_sopepLockers);
    setSopepChecks(_sopepChecks);
    setSopepDrills(_sopepDrills);
    setVisitors(_visitors);
    setSecurityLevels(_securityLevels);
    setSecurityDrills(_securityDrills);
    setCrewMoves(_crewMoves);
    setSurveys(_surveys);
    setObservations(_observations);
    setNcs(_ncs);
    setDrills(_drills);
    setDrillPlans(_drillPlans);
    setMedItems(_medItems);
    setMedMoves(_medMoves);
    setMedTreatments(_medTreatments);
    setPassengers(_passengers);
    setSafetyMeetings(_safetyMeetings);
    setDpChecks(_dpChecks);
    setDpDays(_dpDays);
    setDpInfo(_dpInfo);
    setDpTemplates(_dpTemplates);
    setStoreItems(_storeItems);
    setStoreMoves(_storeMoves);
    setStoreRoomList(_storeRooms);
    setSopepDocs(_sopepDocs);
    setSspDocs(_sspDocs);
    setSearchPlans(_searchPlans);
    setSearches(_searches);
    setCheckpoints(_checkpoints);
    setPatrolPlans(_patrolPlans);
    setPatrols(_patrols);
    setKeyList(_keyList);
    setKeyMoves(_keyMoves);
    setPassengersPrivate(_passengersPrivate);
    setMedOrders(_medOrders);
    setMedChecks(_medChecks);
    setSurveysDone(_surveysDone);
    setPurchaseOrders(_purchaseOrders);
    setOrderGroups(_orderGroups2);
    setGalleyOrders(_galleyOrders2);
    setVersions(_versions);
  }, []);

  const saveMachine = useCallback(async (m: Machine) => {
    // A component whose hours follow this machine takes the same difference (services/pmsMachines).
    const all = await storage.loadList<Machine>(storage.PMS_MACHINES_KEY);
    const followers = followerReadings(all.find((x) => x.id === m.id), m, all, m.hoursDate ?? new Date().toISOString().slice(0, 10));
    await storage.upsertInList(storage.PMS_MACHINES_KEY, m);
    for (const f of followers) await storage.upsertInList(storage.PMS_MACHINES_KEY, f);
    await loadPms();
  }, [loadPms]);

  const savePmsJob = useCallback(async (j: PmsJob) => {
    await storage.upsertInList(storage.PMS_JOBS_KEY, j);
    await loadPms();
  }, [loadPms]);

  const savePlan = useCallback(async (ms: Machine[], js: PmsJob[]) => {
    const put = async <T extends { id: string }>(key: string, rows: T[]) => {
      if (!rows.length) return;
      const byId = new Map(rows.map((r) => [r.id, r]));
      const have = await storage.loadList<T>(key);
      await storage.saveList(key, [...have.map((r) => byId.get(r.id) ?? r), ...rows.filter((r) => !have.some((h) => h.id === r.id))]);
    };
    await put(storage.PMS_MACHINES_KEY, ms);
    await put(storage.PMS_JOBS_KEY, js);
    await loadPms();
  }, [loadPms]);

  const completePmsJob = useCallback(async (done: PmsDone, job: PmsJob, moves: SpareMove[] = []) => {
    await storage.upsertInList(storage.PMS_DONE_KEY, done);
    await storage.upsertInList(storage.PMS_JOBS_KEY, job);
    if (moves.length) await storage.saveList(storage.SPARE_MOVES_KEY, [...(await storage.loadList<SpareMove>(storage.SPARE_MOVES_KEY)), ...moves]);
    await loadPms();
  }, [loadPms]);

  const saveSpare = useCallback(async (p: SparePart) => {
    await storage.upsertInList(storage.SPARES_KEY, p);
    await loadPms();
  }, [loadPms]);

  const saveDoc = useCallback(async (d: IsmDoc) => {
    await storage.upsertInList(storage.DOCS_KEY, d);
    await loadPms();
  }, [loadPms]);

  const saveCrewPrivate = useCallback(async (p: CrewPrivate) => {
    await storage.upsertInList(storage.CREW_PRIVATE_KEY, p);
    await loadPms();
  }, [loadPms]);

  const savePermit = useCallback(async (x: Permit) => {
    await storage.upsertInList(storage.PERMITS_KEY, x);
    await loadPms();
  }, [loadPms]);

  const saveFuel = useCallback(async (kind: 'tank' | 'reading' | 'bunker' | 'transfer', row: any) => {
    const key = { tank: storage.FUEL_TANKS_KEY, reading: storage.FUEL_READINGS_KEY, bunker: storage.FUEL_BUNKERS_KEY, transfer: storage.FUEL_TRANSFERS_KEY }[kind];
    await storage.upsertInList(key, { ...row, updatedAt: Date.now() });
    await loadPms();
  }, [loadPms]);

  // Append-only: an entry with an id already held is ignored, never replaced.
  const appendTo = useCallback(async (key: string, row: { id: string }) => {
    const list = await storage.loadList<{ id: string }>(key);
    if (!list.some((x) => x.id === row.id)) await storage.saveList(key, [...list, row]);
    await loadPms();
  }, [loadPms]);
  const saveRow = useCallback(async (key: string, row: { id: string }) => {
    await storage.upsertInList(key, { ...row, updatedAt: Date.now() });
    await loadPms();
  }, [loadPms]);
  const saveRows = useCallback(async (key: string, rows: { id: string }[]) => {
    const now = Date.now();
    await storage.upsertManyInList(key, rows.map((r) => ({ ...r, updatedAt: (r as any).updatedAt ?? now })));
    await loadPms();
  }, [loadPms]);
  const appendRow = useCallback((key: string, row: { id: string }) => appendTo(key, row), [appendTo]);
  const addGarbage = useCallback((e: GarbageEntry) => appendTo(storage.GARBAGE_KEY, e), [appendTo]);
  const signGarbageMonth = useCallback((x: GarbageMasterSign) => appendTo(storage.GARBAGE_SIGNS_KEY, x), [appendTo]);

  const saveRisk = useCallback(async (x: RiskAssessment) => {
    await storage.upsertInList(storage.RISKS_KEY, x);
    await loadPms();
  }, [loadPms]);

  // Once per person per revision: a second tap is a no-op, not a duplicate.
  const addDocAck = useCallback(async (a: DocAck) => {
    const list = await storage.loadList<DocAck>(storage.DOC_ACKS_KEY);
    if (!list.some((x) => x.id === a.id)) await storage.saveList(storage.DOC_ACKS_KEY, [...list, a]);
    await loadPms();
  }, [loadPms]);

  const addSpareMoves = useCallback(async (moves: SpareMove[]) => {
    if (!moves.length) return;
    await storage.saveList(storage.SPARE_MOVES_KEY, [...(await storage.loadList<SpareMove>(storage.SPARE_MOVES_KEY)), ...moves]);
    await loadPms();
  }, [loadPms]);

  const saveLanding = useCallback(async (report: LandingReport, movements: ItemMovement[]) => {
    const existing = await storage.loadList<LandingReport>(storage.LANDINGS_KEY);
    const idx = existing.findIndex((r) => r.id === report.id);
    if (idx >= 0) existing[idx] = report; else existing.push(report);
    await storage.saveList(storage.LANDINGS_KEY, existing);
    if (movements.length) {
      const existingMoves = await storage.loadList<ItemMovement>(storage.ITEM_MOVEMENTS_KEY);
      const merged = [...existingMoves];
      for (const m of movements) {
        const mi = merged.findIndex((x) => x.id === m.id);
        if (mi >= 0) merged[mi] = m; else merged.push(m);
      }
      await storage.saveList(storage.ITEM_MOVEMENTS_KEY, merged);
    }
    await loadPms();
  }, [loadPms]);

  const saveMovement = useCallback(async (movement: ItemMovement) => {
    const existing = await storage.loadList<ItemMovement>(storage.ITEM_MOVEMENTS_KEY);
    const idx = existing.findIndex((m) => m.id === movement.id);
    if (idx >= 0) existing[idx] = movement; else existing.push(movement);
    await storage.saveList(storage.ITEM_MOVEMENTS_KEY, existing);
    await loadPms();
  }, [loadPms]);

  const saveRestDay = useCallback(async (day: RestDay) => {
    await storage.upsertRestDay(day);
    setRest(await storage.loadRest());
  }, []);

  const saveCrewMember = useCallback(async (member: CrewMember) => {
    await storage.upsertCrewMember(member);
    setCrew(liveCrew(await storage.loadCrew()));
  }, []);

  const saveVesselCategory = useCallback(async (meta: CategoryMeta) => {
    await storage.upsertVesselCategory(meta);
    await reload();
  }, [reload]);

  /**
   * Hiding writes a vessel row for the category — including for a BUILT-IN one,
   * where the row carries nothing but the vessel's changes to it. That is why it
   * travels: the categories collection already syncs, so hiding a category on the
   * bridge hides it on every phone aboard.
   */
  const setCategoryHidden = useCallback(
    async (key: CategoryKey, hidden: boolean) => {
      const current = CATEGORY_MAP[key];
      if (!current) return;
      await storage.upsertVesselCategory({ ...current, key, hidden });
      await reload();
    },
    [reload]
  );

  const removeVesselCategory = useCallback(async (key: string) => {
    await storage.deleteVesselCategory(key);
    await reload();
  }, [reload]);

  const saveTemplate = useCallback(async (template: ChecklistTemplate) => {
    await storage.upsertTemplate(template);
    setTemplates(await storage.loadTemplates());
  }, []);

  const removeTemplate = useCallback(async (id: string) => {
    await storage.deleteTemplate(id);
    setTemplates(await storage.loadTemplates());
  }, []);

  const setRoundEnabled = useCallback(
    async (category: CategoryKey, period: InspectionPeriod, on: boolean) => {
      await storage.setRoundEnabled(category, period, on);
      setTemplates(await storage.loadTemplates());
    },
    []
  );

  const removeCrewMember = useCallback(async (id: string) => {
    await storage.deleteCrewMember(id);
    setCrew(liveCrew(await storage.loadCrew()));
  }, []);

  const setSigningPolicy = useCallback(async (policy: SigningPolicy) => {
    await storage.saveSigningPolicy(policy);
    setSigningPolicyState(policy);
  }, []);

  const setPhotoArchive = useCallback(async (state: PhotoArchiveState) => {
    await storage.savePhotoArchive(state);
    setPhotoArchiveState(state);
  }, []);

  const setPrefs = useCallback(
    async (patch: Partial<storage.Prefs>) => {
      setPrefsState((prev) => {
        const next = { ...prev, ...patch };
        storage.savePrefs(next);
        return next;
      });
    },
    []
  );
  useEffect(() => setSoundsMuted(!!prefs.soundsMuted), [prefs.soundsMuted]);

  const setVessel = useCallback(
    async (info: storage.VesselInfo) => {
      await storage.saveVessel(info);
      setVesselState(info);
    },
    []
  );

  const countFor = useCallback((category: CategoryKey) => byCategory[category]?.length ?? 0, [byCategory]);

  return (
    <DataContext.Provider
      value={{
        loading,
        byCategory,
        flat,
        certificates,
        vessel,
        compressor,
        prefs,
        signingPolicy,
        setSigningPolicy,
        photoArchive,
        setPhotoArchive,
        inspections,
        crew,
        rest,
        saveRestDay,
        machines,
        scrappedMachines,
        pmsJobs,
        pmsDone,
        pmsDeferrals,
        pmsDefects,
        pmsProjects,
        watchTemplates,
        watchLog,
        deckLog,
        gmdssLog,
        internalAudits,
        itemMovements,
        landings,
        saveLanding,
        saveMovement,
        saveMachine,
        savePmsJob,
        savePlan,
        completePmsJob,
        spares,
        spareMoves,
        saveSpare,
        addSpareMoves,
        docs,
        docAcks,
        saveDoc,
        addDocAck,
        crewPrivate,
        saveCrewPrivate,
        permits,
        risks,
        fuelTanks,
        fuelReadings,
        fuelBunkers,
        fuelTransfers,
        saveFuel,
        fuelDailySent,
        garbage,
        orb,
        orbSigns,
        rounds,
        sewage,
        sewageSigns,
        ballast,
        ballastSigns,
        garbageSigns,
        addGarbage,
        signGarbageMonth,
        sopepItems,
        sopepLockers,
        sopepChecks,
        sopepDrills,
        visitors,
        securityLevels,
        securityDrills,
        crewMoves,
        surveys,
        observations,
        ncs,
        drills,
        drillPlans,
        medItems,
        medMoves,
        medTreatments,
        passengers,
        safetyMeetings,
        dpChecks,
        dpDays,
        dpInfo,
        dpTemplates,
        storeItems,
        storeMoves,
        storeRoomList,
        sopepDocs,
        sspDocs,
        searchPlans,
        searches,
        checkpoints,
        patrolPlans,
        patrols,
        keyList,
        keyMoves,
        passengersPrivate,
        medOrders,
        medChecks,
        surveysDone,
        purchaseOrders,
        orderGroups,
        galleyOrders,
        versionsOf,
        saveRow,
        saveRows,
        appendRow,
        savePermit,
        saveRisk,
        templates,
        categories,
        recentScans,
        recordScan,
        isLocked,
        refreshLocks,
        reload,
        saveItem,
        removeItem,
        moveItem,
        saveCertificate,
        saveCertificates,
        removeCertificate,
        saveCompressor,
        addInspection,
        saveInspection,
        saveCrewMember,
        removeCrewMember,
        saveTemplate,
        removeTemplate,
        setRoundEnabled,
        saveVesselCategory,
        setCategoryHidden,
        removeVesselCategory,
        setPrefs,
        setVessel,
        countFor,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextType {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

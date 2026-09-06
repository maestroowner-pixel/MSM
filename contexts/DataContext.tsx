// ===================================
// Data context
// Holds all equipment items in memory + vessel info, with a reload()
// so screens refresh after import / edit. Backed by AsyncStorage.
// ===================================

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { CompressorState } from '../types/compressor';
import { Inspection } from '../types/inspection';
import { CrewMember } from '../types/crew';
import { CATEGORIES } from '../constants/categories';
import * as storage from '../services/storage';
import * as snapshot from '../services/snapshot';
import { ScanEntry, loadScanHistory, recordScan as persistScan } from '../services/scanHistory';
import { rescheduleExpiryReminders } from '../services/notifications';
import { syncFlaggedWidget } from '../services/widgetBridge';
import { limitsActive, overflowLockedIds } from '../services/trial';

interface DataContextType {
  loading: boolean;
  byCategory: Record<CategoryKey, EquipmentItem[]>;
  flat: EquipmentItem[];
  certificates: Certificate[];
  vessel: storage.VesselInfo | null;
  compressor: CompressorState;
  prefs: storage.Prefs;
  /** The vessel's inspection trail, append-only (see types/inspection.ts). */
  inspections: Inspection[];
  /** Who can sign an inspection. */
  crew: CrewMember[];
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
  saveCertificate: (cert: Certificate) => Promise<void>;
  removeCertificate: (id: string) => Promise<void>;
  saveCompressor: (state: CompressorState) => Promise<void>;
  /** Record a signed inspection. Records are never edited afterwards. */
  addInspection: (insp: Inspection) => Promise<void>;
  /** Write back a record — legitimate ONLY for opening/closing its defect. */
  saveInspection: (insp: Inspection) => Promise<void>;
  saveCrewMember: (member: CrewMember) => Promise<void>;
  removeCrewMember: (id: string) => Promise<void>;
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
  const [recentScans, setRecentScans] = useState<ScanEntry[]>([]);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  // Recompute the free-tier overflow lock from a category map: locked only when
  // limits are active (trial ended, not subscribed, enforced on this platform).
  const computeLocks = useCallback(async (map: Record<CategoryKey, EquipmentItem[]>) => {
    const locked = (await limitsActive()) ? overflowLockedIds(map) : new Set<string>();
    setLockedIds(locked);
  }, []);

  const reload = useCallback(async () => {
    const all = await storage.loadAll();
    const flatArr = CATEGORIES.flatMap((c) => all[c.key]);
    setByCategory(all);
    setFlat(flatArr);
    setCertificates(await storage.loadCertificates());
    setVesselState(await storage.loadVessel());
    setCompressorState(await storage.loadCompressor());
    setInspections(await storage.loadInspections());
    setCrew(await storage.loadCrew());
    setRecentScans(await loadScanHistory());
    const p = await storage.loadPrefs();
    setPrefsState(p);
    setLoading(false);
    void computeLocks(all);
    // Keep expiry reminders in sync with the data (no-op unless enabled/supported).
    if (p.notificationsEnabled) rescheduleExpiryReminders(flatArr);
  }, [computeLocks]);

  const refreshLocks = useCallback(async () => {
    await computeLocks(byCategory);
  }, [computeLocks, byCategory]);

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

  const saveCertificate = useCallback(
    async (cert: Certificate) => {
      await storage.upsertCertificate(cert);
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

  const saveCrewMember = useCallback(async (member: CrewMember) => {
    await storage.upsertCrewMember(member);
    setCrew(await storage.loadCrew());
  }, []);

  const removeCrewMember = useCallback(async (id: string) => {
    await storage.deleteCrewMember(id);
    setCrew(await storage.loadCrew());
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
        inspections,
        crew,
        recentScans,
        recordScan,
        isLocked,
        refreshLocks,
        reload,
        saveItem,
        removeItem,
        saveCertificate,
        removeCertificate,
        saveCompressor,
        addInspection,
        saveInspection,
        saveCrewMember,
        removeCrewMember,
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

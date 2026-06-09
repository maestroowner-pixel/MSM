// ===================================
// Data context
// Holds all equipment items in memory + vessel info, with a reload()
// so screens refresh after import / edit. Backed by AsyncStorage.
// ===================================

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { CompressorState } from '../types/compressor';
import { CATEGORIES } from '../constants/categories';
import * as storage from '../services/storage';
import { rescheduleExpiryReminders } from '../services/notifications';

interface DataContextType {
  loading: boolean;
  byCategory: Record<CategoryKey, EquipmentItem[]>;
  flat: EquipmentItem[];
  certificates: Certificate[];
  vessel: storage.VesselInfo | null;
  compressor: CompressorState;
  prefs: storage.Prefs;
  reload: () => Promise<void>;
  saveItem: (item: EquipmentItem) => Promise<void>;
  removeItem: (category: CategoryKey, id: string) => Promise<void>;
  saveCertificate: (cert: Certificate) => Promise<void>;
  removeCertificate: (id: string) => Promise<void>;
  saveCompressor: (state: CompressorState) => Promise<void>;
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

  const reload = useCallback(async () => {
    const all = await storage.loadAll();
    const flatArr = CATEGORIES.flatMap((c) => all[c.key]);
    setByCategory(all);
    setFlat(flatArr);
    setCertificates(await storage.loadCertificates());
    setVesselState(await storage.loadVessel());
    setCompressorState(await storage.loadCompressor());
    const p = await storage.loadPrefs();
    setPrefsState(p);
    setLoading(false);
    // Keep expiry reminders in sync with the data (no-op unless enabled/supported).
    if (p.notificationsEnabled) rescheduleExpiryReminders(flatArr);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveItem = useCallback(
    async (item: EquipmentItem) => {
      await storage.upsertItem(item);
      await reload();
    },
    [reload]
  );

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
        reload,
        saveItem,
        removeItem,
        saveCertificate,
        removeCertificate,
        saveCompressor,
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

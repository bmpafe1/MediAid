import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScanResult, SyncRecord, syncHistory } from '@/services/mockData';
import { flush } from '@/services/radarQueue';
import NetInfo from '@react-native-community/netinfo';

export type Language = 'en' | 'fr';

export interface VillageSite {
  geohash: string; // 4-char geohash
  displayName: string;
}

// Default village/site options (Phase 1 pilot villages)
export const VILLAGE_SITES: VillageSite[] = [
  { geohash: 's0yg', displayName: 'Baligham' },
  { geohash: 's0yf', displayName: 'Bagam' },
  { geohash: 's000', displayName: 'Lab / Demo' },
];

interface AppState {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;

  language: Language;
  setLanguage: (l: Language) => void;

  currentScan: ScanResult | null;
  setCurrentScan: (s: ScanResult | null) => void;

  scanHistory: ScanResult[];
  addScanToHistory: (s: ScanResult) => void;
  updateScanInHistory: (s: ScanResult) => void;

  pendingSyncCount: number;
  syncHistory: SyncRecord[];
  addSyncRecord: (r: SyncRecord) => void;

  patientName: string;
  setPatientName: (n: string) => void;

  // Village / site setting — persisted across sessions
  activeSite: VillageSite;
  setActiveSite: (site: VillageSite) => void;

  // Real radar queue stats — refreshed on demand
  radarPendingCount: number;
  radarLastSyncAt: string | null;
  radarLastError: string | null;
  refreshRadarStats: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoMode] = useState(true);
  const [language, setLanguageState] = useState<Language>('en');
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [syncRecords, setSyncRecords] = useState<SyncRecord[]>(syncHistory);
  const [patientName, setPatientName] = useState('');
  const [activeSite, setActiveSiteState] = useState<VillageSite>(VILLAGE_SITES[0]);
  const [radarPendingCount, setRadarPendingCount] = useState(0);
  const [radarLastSyncAt, setRadarLastSyncAt] = useState<string | null>(null);
  const [radarLastError, setRadarLastError] = useState<string | null>(null);

  // Radar queue stats loader
  const refreshRadarStats = async () => {
    try {
      const { pendingCount, lastSyncAt, lastError } = await import('@/services/radarQueue');
      const [count, syncAt, err] = await Promise.all([
        pendingCount(),
        lastSyncAt(),
        lastError(),
      ]);
      setRadarPendingCount(count);
      setRadarLastSyncAt(syncAt);
      setRadarLastError(err);
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    AsyncStorage.getItem('scanHistory').then((d) => {
      if (d) setScanHistory(JSON.parse(d));
    });
    AsyncStorage.getItem('demoMode').then((d) => {
      if (d !== null) setDemoMode(JSON.parse(d));
    });
    AsyncStorage.getItem('language').then((d) => {
      if (d) setLanguageState(d as Language);
    });
    AsyncStorage.getItem('activeSite').then((d) => {
      if (d) { try { setActiveSiteState(JSON.parse(d)); } catch {} }
    });
    // Load initial radar stats
    refreshRadarStats();
    // Flush queue on app start
    flush().catch(() => {});
    // Re-flush whenever connectivity is restored
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        flush().catch(() => {});
        refreshRadarStats();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('scanHistory', JSON.stringify(scanHistory));
  }, [scanHistory]);

  useEffect(() => {
    AsyncStorage.setItem('demoMode', JSON.stringify(demoMode));
  }, [demoMode]);

  const setLanguage = (l: Language) => {
    setLanguageState(l);
    AsyncStorage.setItem('language', l);
  };

  const addScanToHistory = (s: ScanResult) => {
    setScanHistory((prev) => [s, ...prev]);
  };

  const updateScanInHistory = (updated: ScanResult) => {
    setScanHistory((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const setActiveSite = (site: VillageSite) => {
    setActiveSiteState(site);
    AsyncStorage.setItem('activeSite', JSON.stringify(site));
  };

  const addSyncRecord = (r: SyncRecord) => {
    setSyncRecords((prev) => [r, ...prev]);
  };

  const pendingSyncCount = scanHistory.filter((s) => !s.synced).length;

  return (
    <AppContext.Provider
      value={{
        demoMode,
        setDemoMode,
        language,
        setLanguage,
        currentScan,
        setCurrentScan,
        scanHistory,
        addScanToHistory,
        updateScanInHistory,
        pendingSyncCount,
        syncHistory: syncRecords,
        addSyncRecord,
        patientName,
        setPatientName,
        activeSite,
        setActiveSite,
        radarPendingCount,
        radarLastSyncAt,
        radarLastError,
        refreshRadarStats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

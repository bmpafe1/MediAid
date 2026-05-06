import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScanResult, SyncRecord, syncHistory } from '@/services/mockData';

export type Language = 'en' | 'fr';

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
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoMode] = useState(true);
  const [language, setLanguageState] = useState<Language>('en');
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [syncRecords, setSyncRecords] = useState<SyncRecord[]>(syncHistory);
  const [patientName, setPatientName] = useState('');

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

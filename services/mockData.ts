import { config } from '@/constants/config';

export interface ScanResult {
  id: string;
  patientName: string;
  patientId: string;
  consentTimestamp: string;
  scanTimestamp: string;
  tbRisk: number;
  afibRisk: number;
  heartRate: number;
  hemoglobin: number;
  spo2: number;
  respiratoryRate: number;
  tremorRisk: number;        // He et al. 2024 — Parkinson's tremor score 0-100
  eyeConditions: number;     // Jin et al. 2024 — conditions detected 0-7
  cvdRisk10yr: number;       // Weng/Google Health 2024 — 10-year CVD risk % (0-40)
  glucoseFlag: boolean;      // Zeynali 2025 — PPG glucose anomaly flag (TinyML)
  covidFlag: boolean;        // Alkhodari 2022 — COVID-19 breathing AUROC 0.90
  jaundiceFlag: boolean;     // Aune 2023 — scleral jaundice detection
  hasRedAlert: boolean;
  bypassLogged: boolean;
  bypassReason?: string;
  synced: boolean;
}

export interface OutbreakAlert {
  village: string;
  district: string;
  condition: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  rainfallMm: number;
  lagForecast: string;
  note: string;
}

export interface SyncRecord {
  id: string;
  timestamp: string;
  recordsSynced: number;
  status: 'success' | 'pending' | 'failed';
  encrypted: boolean;
}

// Generate clinically plausible mock scan result
export function generateMockScanResult(patientName: string): ScanResult {
  const tbRisk = Math.round(Math.random() * 85 + 10); // 10–95
  const afibRisk = Math.round(Math.random() * 20 + 1); // 1–21
  const heartRate = Math.round(Math.random() * 60 + 52); // 52–112
  const hemoglobin = parseFloat((Math.random() * 7 + 7.5).toFixed(1)); // 7.5–14.5
  const spo2 = Math.round(Math.random() * 12 + 88); // 88–100
  const respiratoryRate = Math.round(Math.random() * 20 + 10); // 10–30

  const tremorRisk = Math.round(Math.random() * 70 + 5);  // 5-75
  const eyeConditions = Math.floor(Math.random() * 4);     // 0-3
  const cvdRisk10yr = Math.round(Math.random() * 28 + 3);  // 3-31% (realistic range)
  const glucoseFlag = Math.random() > 0.75;                // ~25% flag rate
  const covidFlag = Math.random() > 0.80;                  // ~20% flag rate
  const jaundiceFlag = Math.random() > 0.88;               // ~12% flag rate

  const t = config.thresholds;
  const hasRedAlert =
    tbRisk >= t.tbRisk.red ||
    afibRisk >= t.afibRisk.red ||
    heartRate <= t.heartRate.redLow ||
    heartRate >= t.heartRate.redHigh ||
    hemoglobin <= t.hemoglobin.red ||
    spo2 <= t.spo2.red ||
    respiratoryRate >= t.respiratoryRate.redHigh ||
    tremorRisk >= 60;

  return {
    id: `scan_${Date.now()}`,
    patientName,
    patientId: `CHA-${Math.floor(Math.random() * 9000 + 1000)}`,
    consentTimestamp: new Date().toISOString(),
    scanTimestamp: new Date().toISOString(),
    tbRisk,
    afibRisk,
    heartRate,
    hemoglobin,
    spo2,
    respiratoryRate,
    tremorRisk,
    eyeConditions,
    cvdRisk10yr,
    glucoseFlag,
    covidFlag,
    jaundiceFlag,
    hasRedAlert,
    bypassLogged: false,
    synced: false,
  };
}

// Force a RED result for demo
export function generateDemoRedResult(patientName: string): ScanResult {
  return {
    id: `scan_demo_${Date.now()}`,
    patientName: patientName || 'Demo Patient',
    patientId: 'CHA-7291',
    consentTimestamp: new Date().toISOString(),
    scanTimestamp: new Date().toISOString(),
    tbRisk: 89,
    afibRisk: 2,
    heartRate: 82,
    hemoglobin: 10.2,
    spo2: 97,
    respiratoryRate: 22,
    tremorRisk: 62,
    eyeConditions: 1,
    cvdRisk10yr: 24,
    glucoseFlag: true,
    covidFlag: false,
    jaundiceFlag: true,
    hasRedAlert: true,
    bypassLogged: false,
    synced: false,
  };
}

export function getStatusForMetric(
  metric: keyof ScanResult,
  value: number
): 'red' | 'yellow' | 'green' {
  const t = config.thresholds;
  switch (metric) {
    case 'tbRisk':
      if (value >= t.tbRisk.red) return 'red';
      if (value >= t.tbRisk.yellow) return 'yellow';
      return 'green';
    case 'afibRisk':
      if (value >= t.afibRisk.red) return 'red';
      if (value >= t.afibRisk.yellow) return 'yellow';
      return 'green';
    case 'heartRate':
      if (value <= t.heartRate.redLow || value >= t.heartRate.redHigh) return 'red';
      if (value <= t.heartRate.yellowLow || value >= t.heartRate.yellowHigh) return 'yellow';
      return 'green';
    case 'hemoglobin':
      if (value <= t.hemoglobin.red) return 'red';
      if (value <= t.hemoglobin.yellow) return 'yellow';
      return 'green';
    case 'spo2':
      if (value <= t.spo2.red) return 'red';
      if (value <= t.spo2.yellow) return 'yellow';
      return 'green';
    case 'respiratoryRate':
      if (value >= t.respiratoryRate.redHigh || value <= t.respiratoryRate.redLow) return 'red';
      if (value >= t.respiratoryRate.yellowHigh || value <= t.respiratoryRate.yellowLow) return 'yellow';
      return 'green';
    case 'tremorRisk':
      if (value >= 60) return 'red';
      if (value >= 35) return 'yellow';
      return 'green';
    case 'eyeConditions':
      if (value >= 2) return 'red';
      if (value >= 1) return 'yellow';
      return 'green';
    default:
      return 'green';
  }
}

// Mock outbreak data
export const outbreakAlerts: OutbreakAlert[] = [
  {
    village: 'Baligham',
    district: 'Mezam',
    condition: 'Malaria',
    riskLevel: 'High',
    rainfallMm: 320,
    lagForecast: 'Cases expected in 4–6 weeks',
    note: 'Rainfall anomaly +180mm above baseline. Distribute bednets immediately.',
  },
  {
    village: 'Bagam',
    district: 'Noun',
    condition: 'Respiratory Illness',
    riskLevel: 'Medium',
    rainfallMm: 45,
    lagForecast: 'Watch period: 2–3 weeks',
    note: 'Temperature spike 3.2°C above seasonal mean. Monitor cough presentations.',
  },
  {
    village: 'Bambui',
    district: 'Mezam',
    condition: 'Cholera',
    riskLevel: 'Medium',
    rainfallMm: 280,
    lagForecast: 'Elevated risk: 1–2 weeks',
    note: 'Flooding reported near water sources. Boil water advisories issued.',
  },
  {
    village: 'Fundong',
    district: 'Boyo',
    condition: 'Meningitis',
    riskLevel: 'Low',
    rainfallMm: 12,
    lagForecast: 'Dry season watch',
    note: 'Dry harmattan conditions. Standard meningitis belt precautions.',
  },
];

// Mock sync history
export const syncHistory: SyncRecord[] = [
  { id: 's1', timestamp: new Date(Date.now() - 3600000).toISOString(), recordsSynced: 5, status: 'success', encrypted: true },
  { id: 's2', timestamp: new Date(Date.now() - 86400000).toISOString(), recordsSynced: 12, status: 'success', encrypted: true },
  { id: 's3', timestamp: new Date(Date.now() - 172800000).toISOString(), recordsSynced: 3, status: 'failed', encrypted: true },
];

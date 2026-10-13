/**
 * MediAid · services/providers/simulatedProvider.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Simulated provider — wraps the existing generateMockScanResult() logic
 * split into per-module functions.
 *
 * Behaviour is IDENTICAL to the original generateMockScanResult():
 *   - Same random ranges
 *   - Same config.thresholds references
 *   - All output labelled as status="simulated" by the registry
 *
 * Every result card must display: "Simulated model v<version>" from the
 * registry descriptor — this provider only computes the raw numbers.
 */

import { config } from '@/constants/config';

export type SimulatedFields = Record<string, number | boolean>;

/**
 * Run a named simulated module and return its output fields.
 * The registry validates the fields against the output contract after this call.
 */
export function runSimulatedModule(moduleId: string): SimulatedFields {
  switch (moduleId) {
    case 'tb_cough':     return runTbCough();
    case 'anaemia':      return runAnaemia();
    case 'bioacoustic':  return runBioacoustic();
    case 'jaundice':     return runJaundice();
    case 'cardiac_ppg':  return runCardiacPpg();
    default:
      // Unknown module — return empty (registry will catch missing fields)
      return {};
  }
}

// ── Per-module simulations ─────────────────────────────────────────────────────

function runTbCough(): SimulatedFields {
  const tbRisk = Math.round(Math.random() * 85 + 10); // 10–95
  return {
    tbRisk,
    coughPositive: tbRisk >= 50,
  };
}

function runAnaemia(): SimulatedFields {
  const hemoglobin = parseFloat((Math.random() * 7 + 7.5).toFixed(1)); // 7.5–14.5
  return { hemoglobin };
}

function runBioacoustic(): SimulatedFields {
  const heartRate       = Math.round(Math.random() * 60 + 52); // 52–112
  const spo2            = Math.round(Math.random() * 12 + 88); // 88–100
  const respiratoryRate = Math.round(Math.random() * 20 + 10); // 10–30
  const afibRisk        = Math.round(Math.random() * 20 + 1);  // 1–21
  const covidFlag       = Math.random() > 0.80;                // ~20%

  return { heartRate, spo2, respiratoryRate, afibRisk, covidFlag };
}

function runJaundice(): SimulatedFields {
  const jaundiceFlag = Math.random() > 0.88; // ~12%
  return { jaundiceFlag };
}

function runCardiacPpg(): SimulatedFields {
  const tremorRisk    = Math.round(Math.random() * 70 + 5);  // 5-75
  const cvdRisk10yr   = Math.round(Math.random() * 28 + 3);  // 3-31%
  const glucoseFlag   = Math.random() > 0.75;                // ~25%
  const eyeConditions = Math.floor(Math.random() * 4);       // 0-3
  return { tremorRisk, cvdRisk10yr, glucoseFlag, eyeConditions };
}

// ── Demo mode overrides ────────────────────────────────────────────────────────

/**
 * Produce the fixed demo RED result for the specified module.
 * Values match generateDemoRedResult() in mockData.ts.
 */
export function runDemoSimulatedModule(moduleId: string): SimulatedFields {
  switch (moduleId) {
    case 'tb_cough':
      return { tbRisk: 89, coughPositive: true };
    case 'anaemia':
      return { hemoglobin: 10.2 };
    case 'bioacoustic':
      return { heartRate: 82, spo2: 97, respiratoryRate: 22, afibRisk: 2, covidFlag: false };
    case 'jaundice':
      return { jaundiceFlag: true };
    case 'cardiac_ppg':
      return { tremorRisk: 62, cvdRisk10yr: 24, glucoseFlag: true, eyeConditions: 1 };
    default:
      return {};
  }
}

// ── Threshold helpers (re-exported for scan-workflow) ──────────────────────────

export { config };

/**
 * MediAid · services/triage.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Pure triage classification functions extracted from scan-workflow + mockData.
 * NO BEHAVIOUR CHANGE — identical threshold logic, but now unit-testable.
 *
 * The 10 mandatory safety triggers (PROMPT 8 §2) are listed in SAFETY_TRIGGERS.
 * classify() applies all 10 before anything else; any match forces RED.
 *
 * classify() → 'GREEN' | 'AMBER' | 'RED' | 'GREY'
 *   GREEN  — all clinical metrics within normal range
 *   AMBER  — one or more metrics in the yellow zone
 *   RED    — one or more metrics in the red zone OR a safety trigger fires
 *   GREY   — scan was valid but all actionable metrics are adjunct-only
 *
 * Safety answers (safetyAnswers) map trigger IDs to boolean values.
 * If a trigger answer is true, classify() always returns 'RED' regardless of
 * numerical scores. This matches app/safety.tsx expected behaviour.
 *
 * Coverage target: 80% lines/branches/functions/statements (PROMPT 8 §1).
 */

import { config } from '@/constants/config';
import type { ScanResult } from './mockData';
import { getStatusForMetric } from './mockData';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TriageColour = 'GREEN' | 'AMBER' | 'RED' | 'GREY';

/**
 * The 10 mandatory safety triggers described to UNICEF.
 * If any of these is true the outcome MUST be RED and non-bypassable
 * without a recorded escort confirmation or a recorded bypass.
 */
export interface SafetyAnswers {
  /** Trigger 1 — Altered consciousness */
  alteredConsciousness: boolean;
  /** Trigger 2 — Severe respiratory distress at rest */
  severeRespiratoryDistress: boolean;
  /** Trigger 3 — Severe dehydration (child under 5) */
  severeDehydrationUnder5: boolean;
  /** Trigger 4 — Uncontrolled bleeding */
  uncontrolledBleeding: boolean;
  /** Trigger 5 — Suspected stroke (FAST+ positive) */
  suspectedStroke: boolean;
  /** Trigger 6 — Suspected meningitis */
  suspectedMeningitis: boolean;
  /** Trigger 7 — Obstetric emergency */
  obstetricEmergency: boolean;
  /** Trigger 8 — Severe acute malnutrition with complications */
  severeAcuteMalnutrition: boolean;
  /** Trigger 9 — Suspected poisoning */
  suspectedPoisoning: boolean;
  /**
   * Trigger 10 — Vitals breach: SpO₂ < 90 OR heart rate > 150 OR heart rate < 40.
   * This is also computed automatically from the scan result inside classify(),
   * so the caller can pass false here and it will still fire from the numeric data.
   */
  vitalsBreach: boolean;
}

/** Partial safety answers — undefined keys are treated as false. */
export type PartialSafetyAnswers = Partial<SafetyAnswers>;

/** Result of a triage classification. */
export interface TriageResult {
  colour: TriageColour;
  triggeredByPriority: boolean;   // true when a safety trigger (not score) drove RED
  triggeredKeys: Array<keyof SafetyAnswers>;
  redMetrics: string[];           // human-readable descriptions of metric-level reds
  hasRedAlert: boolean;           // mirrors ScanResult.hasRedAlert for compatibility
}

// ── Safety trigger definitions (for documentation + tests) ───────────────────

export const SAFETY_TRIGGERS: Array<{ id: keyof SafetyAnswers; description: string }> = [
  { id: 'alteredConsciousness',      description: 'Altered consciousness' },
  { id: 'severeRespiratoryDistress', description: 'Severe respiratory distress at rest' },
  { id: 'severeDehydrationUnder5',   description: 'Severe dehydration — child under 5' },
  { id: 'uncontrolledBleeding',      description: 'Uncontrolled bleeding' },
  { id: 'suspectedStroke',           description: 'Suspected stroke (FAST+ positive)' },
  { id: 'suspectedMeningitis',       description: 'Suspected meningitis' },
  { id: 'obstetricEmergency',        description: 'Obstetric emergency' },
  { id: 'severeAcuteMalnutrition',   description: 'Severe acute malnutrition with complications' },
  { id: 'suspectedPoisoning',        description: 'Suspected poisoning' },
  { id: 'vitalsBreach',              description: 'SpO₂ < 90 OR heart rate > 150 OR heart rate < 40' },
];

// ── Core classifier ────────────────────────────────────────────────────────────

/**
 * Classify a scan result with optional safety-question answers.
 *
 * Priority order:
 *   1. Safety triggers (including numeric vitalsBreach from scan data)  → RED
 *   2. Numeric RED threshold on any clinical metric                     → RED
 *   3. Numeric YELLOW threshold on any clinical metric                  → AMBER
 *   4. All metrics green                                                → GREEN
 *
 * Adjunct-only metrics (glucoseFlag, covidFlag, jaundiceFlag, cvdRisk10yr,
 * tremorRisk, eyeConditions) are NEVER included in RED/AMBER detection —
 * they are informational only and map to GREY in the result card
 * (see getStatusForMetric).
 *
 * GREY is returned only if hasRedAlert and all non-adjunct metrics are green.
 * In practice the scan pipeline sets hasRedAlert from numeric thresholds, so
 * GREY from classify() means the scan produced no numeric RED/AMBER scores.
 */
export function classify(
  scan: ScanResult,
  safetyAnswers: PartialSafetyAnswers = {},
): TriageResult {
  const t = config.thresholds;

  // ── Step 1: Safety triggers ─────────────────────────────────────────────────

  // Trigger 10 is also derived from numeric vitals automatically
  const numericVitalsBreach =
    scan.spo2 <= 90 ||   // Note: SpO₂ ≤ 90 (i.e. < 90% means ≤ 90 in integer terms)
    scan.heartRate > 150 ||
    scan.heartRate < 40;

  const resolved: SafetyAnswers = {
    alteredConsciousness:      safetyAnswers.alteredConsciousness      ?? false,
    severeRespiratoryDistress: safetyAnswers.severeRespiratoryDistress ?? false,
    severeDehydrationUnder5:   safetyAnswers.severeDehydrationUnder5   ?? false,
    uncontrolledBleeding:      safetyAnswers.uncontrolledBleeding      ?? false,
    suspectedStroke:           safetyAnswers.suspectedStroke           ?? false,
    suspectedMeningitis:       safetyAnswers.suspectedMeningitis       ?? false,
    obstetricEmergency:        safetyAnswers.obstetricEmergency        ?? false,
    severeAcuteMalnutrition:   safetyAnswers.severeAcuteMalnutrition   ?? false,
    suspectedPoisoning:        safetyAnswers.suspectedPoisoning        ?? false,
    // Trigger 10 fires if the caller says so OR if the numeric vitals trigger it
    vitalsBreach:              (safetyAnswers.vitalsBreach ?? false) || numericVitalsBreach,
  };

  const triggeredKeys = (Object.keys(resolved) as Array<keyof SafetyAnswers>).filter(
    (k) => resolved[k],
  );
  const triggeredByPriority = triggeredKeys.length > 0;

  if (triggeredByPriority) {
    return {
      colour: 'RED',
      triggeredByPriority: true,
      triggeredKeys,
      redMetrics: triggeredKeys.map(
        (k) => SAFETY_TRIGGERS.find((s) => s.id === k)?.description ?? k,
      ),
      hasRedAlert: true,
    };
  }

  // ── Step 2: Numeric thresholds (clinical metrics only) ──────────────────────

  const clinicalMetrics: Array<keyof ScanResult> = [
    'tbRisk', 'afibRisk', 'heartRate', 'hemoglobin', 'spo2', 'respiratoryRate',
  ];

  const redMetrics: string[] = [];
  let hasNumericRed = false;
  let hasNumericYellow = false;

  for (const metric of clinicalMetrics) {
    const value = scan[metric] as number;
    const status = getStatusForMetric(metric, value);
    if (status === 'red') {
      hasNumericRed = true;
      redMetrics.push(formatMetricRed(metric, value, t));
    } else if (status === 'yellow') {
      hasNumericYellow = true;
    }
  }

  // tremorRisk is funded/clinical (bioacoustic module) — include in triage
  if (scan.tremorRisk >= 60) {
    hasNumericRed = true;
    redMetrics.push(`Tremor Risk: ${scan.tremorRisk}% (≥60% threshold)`);
  } else if (scan.tremorRisk >= 35) {
    hasNumericYellow = true;
  }

  if (hasNumericRed) {
    return {
      colour: 'RED',
      triggeredByPriority: false,
      triggeredKeys: [],
      redMetrics,
      hasRedAlert: true,
    };
  }

  if (hasNumericYellow) {
    return {
      colour: 'AMBER',
      triggeredByPriority: false,
      triggeredKeys: [],
      redMetrics: [],
      hasRedAlert: false,
    };
  }

  return {
    colour: 'GREEN',
    triggeredByPriority: false,
    triggeredKeys: [],
    redMetrics: [],
    hasRedAlert: false,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMetricRed(metric: keyof ScanResult, value: number, t: typeof config.thresholds): string {
  switch (metric) {
    case 'tbRisk':          return `TB Risk: ${value}% (≥${t.tbRisk.red}% threshold)`;
    case 'afibRisk':        return `AFib Risk: ${value}% (≥${t.afibRisk.red}% threshold)`;
    case 'heartRate':       return `Heart Rate: ${value} BPM (low ≤${t.heartRate.redLow} or high ≥${t.heartRate.redHigh})`;
    case 'hemoglobin':      return `Hemoglobin: ${value} g/dL (≤${t.hemoglobin.red} g/dL)`;
    case 'spo2':            return `SpO₂: ${value}% (≤${t.spo2.red}%)`;
    case 'respiratoryRate': return `Respiratory Rate: ${value}/min (≥${t.respiratoryRate.redHigh} or ≤${t.respiratoryRate.redLow})`;
    default:                return `${metric}: ${value}`;
  }
}

/**
 * Derive the simple four-colour outcome from a completed scan.
 * Used by logPrototypeSession() and the Sync debug panel.
 * Identical to what scan-workflow computes before calling logPrototypeSession.
 */
export function outcomeColourFromScan(
  scan: ScanResult,
  safetyAnswers: PartialSafetyAnswers = {},
): 'green' | 'amber' | 'red' | 'grey' {
  const result = classify(scan, safetyAnswers);
  switch (result.colour) {
    case 'RED':   return 'red';
    case 'AMBER': return 'amber';
    case 'GREEN': return 'green';
    default:      return 'grey';
  }
}

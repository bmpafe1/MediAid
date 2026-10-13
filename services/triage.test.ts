/**
 * MediAid · services/triage.test.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Tests for the triage classifier (services/triage.ts).
 *
 * Coverage targets (PROMPT 8):
 *   • Each of the 10 safety triggers forces RED regardless of numerical scores
 *   • RED cannot be dismissed without escort or bypass (stateless logic verified
 *     via classify() always returning RED when triggered)
 *   • A bypass creates an escalation record (tested in safetyScreen.test.ts)
 *   • GREY never produces a treatment instruction
 *   • AMBER/GREEN boundary at configured thresholds
 */

import { classify, SAFETY_TRIGGERS, outcomeColourFromScan } from './triage';
import { shouldShowTreatmentInstruction } from './safetyScreen';
import type { ScanResult } from './mockData';
import { config } from '@/constants/config';

// ── Helpers ────────────────────────────────────────────────────────────────────

const t = config.thresholds;

/** Baseline GREEN scan — all metrics comfortably within normal range. */
function greenScan(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    id: 'test-scan-001',
    patientName: 'Test Patient',
    patientId: 'CHA-0001',
    consentTimestamp: new Date().toISOString(),
    scanTimestamp:    new Date().toISOString(),
    tbRisk:           10,   // green (< yellow 50)
    afibRisk:         5,    // green (< yellow 30)
    heartRate:        70,   // green (55–110)
    hemoglobin:       12.0, // green (> yellow 11)
    spo2:             98,   // green (> yellow 94)
    respiratoryRate:  16,   // green (12–24)
    tremorRisk:       10,   // green (< 35)
    eyeConditions:    0,
    cvdRisk10yr:      5,
    glucoseFlag:      false,
    covidFlag:        false,
    jaundiceFlag:     false,
    hasRedAlert:      false,
    bypassLogged:     false,
    synced:           false,
    ...overrides,
  };
}

// ── 10 Mandatory Safety Triggers ──────────────────────────────────────────────

describe('Safety Triggers — each forces RED regardless of scores', () => {
  test('SAFETY_TRIGGERS exports all 10 triggers', () => {
    expect(SAFETY_TRIGGERS).toHaveLength(10);
  });

  const triggerIds = SAFETY_TRIGGERS.map((t) => t.id);

  for (const triggerId of triggerIds) {
    test(`Trigger "${triggerId}" on a GREEN scan → RED`, () => {
      const scan = greenScan();
      const result = classify(scan, { [triggerId]: true });
      expect(result.colour).toBe('RED');
      expect(result.triggeredByPriority).toBe(true);
      expect(result.triggeredKeys).toContain(triggerId);
      expect(result.hasRedAlert).toBe(true);
    });
  }

  test('Multiple triggers all fire simultaneously', () => {
    const scan = greenScan();
    const result = classify(scan, {
      alteredConsciousness: true,
      suspectedStroke:      true,
      obstetricEmergency:   true,
    });
    expect(result.colour).toBe('RED');
    expect(result.triggeredKeys).toContain('alteredConsciousness');
    expect(result.triggeredKeys).toContain('suspectedStroke');
    expect(result.triggeredKeys).toContain('obstetricEmergency');
    expect(result.redMetrics).toHaveLength(3);
  });
});

// ── Trigger 10: Numeric Vitals Breach (auto-derived) ─────────────────────────

describe('Trigger 10 — vitalsBreach derived from numeric scan values', () => {
  test('SpO₂ = 90 → vitalsBreach fires automatically', () => {
    const scan = greenScan({ spo2: 90 });
    const result = classify(scan);
    expect(result.colour).toBe('RED');
    expect(result.triggeredByPriority).toBe(true);
    expect(result.triggeredKeys).toContain('vitalsBreach');
  });

  test('SpO₂ = 88 (below threshold) → RED via vitalsBreach', () => {
    const scan = greenScan({ spo2: 88 });
    const result = classify(scan);
    expect(result.colour).toBe('RED');
    expect(result.triggeredKeys).toContain('vitalsBreach');
  });

  test('Heart rate > 150 → vitalsBreach fires', () => {
    const scan = greenScan({ heartRate: 151 });
    const result = classify(scan);
    expect(result.colour).toBe('RED');
    expect(result.triggeredKeys).toContain('vitalsBreach');
  });

  test('Heart rate < 40 → vitalsBreach fires', () => {
    const scan = greenScan({ heartRate: 39 });
    const result = classify(scan);
    expect(result.colour).toBe('RED');
    expect(result.triggeredKeys).toContain('vitalsBreach');
  });

  test('Heart rate exactly 150 → does NOT fire vitalsBreach (> 150 required)', () => {
    const scan = greenScan({ heartRate: 150, spo2: 95 });
    const result = classify(scan);
    // HR=150 is still within normal for config thresholds (redHigh=130 means numeric red fires first)
    // The point here is vitalsBreach.vitalsBreach = HR>150, so 150 does NOT trigger vitalsBreach
    expect(result.triggeredKeys).not.toContain('vitalsBreach');
    // But HR=150 > redHigh=130, so numeric RED still fires
    expect(result.colour).toBe('RED');
    expect(result.triggeredByPriority).toBe(false);
  });

  test('SpO₂ = 91 and HR = 70 → NO vitalsBreach', () => {
    const scan = greenScan({ spo2: 91 });
    const result = classify(scan);
    // SpO₂=91 is > 90 so no vitalsBreach auto-trigger.
    // SpO₂=91 is ≤ yellow threshold (94), so AMBER
    expect(result.triggeredKeys).not.toContain('vitalsBreach');
  });
});

// ── Numeric RED thresholds ─────────────────────────────────────────────────────

describe('Numeric RED thresholds', () => {
  test(`tbRisk ≥ ${t.tbRisk.red} → RED`, () => {
    const result = classify(greenScan({ tbRisk: t.tbRisk.red }));
    expect(result.colour).toBe('RED');
    expect(result.triggeredByPriority).toBe(false);
    expect(result.redMetrics.some((m) => m.includes('TB Risk'))).toBe(true);
  });

  test(`afibRisk ≥ ${t.afibRisk.red} → RED`, () => {
    expect(classify(greenScan({ afibRisk: t.afibRisk.red })).colour).toBe('RED');
  });

  test(`heartRate ≤ ${t.heartRate.redLow} → RED`, () => {
    expect(classify(greenScan({ heartRate: t.heartRate.redLow })).colour).toBe('RED');
  });

  test(`heartRate ≥ ${t.heartRate.redHigh} → RED`, () => {
    expect(classify(greenScan({ heartRate: t.heartRate.redHigh })).colour).toBe('RED');
  });

  test(`hemoglobin ≤ ${t.hemoglobin.red} → RED`, () => {
    expect(classify(greenScan({ hemoglobin: t.hemoglobin.red })).colour).toBe('RED');
  });

  test(`spo2 ≤ ${t.spo2.red} → RED`, () => {
    expect(classify(greenScan({ spo2: t.spo2.red })).colour).toBe('RED');
  });

  test(`respiratoryRate ≥ ${t.respiratoryRate.redHigh} → RED`, () => {
    expect(classify(greenScan({ respiratoryRate: t.respiratoryRate.redHigh })).colour).toBe('RED');
  });

  test(`respiratoryRate ≤ ${t.respiratoryRate.redLow} → RED`, () => {
    expect(classify(greenScan({ respiratoryRate: t.respiratoryRate.redLow })).colour).toBe('RED');
  });

  test('tremorRisk ≥ 60 → RED', () => {
    expect(classify(greenScan({ tremorRisk: 60 })).colour).toBe('RED');
  });

  test('tremorRisk = 59 → AMBER (below 60)', () => {
    expect(classify(greenScan({ tremorRisk: 59 })).colour).toBe('AMBER');
  });
});

// ── AMBER/GREEN boundaries ────────────────────────────────────────────────────

describe('AMBER/GREEN boundary at configured thresholds', () => {
  test(`tbRisk = ${t.tbRisk.yellow} (yellow boundary) → AMBER`, () => {
    expect(classify(greenScan({ tbRisk: t.tbRisk.yellow })).colour).toBe('AMBER');
  });

  test(`tbRisk = ${t.tbRisk.yellow - 1} (just below yellow) → GREEN`, () => {
    expect(classify(greenScan({ tbRisk: t.tbRisk.yellow - 1 })).colour).toBe('GREEN');
  });

  test(`hemoglobin = ${t.hemoglobin.yellow} (yellow boundary) → AMBER`, () => {
    expect(classify(greenScan({ hemoglobin: t.hemoglobin.yellow })).colour).toBe('AMBER');
  });

  test(`hemoglobin > ${t.hemoglobin.yellow} → GREEN`, () => {
    expect(classify(greenScan({ hemoglobin: t.hemoglobin.yellow + 0.1 })).colour).toBe('GREEN');
  });

  test(`spo2 = ${t.spo2.yellow} (yellow boundary) → AMBER`, () => {
    expect(classify(greenScan({ spo2: t.spo2.yellow })).colour).toBe('AMBER');
  });

  test(`spo2 = ${t.spo2.yellow + 1} → GREEN`, () => {
    expect(classify(greenScan({ spo2: t.spo2.yellow + 1 })).colour).toBe('GREEN');
  });

  test('tremorRisk = 35 (yellow boundary) → AMBER', () => {
    expect(classify(greenScan({ tremorRisk: 35 })).colour).toBe('AMBER');
  });

  test('tremorRisk = 34 → GREEN', () => {
    expect(classify(greenScan({ tremorRisk: 34 })).colour).toBe('GREEN');
  });
});

// ── GREY / treatment-instruction guard ───────────────────────────────────────

describe('GREY outcome — never produces a treatment instruction', () => {
  test('shouldShowTreatmentInstruction("GREY") → false', () => {
    expect(shouldShowTreatmentInstruction('GREY')).toBe(false);
  });

  test('shouldShowTreatmentInstruction("RED") → false', () => {
    expect(shouldShowTreatmentInstruction('RED')).toBe(false);
  });

  test('shouldShowTreatmentInstruction("AMBER") → true', () => {
    expect(shouldShowTreatmentInstruction('AMBER')).toBe(true);
  });

  test('shouldShowTreatmentInstruction("GREEN") → true', () => {
    expect(shouldShowTreatmentInstruction('GREEN')).toBe(true);
  });

  test('Adjunct metrics (glucoseFlag, jaundiceFlag, cvdRisk10yr) alone do NOT produce RED', () => {
    const scan = greenScan({
      glucoseFlag:  true,
      jaundiceFlag: true,
      covidFlag:    true,
      cvdRisk10yr:  35,
      eyeConditions: 3,
    });
    const result = classify(scan);
    // Adjunct-only flags must never drive clinical colour
    expect(result.colour).toBe('GREEN');
    expect(result.hasRedAlert).toBe(false);
  });
});

// ── outcomeColourFromScan helper ──────────────────────────────────────────────

describe('outcomeColourFromScan()', () => {
  test('GREEN scan → "green"', () => {
    expect(outcomeColourFromScan(greenScan())).toBe('green');
  });

  test('HIGH tbRisk → "red"', () => {
    expect(outcomeColourFromScan(greenScan({ tbRisk: 90 }))).toBe('red');
  });

  test('AMBER tbRisk → "amber"', () => {
    expect(outcomeColourFromScan(greenScan({ tbRisk: 60 }))).toBe('amber');
  });

  test('Safety trigger → "red"', () => {
    expect(outcomeColourFromScan(greenScan(), { alteredConsciousness: true })).toBe('red');
  });
});

// ── Priority: safety trigger wins over numeric score ─────────────────────────

describe('Safety trigger takes priority over numeric score direction', () => {
  test('GREEN scores + trigger → RED (trigger wins)', () => {
    const scan = greenScan();
    const result = classify(scan, { suspectedMeningitis: true });
    expect(result.colour).toBe('RED');
    expect(result.triggeredByPriority).toBe(true);
  });

  test('RED score + no trigger → RED from numeric (triggeredByPriority=false)', () => {
    const scan = greenScan({ tbRisk: 95 });
    const result = classify(scan);
    expect(result.colour).toBe('RED');
    expect(result.triggeredByPriority).toBe(false);
  });

  test('Empty safetyAnswers → no triggers fire', () => {
    const scan = greenScan();
    const result = classify(scan, {});
    expect(result.colour).toBe('GREEN');
    expect(result.triggeredKeys).toHaveLength(0);
  });
});

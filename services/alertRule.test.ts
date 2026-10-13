/**
 * MediAid · services/alertRule.test.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Jest tests for services/alertRule.ts — the outbreak alert rule.
 * Mirrors the TEST_CASES array in the source file, plus boundary tests.
 */

import {
  computeAlertLevel,
  computeAlertLevelFromAggregates,
  TEST_CASES,
  type AlertInputRow,
} from './alertRule';

// ── Run the bundled TEST_CASES ─────────────────────────────────────────────────

describe('computeAlertLevel() — bundled TEST_CASES', () => {
  for (const tc of TEST_CASES) {
    test(tc.label, () => {
      expect(computeAlertLevel(tc.rows)).toBe(tc.expected);
    });
  }
});

// ── computeAlertLevelFromAggregates ───────────────────────────────────────────

describe('computeAlertLevelFromAggregates()', () => {
  test('OUTBREAK when totalRed ≥ 2', () => {
    expect(computeAlertLevelFromAggregates({ totalRed: 2, totalCough: 0, totalScans: 10 })).toBe('OUTBREAK');
  });

  test('ELEVATED when cough% > 35 and totalRed < 2', () => {
    expect(computeAlertLevelFromAggregates({ totalRed: 1, totalCough: 5, totalScans: 10 })).toBe('ELEVATED');
  });

  test('NORMAL when cough% exactly 35 (must be strictly > 35)', () => {
    // 35/100 = 0.35 — not > 0.35
    expect(computeAlertLevelFromAggregates({ totalRed: 0, totalCough: 35, totalScans: 100 })).toBe('NORMAL');
  });

  test('NORMAL when cough% = 36% and totalRed = 1', () => {
    // totalRed=1 < 2 → not OUTBREAK; 36/100 > 0.35 → ELEVATED
    expect(computeAlertLevelFromAggregates({ totalRed: 1, totalCough: 36, totalScans: 100 })).toBe('ELEVATED');
  });

  test('OUTBREAK takes priority over elevated cough rate', () => {
    expect(computeAlertLevelFromAggregates({ totalRed: 2, totalCough: 90, totalScans: 100 })).toBe('OUTBREAK');
  });

  test('NORMAL with zero scans', () => {
    expect(computeAlertLevelFromAggregates({ totalRed: 0, totalCough: 0, totalScans: 0 })).toBe('NORMAL');
  });

  test('NORMAL with 1 red and 0 cough', () => {
    expect(computeAlertLevelFromAggregates({ totalRed: 1, totalCough: 0, totalScans: 5 })).toBe('NORMAL');
  });
});

// ── Edge cases ─────────────────────────────────────────────────────────────────

describe('computeAlertLevel() — edge cases', () => {
  test('Empty array → NORMAL', () => {
    expect(computeAlertLevel([])).toBe('NORMAL');
  });

  test('Single row with red_count=1 → NORMAL (needs 2)', () => {
    const rows: AlertInputRow[] = [{ red_count: 1, cough_positive: 0, total_scans: 1 }];
    expect(computeAlertLevel(rows)).toBe('NORMAL');
  });

  test('100 rows all-green → NORMAL', () => {
    const rows: AlertInputRow[] = Array.from({ length: 100 }, () => ({
      red_count: 0, cough_positive: 0, total_scans: 1,
    }));
    expect(computeAlertLevel(rows)).toBe('NORMAL');
  });

  test('2 red rows in 500-row batch → OUTBREAK', () => {
    const rows: AlertInputRow[] = Array.from({ length: 500 }, (_, i) => ({
      red_count:      i < 2 ? 1 : 0,
      cough_positive: 0,
      total_scans:    1,
    }));
    expect(computeAlertLevel(rows)).toBe('OUTBREAK');
  });

  test('35.1% cough rate → ELEVATED', () => {
    // 351 coughs / 1000 scans = 0.351 > 0.35
    const rows: AlertInputRow[] = Array.from({ length: 1000 }, (_, i) => ({
      red_count:      0,
      cough_positive: i < 351 ? 1 : 0,
      total_scans:    1,
    }));
    expect(computeAlertLevel(rows)).toBe('ELEVATED');
  });
});

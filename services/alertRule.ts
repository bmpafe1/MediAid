/**
 * MediAid · services/alertRule.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Unit-testable TypeScript implementation of the outbreak alert rule.
 * This mirrors the CASE expression in supabase/migrations/001_outbreak_radar.sql
 * exactly — any change to one MUST be reflected in the other.
 *
 * Used by:
 *   - services/outbreakSync.ts  (before transmitting to Supabase, for local display)
 *   - app/(tabs)/radar.tsx      (offline alert badge)
 *   - tests run via PROMPT 8
 *
 * PLANNED (Q2): rainfall anomaly input parameter from DHIS2 Climate App
 * (ERA-5 / CHIRPS datasets). When implemented, add a `rainfallAnomalyScore`
 * field to AlertInputRow and an additional ELEVATED branch here.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertLevel = 'OUTBREAK' | 'ELEVATED' | 'NORMAL';

/**
 * One scan-event row, as stored in public.outbreak_radar.
 * Pass an array covering the 7-day rolling window for a single
 * (village_geohash, data_source) cell.
 */
export interface AlertInputRow {
  red_count: number;       // 0 or 1
  cough_positive: number;  // 0 or 1
  total_scans: number;     // always 1 per row at the base-table level
}

/**
 * Pre-aggregated inputs — use this when you already have the 7-day sums
 * (e.g. from the outbreak_radar_7d view) and want to re-derive alert_level
 * client-side without re-scanning individual rows.
 */
export interface AlertAggregated {
  totalRed: number;
  totalCough: number;
  totalScans: number;
}

// ---------------------------------------------------------------------------
// Core rule — matches the SQL CASE expression verbatim
// ---------------------------------------------------------------------------

/**
 * Compute alert level from a list of raw scan-event rows.
 *
 * Rule (identical to the SQL view):
 *   OUTBREAK  — sum(red_count)  ≥ 2
 *   ELEVATED  — sum(cough_positive) / sum(total_scans) > 0.35
 *   NORMAL    — otherwise
 *
 * @param rows  Array of scan-event rows for a 7-day window in one geohash cell.
 * @returns     'OUTBREAK' | 'ELEVATED' | 'NORMAL'
 */
export function computeAlertLevel(rows: AlertInputRow[]): AlertLevel {
  if (rows.length === 0) return 'NORMAL';

  const totalRed   = rows.reduce((sum, r) => sum + (r.red_count       ?? 0), 0);
  const totalCough = rows.reduce((sum, r) => sum + (r.cough_positive   ?? 0), 0);
  const totalScans = rows.reduce((sum, r) => sum + (r.total_scans      ?? 0), 0);

  return computeAlertLevelFromAggregates({ totalRed, totalCough, totalScans });
}

/**
 * Compute alert level from pre-aggregated 7-day sums.
 * Useful when reading from the outbreak_radar_7d view directly.
 *
 * @param agg  Pre-aggregated totals for the 7-day window.
 * @returns    'OUTBREAK' | 'ELEVATED' | 'NORMAL'
 */
export function computeAlertLevelFromAggregates(agg: AlertAggregated): AlertLevel {
  if (agg.totalRed >= 2) {
    return 'OUTBREAK';
  }

  if (agg.totalScans > 0 && agg.totalCough / agg.totalScans > 0.35) {
    return 'ELEVATED';
  }

  return 'NORMAL';
}

// ---------------------------------------------------------------------------
// Inline tests — run with: npx ts-node services/alertRule.ts
// (PROMPT 8 will wire these into a proper test runner)
// ---------------------------------------------------------------------------

export interface TestCase {
  label: string;
  rows: AlertInputRow[];
  expected: AlertLevel;
}

export const TEST_CASES: TestCase[] = [
  {
    label: 'OUTBREAK: 2 red_count rows triggers OUTBREAK regardless of cough rate',
    rows: [
      { red_count: 1, cough_positive: 1, total_scans: 1 },
      { red_count: 1, cough_positive: 1, total_scans: 1 },
      { red_count: 0, cough_positive: 1, total_scans: 1 },
      { red_count: 0, cough_positive: 0, total_scans: 1 },
      { red_count: 0, cough_positive: 0, total_scans: 1 },
      { red_count: 0, cough_positive: 0, total_scans: 1 },
    ],
    expected: 'OUTBREAK',
  },
  {
    label: 'OUTBREAK: exactly 2 red rows, no cough',
    rows: [
      { red_count: 1, cough_positive: 0, total_scans: 1 },
      { red_count: 1, cough_positive: 0, total_scans: 1 },
    ],
    expected: 'OUTBREAK',
  },
  {
    label: 'ELEVATED: cough_positive / total_scans = 2/3 = 67% > 35%, no reds',
    rows: [
      { red_count: 0, cough_positive: 1, total_scans: 1 },
      { red_count: 0, cough_positive: 1, total_scans: 1 },
      { red_count: 0, cough_positive: 0, total_scans: 1 },
    ],
    expected: 'ELEVATED',
  },
  {
    label: 'ELEVATED: exactly 36% cough rate (1 red would push to OUTBREAK first)',
    rows: [
      { red_count: 0, cough_positive: 1, total_scans: 1 },
      { red_count: 0, cough_positive: 0, total_scans: 1 },
      // 1/2 = 50% — but only 1 red, so ELEVATED
    ],
    expected: 'ELEVATED',
  },
  {
    label: 'NORMAL: 1 red row only (below OUTBREAK threshold of 2)',
    rows: [
      { red_count: 1, cough_positive: 0, total_scans: 1 },
    ],
    expected: 'NORMAL',
  },
  {
    label: 'NORMAL: 35% cough rate (boundary — must be STRICTLY > 35%)',
    rows: [
      { red_count: 0, cough_positive: 1, total_scans: 1 },
      { red_count: 0, cough_positive: 0, total_scans: 1 },
      { red_count: 0, cough_positive: 1, total_scans: 1 },
      // 2 coughs / 6 scans = exactly 33.3% — below 35%
      { red_count: 0, cough_positive: 0, total_scans: 1 },
      { red_count: 0, cough_positive: 0, total_scans: 1 },
      { red_count: 0, cough_positive: 0, total_scans: 1 },
    ],
    expected: 'NORMAL',
  },
  {
    label: 'NORMAL: empty row array',
    rows: [],
    expected: 'NORMAL',
  },
  {
    label: 'NORMAL: all green, no cough, no red',
    rows: [
      { red_count: 0, cough_positive: 0, total_scans: 1 },
      { red_count: 0, cough_positive: 0, total_scans: 1 },
      { red_count: 0, cough_positive: 0, total_scans: 1 },
    ],
    expected: 'NORMAL',
  },
];

/**
 * Run all TEST_CASES and report pass/fail to console.
 * Called automatically when this file is run directly with ts-node.
 */
export function runTests(): void {
  let passed = 0;
  let failed = 0;

  for (const tc of TEST_CASES) {
    const result = computeAlertLevel(tc.rows);
    if (result === tc.expected) {
      console.log(`  ✓  ${tc.label}`);
      passed++;
    } else {
      console.error(`  ✗  ${tc.label}`);
      console.error(`     Expected: ${tc.expected}  Got: ${result}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${TEST_CASES.length} tests.`);
  if (failed > 0) process.exit(1);
}

// Run when executed directly: `npx ts-node services/alertRule.ts`
if (require.main === module) {
  console.log('MediAid · alertRule.ts inline tests\n');
  runTests();
}

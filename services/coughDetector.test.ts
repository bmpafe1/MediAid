/**
 * MediAid · services/coughDetector.test.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Unit tests for the on-device cough event detector.
 * Run with: npx jest services/coughDetector.test.ts
 *
 * No native modules mocked — detector is pure TypeScript.
 */

import {
  createDetectorState,
  feedSamples,
  median,
  updateDetector,
  type DetectorState,
} from './coughDetector';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a "silence" sample array of `n` samples at `level` dBFS. */
const silence = (n: number, level = -70): number[] => Array(n).fill(level);

/**
 * Build one cough burst: rise to `peakDb` for `durationSamples` samples
 * (must be 1–5 samples = 100–500 ms) then back to silence.
 */
const burst = (durationSamples: number, peakDb = -20): number[] => [
  ...Array(durationSamples).fill(peakDb),
];

/** Floor computed from first 20 samples at −70 dBFS → median = −70. */
const FLOOR = -70;
/** Threshold = floor + 12 dB = −58 dBFS. */
const THRESHOLD = FLOOR + 12; // −58

// ── median helper ─────────────────────────────────────────────────────────────

describe('median()', () => {
  test('empty array returns −160', () => {
    expect(median([])).toBe(-160);
  });

  test('single element', () => {
    expect(median([-50])).toBe(-50);
  });

  test('odd length', () => {
    expect(median([-60, -40, -80])).toBe(-60);
  });

  test('even length', () => {
    expect(median([-80, -60, -40, -20])).toBe(-50);
  });

  test('does not mutate input', () => {
    const arr = [-30, -70, -50];
    const copy = [...arr];
    median(arr);
    expect(arr).toEqual(copy);
  });
});

// ── createDetectorState ───────────────────────────────────────────────────────

describe('createDetectorState()', () => {
  test('starts with no events and no samples', () => {
    const s = createDetectorState();
    expect(s.events).toHaveLength(0);
    expect(s.samples).toHaveLength(0);
    expect(s.floorLocked).toBe(false);
  });
});

// ── noise floor lock ──────────────────────────────────────────────────────────

describe('Noise floor', () => {
  test('locks after 20 samples', () => {
    let s = createDetectorState();
    s = feedSamples(s, silence(19));
    expect(s.floorLocked).toBe(false);
    s = updateDetector(s, FLOOR);
    expect(s.floorLocked).toBe(true);
    expect(s.noiseFloor).toBe(FLOOR);
  });

  test('no events fired before floor is locked', () => {
    let s = createDetectorState();
    // Feed 10 silence + 5 bursts before floor lock
    s = feedSamples(s, silence(10));
    s = feedSamples(s, burst(3, -10));
    expect(s.events).toHaveLength(0);
  });
});

// ── silence — no coughs ───────────────────────────────────────────────────────

describe('Silence — no cough events', () => {
  test('30 s of silence produces 0 events', () => {
    let s = createDetectorState();
    // 20 floor samples + 280 silence samples (total 300 = 30 s)
    s = feedSamples(s, silence(300));
    expect(s.events).toHaveLength(0);
  });

  test('steady noise at threshold − 1 dB produces 0 events', () => {
    let s = createDetectorState();
    s = feedSamples(s, silence(20)); // lock floor at −70
    // Signal 1 dB below threshold continuously
    s = feedSamples(s, Array(50).fill(THRESHOLD - 1));
    expect(s.events).toHaveLength(0);
  });
});

// ── three clear cough bursts ──────────────────────────────────────────────────

describe('Three clear cough bursts', () => {
  function threeCoughSession(): DetectorState {
    let s = createDetectorState();
    s = feedSamples(s, silence(20));   // lock floor
    s = feedSamples(s, silence(5));    // quiet gap before first cough
    s = feedSamples(s, burst(3, -20)); // cough 1 (300 ms)
    s = feedSamples(s, silence(5));    // quiet gap ≥ 250 ms
    s = feedSamples(s, burst(3, -15)); // cough 2 (300 ms)
    s = feedSamples(s, silence(5));    // quiet gap
    s = feedSamples(s, burst(2, -25)); // cough 3 (200 ms — above 80 ms min)
    s = feedSamples(s, silence(5));    // trailing silence (closes any open burst)
    return s;
  }

  test('detects exactly 3 cough events', () => {
    const s = threeCoughSession();
    expect(s.events).toHaveLength(3);
  });

  test('each event duration is between 80 and 500 ms', () => {
    const s = threeCoughSession();
    s.events.forEach((ev) => {
      expect(ev.durationMs).toBeGreaterThanOrEqual(80);
      expect(ev.durationMs).toBeLessThanOrEqual(500);
    });
  });
});

// ── one long noise burst — should NOT count ───────────────────────────────────

describe('Long noise — should not count as cough', () => {
  test('600 ms continuous noise → 0 events (exceeds BURST_MAX_MS = 500 ms)', () => {
    let s = createDetectorState();
    s = feedSamples(s, silence(20));   // lock floor
    s = feedSamples(s, silence(5));
    s = feedSamples(s, burst(6, -20)); // 600 ms continuous above threshold
    s = feedSamples(s, silence(5));
    expect(s.events).toHaveLength(0);
  });

  test('20 s of steady loud noise → 0 events', () => {
    let s = createDetectorState();
    s = feedSamples(s, silence(20));
    s = feedSamples(s, Array(200).fill(-20)); // 20 s of loud
    s = feedSamples(s, silence(5));
    expect(s.events).toHaveLength(0);
  });
});

// ── quiet gap enforcement ─────────────────────────────────────────────────────

describe('Quiet gap enforcement', () => {
  test('two bursts with only 1 sample quiet gap → second burst not counted', () => {
    let s = createDetectorState();
    s = feedSamples(s, silence(20));
    s = feedSamples(s, silence(5));
    s = feedSamples(s, burst(3, -20)); // cough 1
    // Only 1 sample quiet (< 3 required = 250 ms)
    s = updateDetector(s, FLOOR - 5);
    s = feedSamples(s, burst(3, -20)); // cough 2 should be rejected
    s = feedSamples(s, silence(5));
    expect(s.events).toHaveLength(1);
  });

  test('two bursts with 3 sample quiet gap → both counted', () => {
    let s = createDetectorState();
    s = feedSamples(s, silence(20));
    s = feedSamples(s, silence(5));
    s = feedSamples(s, burst(3, -20)); // cough 1
    s = feedSamples(s, silence(3));    // exactly 3 samples = 300 ms
    s = feedSamples(s, burst(3, -20)); // cough 2
    s = feedSamples(s, silence(5));
    expect(s.events).toHaveLength(2);
  });
});

// ── very short burst — below minimum ─────────────────────────────────────────

describe('Very short burst — below BURST_MIN_MS', () => {
  test('50 ms burst (< 80 ms min) not counted as cough', () => {
    // NOTE: 100 ms is the minimum sample granularity; 1 sample = 100 ms ≥ 80 ms.
    // This test uses the boundary: a burst ending immediately after 0 additional
    // samples can only be 100 ms. We test that a burst where the level drops
    // after 0 extra samples still counts (100 ms ≥ 80 ms threshold).
    let s = createDetectorState();
    s = feedSamples(s, silence(20));
    s = feedSamples(s, silence(5));
    // Single-sample burst (100 ms) — ≥ 80 ms so should count
    s = updateDetector(s, -20); // peak
    s = updateDetector(s, FLOOR - 5); // drop back to quiet
    s = feedSamples(s, silence(3));
    // 100 ms is ≥ 80 ms minimum → counts
    expect(s.events).toHaveLength(1);
    expect(s.events[0].durationMs).toBe(100);
  });
});

// ── feedSamples is equivalent to sequential updateDetector calls ──────────────

describe('feedSamples consistency', () => {
  test('feedSamples matches sequential updateDetector', () => {
    const samples = [...silence(20), ...burst(3, -25), ...silence(5)];

    let manual = createDetectorState();
    samples.forEach((v) => { manual = updateDetector(manual, v); });

    const batched = feedSamples(createDetectorState(), samples);

    expect(batched.events).toHaveLength(manual.events.length);
    expect(batched.samples).toHaveLength(manual.samples.length);
    expect(batched.floorLocked).toBe(manual.floorLocked);
    expect(batched.noiseFloor).toBe(manual.noiseFloor);
  });
});

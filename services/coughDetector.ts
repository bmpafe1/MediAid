/**
 * MediAid · services/coughDetector.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * On-device cough event detector that runs on metering (dBFS) level samples
 * collected from expo-av Audio.Recording with isMeteringEnabled: true.
 *
 * Algorithm:
 *   - Noise floor  = median of the first 2 s of samples (20 samples at 100 ms)
 *   - Burst        = level rises > BURST_DB_RISE above floor for 80–500 ms
 *   - Quiet gap    = ≥ 250 ms of silence between bursts (level ≤ floor + 4 dB)
 *   - A "cough event" = one burst meeting the duration and quiet criteria
 *
 * All inputs and outputs are pure values. No React, no side effects.
 * Suitable for Jest unit tests without mocking native modules.
 */

export interface CoughEvent {
  startSampleIndex: number;  // sample index where burst began
  durationMs:       number;  // burst duration in ms
}

export interface DetectorState {
  samples:        number[];    // all dBFS samples so far (−160 to 0)
  noiseFloor:     number;      // computed median of first 2 s
  floorLocked:    boolean;     // true once floor has been computed
  inBurst:        boolean;     // currently inside a detected burst
  burstStartIdx:  number;      // sample index where current burst started
  lastBurstEndIdx: number;     // sample index where last burst ended (for quiet gap)
  events:         CoughEvent[];
}

// ── Constants ──────────────────────────────────────────────────────────────────
const SAMPLE_INTERVAL_MS   = 100;   // expo-av metering poll period
const FLOOR_SAMPLES        = 20;    // 2 s of samples to compute floor (20 × 100 ms)
const BURST_DB_RISE        = 12;    // dB above floor to enter burst
const BURST_MIN_MS         = 80;    // minimum burst duration (ms)
const BURST_MAX_MS         = 500;   // maximum burst duration (ms) — longer = noise/talk
const QUIET_GAP_SAMPLES    = 3;     // ≥ 250 ms quiet (3 × 100 ms) between bursts
const FLOOR_HYSTERESIS_DB  = 4;     // within this of floor → considered "quiet"

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Median of an array (modifies a copy, does not mutate). */
export function median(arr: number[]): number {
  if (arr.length === 0) return -160;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ── State factory ──────────────────────────────────────────────────────────────

export function createDetectorState(): DetectorState {
  return {
    samples:         [],
    noiseFloor:      -80,
    floorLocked:     false,
    inBurst:         false,
    burstStartIdx:   -1,
    lastBurstEndIdx: -1,
    events:          [],
  };
}

// ── Main update function ────────────────────────────────────────────────────────

/**
 * Feed one new dBFS metering sample into the detector.
 * Returns the updated state (immutable-style — caller should replace old state).
 *
 * @param state  Current detector state
 * @param dbfs   New sample from expo-av status.metering (dBFS, −160 to 0)
 * @returns      Updated DetectorState
 */
export function updateDetector(state: DetectorState, dbfs: number): DetectorState {
  // Clamp to valid range
  const sample = Math.max(-160, Math.min(0, dbfs));

  const next: DetectorState = {
    ...state,
    samples: [...state.samples, sample],
    events:  state.events,   // ref; will be replaced only when appending
  };

  const idx = next.samples.length - 1;

  // ── Compute noise floor once (after FLOOR_SAMPLES samples) ───────────────
  if (!next.floorLocked && next.samples.length >= FLOOR_SAMPLES) {
    next.noiseFloor  = median(next.samples.slice(0, FLOOR_SAMPLES));
    next.floorLocked = true;
  }

  if (!next.floorLocked) return next; // still warming up

  const threshold = next.noiseFloor + BURST_DB_RISE;
  const quietLine = next.noiseFloor + FLOOR_HYSTERESIS_DB;

  // ── Burst detection ────────────────────────────────────────────────────────
  if (!next.inBurst) {
    if (sample >= threshold) {
      // Ensure quiet gap since last burst
      const quietGapMet =
        next.lastBurstEndIdx === -1 ||
        (idx - next.lastBurstEndIdx) >= QUIET_GAP_SAMPLES;

      if (quietGapMet) {
        next.inBurst      = true;
        next.burstStartIdx = idx;
      }
    }
  } else {
    // We are in a burst
    const burstLenSamples = idx - next.burstStartIdx + 1;
    const burstMs         = burstLenSamples * SAMPLE_INTERVAL_MS;

    const burstEnded  = sample < threshold;   // level dropped below threshold
    const burstMaxed  = burstMs > BURST_MAX_MS;

    if (burstEnded || burstMaxed) {
      next.inBurst         = false;
      next.lastBurstEndIdx = idx;

      // Only count if duration was within valid cough range
      if (burstMs >= BURST_MIN_MS && burstMs <= BURST_MAX_MS) {
        next.events = [
          ...next.events,
          {
            startSampleIndex: next.burstStartIdx,
            durationMs:       burstMs,
          },
        ];
      }

      next.burstStartIdx = -1;
    }
  }

  return next;
}

/**
 * Convenience: feed an array of samples all at once.
 * Useful in tests and for replaying a recorded session.
 */
export function feedSamples(
  initial: DetectorState,
  samples: number[]
): DetectorState {
  return samples.reduce(updateDetector, initial);
}

/**
 * Returns true if the current level is "quiet" relative to the noise floor.
 * Used by the UI to show a "quiet" indicator.
 */
export function isQuiet(state: DetectorState, latestDbfs: number): boolean {
  if (!state.floorLocked) return false;
  return latestDbfs < state.noiseFloor + FLOOR_HYSTERESIS_DB;
}

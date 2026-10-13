/**
 * MediAid · services/outbreakRadar.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Public entry point for logging scan events to the outbreak radar.
 *
 * Call logPrototypeSession() immediately after a scan completes.
 * It builds an anonymised RadarEvent via toRadarEvent() (the de-identification
 * gateway) and enqueues it for background upload via radarQueue.
 *
 * Nothing here transmits data directly — all transmission happens in
 * radarQueue.flush() which is triggered by connectivity events, scan
 * completions, and the "Sync now" button.
 *
 * Data transmitted per event (whitelisted in deidentify.ts):
 *   village_geohash, data_source, total_scans, green_count, amber_count,
 *   red_count, cough_positive, referral_count, fever_flag.
 *
 * NEVER transmitted: patient name, patient ID, GPS, raw audio/video,
 * biometric templates, village_name, free text, GBV indicators.
 */

import { enqueue, flush } from './radarQueue';
import { toRadarEvent, DataSource } from './deidentify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionType = 'co-design' | 'demo' | 'training' | 'field-test';

export interface LogSessionParams {
  /** 4-char geohash of the village/site where the scan was performed. */
  villageGeohash: string;

  /**
   * The session trust tier.
   * co-design / demo → 'simulated_demo'
   * training         → 'training'
   * field-test       → 'field_test'
   * ('field' is never sent from the app in the current build)
   */
  sessionType: SessionType;

  /** Four-colour scan outcome. */
  outcomeColour: 'green' | 'amber' | 'red' | 'grey';

  /** True if the cough segment produced a positive signal flag. */
  coughPositive: boolean;

  /** True if a referral was issued for this patient. */
  referralIssued?: boolean;
}

// ---------------------------------------------------------------------------
// sessionType → DataSource mapping
// ---------------------------------------------------------------------------

function resolveDataSource(sessionType: SessionType): DataSource {
  switch (sessionType) {
    case 'training':    return 'training';
    case 'field-test':  return 'field_test';
    case 'co-design':
    case 'demo':
    default:            return 'simulated_demo';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log a completed scan session to the outbreak radar queue.
 *
 * This function:
 *   1. Calls toRadarEvent() to build the whitelisted anonymised event.
 *   2. Enqueues it locally (AsyncStorage, never dropped until server confirms).
 *   3. Attempts an immediate flush (non-blocking, never throws).
 *
 * Safe to call from the scan workflow with no await — it runs in the
 * background and never delays the UI.
 */
export async function logPrototypeSession(params: LogSessionParams): Promise<void> {
  try {
    const event = toRadarEvent({
      village_geohash: params.villageGeohash,
      data_source:     resolveDataSource(params.sessionType),
      outcomeColour:   params.outcomeColour,
      coughPositive:   params.coughPositive,
      referralIssued:  params.referralIssued ?? false,
    });

    await enqueue(event);

    // Fire-and-forget flush — does not block the caller
    flush().catch(() => {
      // flush() itself never throws, but we catch anyway for safety
    });
  } catch (err) {
    // Never propagate errors to the scan workflow
    console.error('[outbreakRadar] logPrototypeSession error:', err);
  }
}

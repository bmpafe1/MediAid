/**
 * MediAid · services/outbreakRadar.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Public entry point for logging scan events to the outbreak radar.
 *
 * Call logPrototypeSession() immediately after a scan completes.
 * It builds a RadarEvent via toRadarEvent() (the de-identification gateway)
 * and enqueues it for background upload via radarQueue.
 *
 * Nothing here transmits data directly — all transmission happens in
 * radarQueue.flush() which is triggered by connectivity events and the
 * "Sync now" button.
 *
 * ─── Transmitted per event (whitelist enforced by toRadarEvent()) ──────────────
 *   village_geohash, data_source, total_scans, green_count, amber_count,
 *   red_count, cough_positive, referral_count, fever_flag,
 *   client_event_id, recorded_at.
 *
 * ─── NEVER transmitted ────────────────────────────────────────────────────────
 *   patient name, patient ID, GPS, raw audio/video, biometric templates,
 *   village_name, free text, GBV indicators, DOB, phone, email.
 */

import { enqueue, flush } from './radarQueue';
import { toRadarEvent } from './deidentify';
import type { DataSource } from './deidentify';

// ── Types ──────────────────────────────────────────────────────────────────────

export type SessionType = 'co-design' | 'demo' | 'training' | 'field-test';

export interface LogSessionParams {
  /** Pre-configured 4-char geohash of the village/site. Never raw GPS. */
  villageGeohash: string;

  /**
   * Session trust tier:
   *   co-design / demo → 'simulated_demo'
   *   training         → 'training'
   *   field-test       → 'field_test'
   */
  sessionType: SessionType;

  /** Four-colour scan outcome. */
  outcomeColour: 'green' | 'amber' | 'red' | 'grey';

  /** True if the cough segment produced a positive signal flag. */
  coughPositive: boolean;

  /** True if a referral was issued. */
  referralIssued?: boolean;
}

// ── sessionType → DataSource ───────────────────────────────────────────────────

function resolveDataSource(sessionType: SessionType): DataSource {
  switch (sessionType) {
    case 'training':   return 'training';
    case 'field-test': return 'field_test';
    case 'co-design':
    case 'demo':
    default:           return 'simulated_demo';
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Log a completed scan session to the outbreak radar queue.
 *
 * Steps:
 *   1. toRadarEvent() builds the whitelisted anonymised RadarEvent.
 *   2. enqueue() stores it in AsyncStorage (never dropped until server confirms).
 *   3. flush() is fired-and-forgotten — never delays the UI.
 *
 * Safe to call without await from the scan workflow.
 * Never throws.
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

    flush().catch(() => { /* flush() itself never throws */ });
  } catch (err) {
    // Never propagate to the scan workflow
    console.error('[outbreakRadar] logPrototypeSession error:', err);
  }
}

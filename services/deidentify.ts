/**
 * MediAid · services/deidentify.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * De-identification gateway — the ONLY place that constructs a RadarEvent
 * from raw scan outputs. Whitelists exactly the fields permitted to leave
 * the device per the UNICEF privacy commitment:
 *   village_geohash (4-char), data_source, total_scans=1,
 *   green_count, amber_count, red_count, cough_positive,
 *   referral_count, fever_flag=0.
 *
 * NEVER include: patient name, patient ID, GPS coordinates, raw audio/video,
 * biometric templates, village_name, free text, GBV indicators.
 *
 * Rule 4 of the PROMPT 0 non-negotiable constraints.
 */

/** Simple RFC-4122 v4 UUID without external deps. */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataSource = 'simulated_demo' | 'training' | 'field_test';
// 'field' is intentionally excluded here — not sent from the app yet.

export interface RadarEvent {
  // Generated client-side for idempotent retries
  client_event_id: string;
  recorded_at: string; // ISO-8601

  // Geographic — 4-char geohash only, never GPS
  village_geohash: string; // exactly 4 chars enforced below

  // Trust tier
  data_source: DataSource;

  // Aggregate counts — all 0 or 1 per event row
  total_scans: 1;
  green_count: 0 | 1;
  amber_count: 0 | 1;
  red_count: 0 | 1;
  cough_positive: 0 | 1;
  referral_count: 0 | 1;

  // fever_flag always 0 until a dedicated fever sensor is validated
  fever_flag: 0;
}

export interface DeidentifyParams {
  /** 4-char geohash of the village/site. Truncated/padded to 4 chars if wrong length. */
  village_geohash: string;
  /** 'simulated_demo' | 'training' | 'field_test' */
  data_source: DataSource;
  /** 'green' | 'amber' | 'red' | 'grey' — the four-colour result */
  outcomeColour: 'green' | 'amber' | 'red' | 'grey';
  /** Whether the cough segment flagged a positive signal */
  coughPositive: boolean;
  /** Whether a referral was issued for this patient */
  referralIssued: boolean;
}

// ---------------------------------------------------------------------------
// Core function — produces the whitelisted RadarEvent
// ---------------------------------------------------------------------------

/**
 * Builds an anonymised RadarEvent ready to enqueue for Supabase.
 * No patient-identifying field may survive this function.
 */
export function toRadarEvent(params: DeidentifyParams): RadarEvent {
  // Normalise geohash: must be exactly 4 ASCII chars, no special chars.
  const rawHash = (params.village_geohash ?? '').replace(/[^a-z0-9]/gi, '0');
  const geohash =
    rawHash.length >= 4
      ? rawHash.slice(0, 4)
      : rawHash.padEnd(4, '0');

  // Outcome colour → binary counts (GREY = no outcome flag)
  const green_count  = params.outcomeColour === 'green'  ? 1 : 0 as 0 | 1;
  const amber_count  = params.outcomeColour === 'amber'  ? 1 : 0 as 0 | 1;
  const red_count    = params.outcomeColour === 'red'    ? 1 : 0 as 0 | 1;
  // Constraint: green + amber + red <= 1 (GREY has all three = 0)

  return {
    client_event_id:  uuidv4(),
    recorded_at:      new Date().toISOString(),
    village_geohash:  geohash,
    data_source:      params.data_source,
    total_scans:      1,
    green_count,
    amber_count,
    red_count,
    cough_positive:   params.coughPositive  ? 1 : 0,
    referral_count:   params.referralIssued ? 1 : 0,
    fever_flag:       0,
    // alert_level intentionally omitted — server view computes it
    // village_name intentionally omitted
  };
}

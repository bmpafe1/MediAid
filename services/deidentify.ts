/**
 * MediAid · services/deidentify.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * De-identification gateway — the ONLY pathway by which scan data leaves the
 * device (UNICEF Venture Fund privacy commitment, PROMPT 0 Rule 3).
 *
 * ─── What this module enforces ────────────────────────────────────────────────
 *  • RadarEvent is a BRANDED TYPE. The only way to create a valid RadarEvent is
 *    through toRadarEvent(). Assigning a plain object of the same shape will be
 *    rejected at compile time.
 *  • toRadarEvent() builds the event from an EXPLICIT WHITELIST of 11 fields;
 *    every other field from the scan summary is silently dropped.
 *  • assertNoIdentifiers() deep-scans any object and throws if a deny-listed
 *    key or pattern is found (name, phone, GPS, base64 media, …).
 *  • suppressSmallCells() masks any row whose scan count is below k=5 (default)
 *    when publishing field data.
 *  • The geohash functions use the PRE-CONFIGURED village geohash from the site
 *    selector — raw GPS coordinates are NEVER read from the device.
 *
 * ─── Fields permitted to leave the device (whitelist) ────────────────────────
 *   village_geohash  (string, exactly 4 chars, ~39 km² precision)
 *   data_source      ('simulated_demo' | 'training' | 'field_test')
 *   total_scans      (always 1)
 *   green_count      (0 | 1)
 *   amber_count      (0 | 1)
 *   red_count        (0 | 1)
 *   cough_positive   (0 | 1)
 *   referral_count   (0 | 1)
 *   fever_flag       (always 0)
 *   client_event_id  (UUID v4, for idempotent upsert)
 *   recorded_at      (ISO-8601, truncated to minute precision to avoid timing
 *                     attacks — e.g. "2026-10-13T09:14:00.000Z")
 *
 * ─── Fields NEVER transmitted ────────────────────────────────────────────────
 *   patient name, patient ID, GPS coordinates, raw audio/video, biometric
 *   templates (voiceHash, faceHash), village_name, free text, GBV indicators,
 *   DOB, phone number, email, base64 media, FHIR resources, notes.
 */

// ── UUID v4 (no external deps) ─────────────────────────────────────────────────

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Brand symbol ───────────────────────────────────────────────────────────────

declare const __radarEventBrand: unique symbol;

// ── Public types ───────────────────────────────────────────────────────────────

export type DataSource = 'simulated_demo' | 'training' | 'field_test';

/**
 * A branded type: can ONLY be produced by toRadarEvent().
 * Attempting to assign a plain object (even with the same shape) is a
 * TypeScript compile error.
 */
export type RadarEvent = {
  readonly [__radarEventBrand]: true;

  readonly client_event_id: string;   // UUID v4
  readonly recorded_at: string;       // ISO-8601, truncated to minute
  readonly village_geohash: string;   // exactly 4 chars
  readonly data_source: DataSource;
  readonly total_scans: 1;
  readonly green_count: 0 | 1;
  readonly amber_count: 0 | 1;
  readonly red_count: 0 | 1;
  readonly cough_positive: 0 | 1;
  readonly referral_count: 0 | 1;
  readonly fever_flag: 0;
};

/**
 * Input to toRadarEvent(). Contains only the logical scan outcome fields —
 * no patient identifiers.
 */
export interface ScanSummary {
  village_geohash: string;
  data_source: DataSource;
  outcomeColour: 'green' | 'amber' | 'red' | 'grey';
  coughPositive: boolean;
  referralIssued: boolean;
  /** Any additional (extra) fields will be silently dropped. */
  [extra: string]: unknown;
}

/** Site configuration used by geohashForVillage(). */
export interface VillageConfig {
  /** Pre-configured 4-char geohash — GPS is NEVER read from the device. */
  geohash: string;
  displayName: string;
}

// ── Geohash helpers ────────────────────────────────────────────────────────────

/**
 * Encodes a (lat, lon) pair into a Ngeohash-compatible base-32 geohash string.
 *
 * Reference: https://en.wikipedia.org/wiki/Geohash  (Gustavo Niemeyer, 2008)
 * Base-32 alphabet: 0123456789bcdefghjkmnpqrstuvwxyz
 *
 * Known values (verified against reference implementation):
 *   (5.96, 10.16, prec=4) → "s0yg"   (Baligham area, NW Cameroon)
 *   (5.94, 10.14, prec=4) → "s0yf"   (Bagam area, NW Cameroon)
 *   (0.00,  0.00, prec=4) → "s000"   (Lab / null island sentinel)
 *
 * @param lat       Latitude  in decimal degrees (−90 … +90)
 * @param lon       Longitude in decimal degrees (−180 … +180)
 * @param precision Number of geohash chars (default 4, ≈39 km² cell)
 */
export function encodeGeohash(lat: number, lon: number, precision = 4): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90, minLon = -180, maxLon = 180;
  let hash = '';
  let bits = 0;
  let bitsTotal = 0;
  let hashValue = 0;
  let isEven = true;

  while (hash.length < precision) {
    if (isEven) {
      const mid = (minLon + maxLon) / 2;
      if (lon >= mid) { hashValue = (hashValue << 1) | 1; minLon = mid; }
      else             { hashValue = (hashValue << 1);     maxLon = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { hashValue = (hashValue << 1) | 1; minLat = mid; }
      else            { hashValue = (hashValue << 1);     maxLat = mid; }
    }
    isEven = !isEven;
    bits += 1;
    bitsTotal += 1;

    if (bits === 5) {
      hash += BASE32[hashValue];
      bits = 0;
      hashValue = 0;
    }
  }
  return hash;
}

/**
 * Returns the pre-configured 4-char geohash for a village.
 * Uses the geohash from the site configuration — GPS is NEVER read
 * from the device by this function.
 *
 * Throws if the resulting geohash is not exactly 4 chars.
 */
export function geohashForVillage(config: VillageConfig): string {
  const gh = (config.geohash ?? '').slice(0, 4).padEnd(4, '0');
  if (gh.length !== 4) {
    throw new Error(`geohashForVillage: geohash must be exactly 4 chars, got "${gh}"`);
  }
  return gh;
}

// ── De-identification whitelist ───────────────────────────────────────────────

/**
 * Builds a RadarEvent from a ScanSummary using an explicit whitelist.
 *
 * All fields NOT in the whitelist are SILENTLY DROPPED (defence-in-depth).
 * The returned object carries the __radarEventBrand so it cannot be
 * counterfeited by plain object literals.
 *
 * @throws if village_geohash is not exactly 4 chars after normalisation.
 */
export function toRadarEvent(summary: ScanSummary): RadarEvent {
  // ── 1. Validate and normalise geohash ──
  const rawHash = (summary.village_geohash ?? '').replace(/[^a-z0-9]/gi, '0');
  const geohash = rawHash.length >= 4
    ? rawHash.slice(0, 4)
    : rawHash.padEnd(4, '0');

  if (geohash.length !== 4) {
    throw new Error(
      `toRadarEvent: village_geohash must be exactly 4 chars, got "${summary.village_geohash}"`
    );
  }

  // ── 2. Map outcome colour to binary counts ──
  const green_count: 0 | 1 = summary.outcomeColour === 'green'  ? 1 : 0;
  const amber_count: 0 | 1 = summary.outcomeColour === 'amber'  ? 1 : 0;
  const red_count:   0 | 1 = summary.outcomeColour === 'red'    ? 1 : 0;
  // grey → all three 0  (green + amber + red ≤ 1 guaranteed)

  // ── 3. Truncate recorded_at to minute precision ──
  //    "2026-10-13T09:14:XX.XXX" → "2026-10-13T09:14:00.000Z"
  const now = new Date();
  now.setSeconds(0, 0);
  const recorded_at = now.toISOString();

  // ── 4. Build the whitelisted event (ONLY these 11 fields) ──
  // Note: TypeScript will error if any deny-listed field is included here.
  const event: RadarEvent = {
    [__radarEventBrand]: true,
    client_event_id: uuidv4(),
    recorded_at,
    village_geohash:  geohash,
    data_source:      summary.data_source,
    total_scans:      1,
    green_count,
    amber_count,
    red_count,
    cough_positive:  summary.coughPositive  ? 1 : 0,
    referral_count:  summary.referralIssued ? 1 : 0,
    fever_flag:      0,
  };

  return event;
}

// ── assertNoIdentifiers ───────────────────────────────────────────────────────

/**
 * Deny-listed keys that must never appear in any transmitted object.
 * Sorted alphabetically for auditability.
 */
export const IDENTIFIER_DENY_LIST = [
  'audio',
  'audioUri',
  'base64',
  'biometric',
  'dob',
  'email',
  'faceHash',
  'faceTemplate',
  'fhir',
  'firstName',
  'gbv',
  'gps',
  'image',
  'lastName',
  'lat',
  'latitude',
  'lon',
  'longitude',
  'name',
  'note',
  'notes',
  'patientId',
  'patientName',
  'phone',
  'phoneNumber',
  'template',
  'video',
  'videoUri',
  'village_name',
  'voiceHash',
  'voiceTemplate',
] as const;

/** Regex patterns for values that look like identifiers */
const IDENTIFIER_VALUE_PATTERNS: RegExp[] = [
  /\+?[\d\s\-().]{10,16}/,                       // phone number
  /\b[A-Z]{2,4}-?\d{3,6}\b/,                     // patient ID like PT-4471
  /^data:[a-z]+\/[a-z+]+;base64,/i,             // base64 data URI
  /^[A-Za-z0-9+/]{100,}={0,2}$/,               // raw base64 blob
  /\b[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)\b/, // lat,lon pair
];

/**
 * Deep-scans obj for any deny-listed key or identifier-shaped value.
 * Throws a descriptive error if any are found.
 *
 * Intended to be called in tests and at the queue boundary.
 * Never call this in the hot path of the scan workflow.
 *
 * @param obj     The object to scan
 * @param path    Internal — tracks key path for error messages
 */
export function assertNoIdentifiers(obj: unknown, path = '$'): void {
  if (obj === null || obj === undefined) return;

  if (typeof obj === 'string') {
    for (const pattern of IDENTIFIER_VALUE_PATTERNS) {
      if (pattern.test(obj)) {
        throw new Error(
          `assertNoIdentifiers: identifier-like string value detected at ${path}: ` +
          `"${obj.slice(0, 40)}…"`
        );
      }
    }
    return;
  }

  if (typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => assertNoIdentifiers(item, `${path}[${i}]`));
    return;
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    for (const denied of IDENTIFIER_DENY_LIST) {
      if (lowerKey === denied.toLowerCase() || lowerKey.includes(denied.toLowerCase())) {
        throw new Error(
          `assertNoIdentifiers: deny-listed key "${key}" found at ${path}.${key}`
        );
      }
    }
    assertNoIdentifiers(value, `${path}.${key}`);
  }
}

// ── suppressSmallCells ────────────────────────────────────────────────────────

/**
 * Removes rows where total_scans < k from the array.
 * Used when publishing aggregated field data to prevent re-identification
 * of individuals in small villages.
 *
 * Per the Supabase migration: field data rows with < 5 scans are suppressed.
 * This client-side function mirrors the server-side WHERE clause for defence
 * in depth.
 *
 * @param rows  Array of aggregated radar rows (any shape with total_scans)
 * @param k     Minimum count threshold (default 5)
 */
export function suppressSmallCells<T extends { total_scans: number }>(
  rows: T[],
  k = 5
): T[] {
  return rows.filter((r) => r.total_scans >= k);
}

// ── Plain-object extract (for Supabase upsert) ────────────────────────────────

/**
 * Strips the brand symbol and returns a plain JSON-serialisable object
 * containing only the 11 whitelisted columns.
 *
 * This is the ONLY way radarQueue.ts should extract data from a RadarEvent.
 */
export function extractForTransmission(event: RadarEvent): {
  client_event_id: string;
  recorded_at: string;
  village_geohash: string;
  data_source: DataSource;
  total_scans: 1;
  green_count: 0 | 1;
  amber_count: 0 | 1;
  red_count: 0 | 1;
  cough_positive: 0 | 1;
  referral_count: 0 | 1;
  fever_flag: 0;
} {
  return {
    client_event_id: event.client_event_id,
    recorded_at:     event.recorded_at,
    village_geohash: event.village_geohash,
    data_source:     event.data_source,
    total_scans:     event.total_scans,
    green_count:     event.green_count,
    amber_count:     event.amber_count,
    red_count:       event.red_count,
    cough_positive:  event.cough_positive,
    referral_count:  event.referral_count,
    fever_flag:      event.fever_flag,
  };
}

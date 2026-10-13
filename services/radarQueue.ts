/**
 * MediAid · services/radarQueue.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Offline-first radar event queue.
 *
 * - enqueue(): appends a RadarEvent to AsyncStorage (cap 500).
 * - flush():   uploads queued events to Supabase in batches of 50,
 *              with idempotent ON CONFLICT handling and exponential backoff.
 * - pendingCount(), lastSyncAt(), lastError() — readable by the Sync screen.
 *
 * NEVER throws — all errors are caught, logged internally, and surfaced
 * via lastError() so the UI can display them without crashing.
 *
 * Data sent per event: only the whitelisted fields from services/deidentify.ts
 * (geohash, source, counts). No names, IDs, GPS, audio, biometrics.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSharedSupabaseClient } from '@/template/core';
import type { RadarEvent } from './deidentify';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_KEY     = 'radar_queue_v1';
const META_KEY      = 'radar_queue_meta_v1';
const MAX_QUEUE     = 500;
const BATCH_SIZE    = 50;
const TABLE_NAME    = 'outbreak_radar';

/** Backoff schedule in milliseconds: 30s, 2min, 10min, 1h */
const BACKOFF_MS    = [30_000, 120_000, 600_000, 3_600_000];

// ---------------------------------------------------------------------------
// Internal meta state (lightweight, persisted)
// ---------------------------------------------------------------------------

interface QueueMeta {
  lastSyncAt:    string | null;  // ISO-8601
  lastError:     string | null;
  failureCount:  number;         // consecutive failures since last success
  nextRetryAt:   string | null;  // ISO-8601 — do not flush before this
}

let _meta: QueueMeta = {
  lastSyncAt:   null,
  lastError:    null,
  failureCount: 0,
  nextRetryAt:  null,
};

let _flushing = false;

async function loadMeta(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (raw) _meta = { ..._meta, ...JSON.parse(raw) };
  } catch {
    // First run or corrupted — proceed with defaults
  }
}

async function saveMeta(): Promise<void> {
  try {
    await AsyncStorage.setItem(META_KEY, JSON.stringify(_meta));
  } catch {
    // Non-fatal — meta will be re-derived next run
  }
}

// ---------------------------------------------------------------------------
// Queue read/write helpers
// ---------------------------------------------------------------------------

async function readQueue(): Promise<RadarEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(events: RadarEvent[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(events));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Appends a RadarEvent to the local queue.
 * If the queue is already at 500 events, the oldest events are dropped
 * (with a console warning) to prevent unbounded growth.
 *
 * Never throws.
 */
export async function enqueue(event: RadarEvent): Promise<void> {
  try {
    const queue = await readQueue();
    if (queue.length >= MAX_QUEUE) {
      const dropped = queue.length - MAX_QUEUE + 1;
      console.warn(
        `[radarQueue] Queue cap reached (${MAX_QUEUE}). Dropping ${dropped} oldest event(s).`
      );
      queue.splice(0, dropped);
    }
    queue.push(event);
    await writeQueue(queue);
  } catch (err) {
    console.error('[radarQueue] enqueue error:', err);
  }
}

/**
 * Flushes queued events to Supabase.
 *
 * - Skips if a flush is already in progress.
 * - Skips if the backoff timer has not elapsed.
 * - Sends up to BATCH_SIZE events per call.
 * - Uses upsert with ignoreDuplicates=true so retries are safe.
 * - On success: removes accepted events from the queue, resets failure count.
 * - On failure: keeps events in the queue, applies exponential backoff.
 *
 * Never throws.
 */
export async function flush(): Promise<void> {
  if (_flushing) return;

  await loadMeta();

  // Respect backoff timer
  if (_meta.nextRetryAt && new Date(_meta.nextRetryAt) > new Date()) {
    return;
  }

  const queue = await readQueue();
  if (queue.length === 0) return;

  _flushing = true;

  try {
    // Get Supabase client — may throw if env vars are missing
    let client;
    try {
      client = getSharedSupabaseClient();
    } catch (configErr) {
      _meta.lastError = `Supabase not configured: ${String(configErr)}`;
      _meta.failureCount += 1;
      _meta.nextRetryAt = computeNextRetry(_meta.failureCount);
      await saveMeta();
      return;
    }

    // Take a batch
    const batch = queue.slice(0, BATCH_SIZE);

    // Strip any extra fields — only send whitelisted columns
    const rows = batch.map(sanitiseForTransmission);

    const { error } = await client
      .from(TABLE_NAME)
      .upsert(rows, {
        onConflict: 'client_event_id',
        ignoreDuplicates: true,
      });

    if (error) {
      _meta.lastError = error.message ?? 'Unknown Supabase error';
      _meta.failureCount += 1;
      _meta.nextRetryAt = computeNextRetry(_meta.failureCount);
      await saveMeta();
      return;
    }

    // Success — remove the batch from the queue
    const remaining = queue.slice(batch.length);
    await writeQueue(remaining);

    _meta.lastSyncAt   = new Date().toISOString();
    _meta.lastError    = null;
    _meta.failureCount = 0;
    _meta.nextRetryAt  = null;
    await saveMeta();
  } catch (err) {
    _meta.lastError    = String(err);
    _meta.failureCount += 1;
    _meta.nextRetryAt  = computeNextRetry(_meta.failureCount);
    await saveMeta();
  } finally {
    _flushing = false;
  }
}

/** Number of events currently queued locally. */
export async function pendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

/** ISO-8601 timestamp of the last successful flush, or null. */
export async function lastSyncAt(): Promise<string | null> {
  await loadMeta();
  return _meta.lastSyncAt;
}

/** Most recent error message, or null if the last flush succeeded. */
export async function lastError(): Promise<string | null> {
  await loadMeta();
  return _meta.lastError;
}

/** Read the last N queued events (for the debug panel). */
export async function peekQueue(n: number = 10): Promise<RadarEvent[]> {
  const queue = await readQueue();
  return queue.slice(-n).reverse(); // most recent first
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Whitelist exactly the columns the Supabase table accepts.
 * This is a defence-in-depth measure — toRadarEvent() already
 * ensures no identifying fields are present, but we re-strip here
 * so any future code paths that call flush() with extra fields
 * are safe-by-default.
 */
function sanitiseForTransmission(event: RadarEvent): Record<string, unknown> {
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
    // alert_level omitted — server view computes it
    // village_name omitted — never transmitted
  };
}

function computeNextRetry(failureCount: number): string {
  const idx = Math.min(failureCount - 1, BACKOFF_MS.length - 1);
  return new Date(Date.now() + BACKOFF_MS[idx]).toISOString();
}

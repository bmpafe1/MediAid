/**
 * MediAid · services/radarQueue.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Offline-first radar event queue.
 *
 * ─── ONLY this file may import @supabase/supabase-js (or call the Supabase
 *     URL via fetch). The ESLint no-restricted-imports rule in eslint.config.js
 *     and the companion Jest test (services/__tests__/supabaseImport.test.ts)
 *     enforce this property across the entire source tree.
 *
 * ─── Data policy ──────────────────────────────────────────────────────────────
 *   Only RadarEvent objects produced by toRadarEvent() are accepted.
 *   extractForTransmission() strips the brand and returns plain JSON before
 *   sending — no extra fields can ever reach the wire.
 *
 * ─── Behaviour ────────────────────────────────────────────────────────────────
 *   enqueue(): appends a RadarEvent to AsyncStorage (cap 500).
 *   flush():   uploads queued events to Supabase in batches of 50 with
 *              idempotent ON CONFLICT and exponential backoff (30s → 2m → 10m → 1h).
 *   pendingCount(), lastSyncAt(), lastError() — consumed by the Sync screen.
 *   Never throws — all errors are caught and surfaced via lastError().
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSharedSupabaseClient } from '@/template/core';
import type { RadarEvent } from './deidentify';
import { extractForTransmission } from './deidentify';

// ── Constants ──────────────────────────────────────────────────────────────────

const QUEUE_KEY  = 'radar_queue_v1';
const META_KEY   = 'radar_queue_meta_v1';
const MAX_QUEUE  = 500;
const BATCH_SIZE = 50;
const TABLE_NAME = 'outbreak_radar';

/** Backoff schedule in milliseconds: 30s, 2min, 10min, 1h */
const BACKOFF_MS = [30_000, 120_000, 600_000, 3_600_000];

// ── Internal meta ──────────────────────────────────────────────────────────────

interface QueueMeta {
  lastSyncAt:   string | null; // ISO-8601
  lastError:    string | null;
  failureCount: number;
  nextRetryAt:  string | null; // ISO-8601
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
    // First run or corrupted — defaults are safe
  }
}

async function saveMeta(): Promise<void> {
  try {
    await AsyncStorage.setItem(META_KEY, JSON.stringify(_meta));
  } catch { /* non-fatal */ }
}

// ── Queue read / write ─────────────────────────────────────────────────────────

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

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Appends a RadarEvent (branded — only produceable via toRadarEvent()) to the
 * local AsyncStorage queue. If the queue has reached 500 events, the oldest
 * events are dropped to prevent unbounded growth.
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
 * - Sends up to 50 events per call using extractForTransmission() to strip
 *   the brand symbol and ensure only the 11 whitelisted columns are sent.
 * - On success: removes accepted events from the queue, resets failure count.
 * - On failure: keeps events, applies exponential backoff.
 *
 * Never throws.
 */
export async function flush(): Promise<void> {
  if (_flushing) return;

  await loadMeta();

  if (_meta.nextRetryAt && new Date(_meta.nextRetryAt) > new Date()) return;

  const queue = await readQueue();
  if (queue.length === 0) return;

  _flushing = true;

  try {
    let client: ReturnType<typeof getSharedSupabaseClient>;
    try {
      client = getSharedSupabaseClient();
    } catch (configErr) {
      _meta.lastError    = `Supabase not configured: ${String(configErr)}`;
      _meta.failureCount += 1;
      _meta.nextRetryAt  = computeNextRetry(_meta.failureCount);
      await saveMeta();
      return;
    }

    const batch = queue.slice(0, BATCH_SIZE);

    // extractForTransmission() strips the brand and returns exactly the 11
    // whitelisted columns — no extra fields can reach the wire.
    const rows = batch.map(extractForTransmission);

    const { error } = await client
      .from(TABLE_NAME)
      .upsert(rows, { onConflict: 'client_event_id', ignoreDuplicates: true });

    if (error) {
      _meta.lastError    = error.message ?? 'Unknown Supabase error';
      _meta.failureCount += 1;
      _meta.nextRetryAt  = computeNextRetry(_meta.failureCount);
      await saveMeta();
      return;
    }

    await writeQueue(queue.slice(batch.length));
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
  return (await readQueue()).length;
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
export async function peekQueue(n = 10): Promise<RadarEvent[]> {
  const queue = await readQueue();
  return queue.slice(-n).reverse();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeNextRetry(failureCount: number): string {
  const idx = Math.min(failureCount - 1, BACKOFF_MS.length - 1);
  return new Date(Date.now() + BACKOFF_MS[idx]).toISOString();
}

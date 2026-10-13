/**
 * MediAid · services/radarRead.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Reads the public view outbreak_radar_7d from Supabase (anon key, SELECT only).
 * Caches the last successful result in AsyncStorage ("radar_cache_v1").
 *
 * Usage:
 *   const { rows, cacheAgeMs, fromCache, error } = await fetchRadar7d();
 *
 * Privacy:
 *   The view only exposes aggregated, geohash-bucketed counts.
 *   No patient-identifying data is ever returned.
 *
 * Never throws — all errors are returned in the error field so the UI
 * can surface them without crashing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSharedSupabaseClient } from '@/template/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_KEY    = 'radar_cache_v1';
const VIEW_NAME    = 'outbreak_radar_7d';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single row from the outbreak_radar_7d view. */
export interface RadarRow {
  village_geohash:  string;
  data_source:      string;
  total_scans:      number;
  green_count:      number;
  amber_count:      number;
  red_count:        number;
  cough_positive:   number;
  referral_count:   number;
  last_recorded_at: string; // ISO-8601
  alert_level:      'OUTBREAK' | 'ELEVATED' | 'NORMAL';
}

export interface FetchResult {
  rows:        RadarRow[];
  fromCache:   boolean;
  cacheAgeMs:  number | null; // null when data is fresh from server
  error:       string | null;
}

interface CacheEntry {
  rows:      RadarRow[];
  fetchedAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readCache(): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeCache(rows: RadarRow[]): Promise<void> {
  try {
    const entry: CacheEntry = { rows, fetchedAt: new Date().toISOString() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches the last-7-day aggregated outbreak radar rows from Supabase.
 *
 * Order guarantee: OUTBREAK rows come first (sorted server-side via
 * ORDER BY alert_level DESC in the view; if not, we sort client-side).
 *
 * On failure: returns cached rows (if any) with fromCache=true and the
 * error message so the UI can show "cached" + "retry" UI.
 */
export async function fetchRadar7d(): Promise<FetchResult> {
  // Try live fetch first
  let client;
  try {
    client = getSharedSupabaseClient();
  } catch (configErr) {
    // Supabase not configured — fall back to cache immediately
    const cache = await readCache();
    return {
      rows:       cache?.rows ?? [],
      fromCache:  true,
      cacheAgeMs: cache ? Date.now() - new Date(cache.fetchedAt).getTime() : null,
      error:      `Supabase not configured: ${String(configErr)}`,
    };
  }

  try {
    const { data, error } = await client
      .from(VIEW_NAME)
      .select(
        'village_geohash, data_source, total_scans, green_count, amber_count, ' +
        'red_count, cough_positive, referral_count, last_recorded_at, alert_level'
      )
      .order('alert_level', { ascending: false }) // OUTBREAK > ELEVATED > NORMAL
      .order('total_scans', { ascending: false });

    if (error) {
      const cache = await readCache();
      return {
        rows:       cache?.rows ?? [],
        fromCache:  true,
        cacheAgeMs: cache ? Date.now() - new Date(cache.fetchedAt).getTime() : null,
        error:      error.message ?? 'Supabase query error',
      };
    }

    const rows = (data as RadarRow[]) ?? [];

    // Client-side sort fallback: OUTBREAK > ELEVATED > NORMAL
    rows.sort((a, b) => {
      const rank = { OUTBREAK: 3, ELEVATED: 2, NORMAL: 1 };
      return (rank[b.alert_level] ?? 0) - (rank[a.alert_level] ?? 0);
    });

    await writeCache(rows);

    return { rows, fromCache: false, cacheAgeMs: null, error: null };
  } catch (err) {
    const cache = await readCache();
    return {
      rows:       cache?.rows ?? [],
      fromCache:  true,
      cacheAgeMs: cache ? Date.now() - new Date(cache.fetchedAt).getTime() : null,
      error:      String(err),
    };
  }
}

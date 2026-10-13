/**
 * MediAid · services/radarQueue.test.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Tests for the offline radar event queue (services/radarQueue.ts).
 *
 * Coverage targets (PROMPT 8):
 *   • Offline → events queued locally (pendingCount increases)
 *   • Online  → events flushed to Supabase (pendingCount drops to 0)
 *   • Retries — backoff prevents repeated calls within window
 *   • No duplicates — idempotent upsert (client_event_id unique constraint)
 *   • Cap 500 — enqueueing past 500 drops oldest events
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Mock @supabase/supabase-js via template/core ──────────────────────────────

// We need to mock the Supabase client returned by getSharedSupabaseClient().
// radarQueue imports it from @/template/core.

let mockUpsertError: { message: string } | null = null;

const mockSupabaseClient = {
  from: (_table: string) => ({
    upsert: async (_rows: unknown[]) => {
      if (mockUpsertError) {
        return { data: null, error: mockUpsertError };
      }
      return { data: [], error: null };
    },
  }),
};

jest.mock('@/template/core', () => ({
  getSharedSupabaseClient: () => mockSupabaseClient,
}));

// ── Import after mocking ───────────────────────────────────────────────────────

import {
  enqueue,
  flush,
  pendingCount,
  lastSyncAt,
  lastError,
  peekQueue,
} from './radarQueue';

import { toRadarEvent } from './deidentify';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<{
  outcomeColour: 'green' | 'amber' | 'red' | 'grey';
  coughPositive: boolean;
  referralIssued: boolean;
  sessionType: string;
}> = {}) {
  return toRadarEvent({
    village_geohash: overrides.sessionType === 'lab' ? 's000' : 's0yg',
    data_source:     'field_test',
    outcomeColour:   overrides.outcomeColour ?? 'green',
    coughPositive:   overrides.coughPositive ?? false,
    referralIssued:  overrides.referralIssued ?? false,
  });
}

// Reset AsyncStorage and internal queue state between tests
beforeEach(async () => {
  await AsyncStorage.clear();
  mockUpsertError = null;
  // Force-reset the internal module state by re-importing fresh
  // (Jest module isolation handles this with jest.resetModules if needed,
  //  but clearing AsyncStorage is sufficient here because loadMeta() re-reads)
});

// ── Offline: events queued locally ────────────────────────────────────────────

describe('Offline — events queued locally', () => {
  test('pendingCount starts at 0', async () => {
    expect(await pendingCount()).toBe(0);
  });

  test('enqueue() increments pendingCount', async () => {
    await enqueue(makeEvent());
    expect(await pendingCount()).toBe(1);
  });

  test('three enqueues → pendingCount = 3', async () => {
    await enqueue(makeEvent({ outcomeColour: 'green' }));
    await enqueue(makeEvent({ outcomeColour: 'amber' }));
    await enqueue(makeEvent({ outcomeColour: 'red' }));
    expect(await pendingCount()).toBe(3);
  });

  test('peekQueue() returns events in reverse-insertion order', async () => {
    await enqueue(makeEvent({ outcomeColour: 'green' }));
    await enqueue(makeEvent({ outcomeColour: 'red' }));
    const events = await peekQueue(2);
    expect(events).toHaveLength(2);
    // Last enqueued comes first in peek
    expect(events[0].red_count).toBe(1); // red
    expect(events[1].red_count).toBe(0); // green
  });

  test('enqueue() never throws even with invalid AsyncStorage', async () => {
    // Simulate storage failure
    const original = AsyncStorage.getItem;
    (AsyncStorage as any).getItem = jest.fn().mockRejectedValue(new Error('Storage error'));
    await expect(enqueue(makeEvent())).resolves.not.toThrow();
    (AsyncStorage as any).getItem = original;
  });
});

// ── Online: flush clears the queue ───────────────────────────────────────────

describe('Online — flush clears the queue', () => {
  test('flush() sends events and clears queue', async () => {
    await enqueue(makeEvent());
    await enqueue(makeEvent());
    await enqueue(makeEvent());
    expect(await pendingCount()).toBe(3);

    await flush();

    expect(await pendingCount()).toBe(0);
    expect(await lastError()).toBeNull();
    expect(await lastSyncAt()).not.toBeNull();
  });

  test('flush() on empty queue is a no-op (does not crash)', async () => {
    await expect(flush()).resolves.not.toThrow();
    expect(await pendingCount()).toBe(0);
  });

  test('lastSyncAt() is set after successful flush', async () => {
    await enqueue(makeEvent());
    expect(await lastSyncAt()).toBeNull();
    await flush();
    const ts = await lastSyncAt();
    expect(ts).not.toBeNull();
    expect(new Date(ts!).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

// ── Retry / backoff ───────────────────────────────────────────────────────────

describe('Retry — backoff prevents repeated calls', () => {
  test('flush() on server error sets lastError', async () => {
    mockUpsertError = { message: 'network error' };
    await enqueue(makeEvent());
    await flush();
    expect(await lastError()).toBe('network error');
  });

  test('flush() honours backoff window (second call skipped)', async () => {
    mockUpsertError = { message: 'server down' };
    await enqueue(makeEvent());
    await flush(); // sets nextRetryAt 30s in the future

    // Clear the error simulation — if the second flush runs it would succeed
    mockUpsertError = null;
    await flush(); // should be skipped because nextRetryAt is in the future

    // Queue should still have 1 event (not flushed due to backoff)
    expect(await pendingCount()).toBe(1);
  });

  test('failed flush keeps events in queue (no data loss)', async () => {
    mockUpsertError = { message: 'timeout' };
    await enqueue(makeEvent());
    await flush();
    expect(await pendingCount()).toBe(1);
  });
});

// ── No duplicates ─────────────────────────────────────────────────────────────

describe('No duplicates — client_event_id uniqueness', () => {
  test('Each enqueued event has a unique client_event_id', async () => {
    const ev1 = makeEvent();
    const ev2 = makeEvent();
    const ev3 = makeEvent();
    expect(ev1.client_event_id).not.toBe(ev2.client_event_id);
    expect(ev2.client_event_id).not.toBe(ev3.client_event_id);
  });

  test('client_event_id is a UUID-v4-shaped string', () => {
    const ev = makeEvent();
    // UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(ev.client_event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test('flush() calls upsert with ignoreDuplicates:true (no double-insert)', async () => {
    const upsertSpy = jest.fn().mockResolvedValue({ data: [], error: null });
    (mockSupabaseClient as any).from = (_table: string) => ({ upsert: upsertSpy });

    await enqueue(makeEvent());
    await flush();

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const [_rows, options] = upsertSpy.mock.calls[0];
    expect(options).toMatchObject({ onConflict: 'client_event_id', ignoreDuplicates: true });

    // Restore
    (mockSupabaseClient as any).from = (_table: string) => ({
      upsert: async () => ({ data: [], error: null }),
    });
  });
});

// ── Queue cap ─────────────────────────────────────────────────────────────────

describe('Queue cap — drops oldest beyond 500', () => {
  test('enqueueing 501 events keeps only 500', async () => {
    for (let i = 0; i < 501; i++) {
      await enqueue(makeEvent());
    }
    // Cap is 500
    expect(await pendingCount()).toBe(500);
  }, 30_000); // allow extra time for 501 async operations

  test('oldest events are dropped when cap exceeded', async () => {
    // Enqueue a sentinel "first" event
    const first = makeEvent({ outcomeColour: 'red' });
    await enqueue(first);

    // Fill up to cap with green events
    for (let i = 0; i < 500; i++) {
      await enqueue(makeEvent({ outcomeColour: 'green' }));
    }

    const events = await peekQueue(500);
    const firstEventPresent = events.some(
      (e) => e.client_event_id === first.client_event_id,
    );
    // The first (red) event was dropped because 500 greens pushed it out
    expect(firstEventPresent).toBe(false);
    expect(await pendingCount()).toBe(500);
  }, 30_000);
});

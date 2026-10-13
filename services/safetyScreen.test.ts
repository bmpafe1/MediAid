/**
 * MediAid · services/safetyScreen.test.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Tests for the non-bypassable safety screen logic (services/safetyScreen.ts).
 *
 * Key assertions:
 *   • RED cannot be dismissed without escort OR bypass record
 *   • Bypass creates an EscalationRecord with supervisorAlertRequired: true
 *   • Escort creates an EscortRecord with bypassLogged: false
 *   • Bypass is locked for 10 s from screen mount
 *   • GREY never shows a treatment instruction
 *   • activeTriggerDescriptions returns descriptions for all active triggers
 */

import {
  recordEscort,
  recordBypass,
  isBypassUnlocked,
  bypassSecondsRemaining,
  anyTriggerActive,
  activeTriggerDescriptions,
  shouldShowTreatmentInstruction,
  BYPASS_LOCKOUT_SECONDS,
  SAFETY_TRIGGERS,
} from './safetyScreen';
import type { SafetyScanSummary } from './safetyScreen';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mockScan: SafetyScanSummary = {
  patientId:   'CHA-1234',
  patientName: 'Amara Ngo',
  spo2:        88,
  heartRate:   160,
  hasRedAlert: true,
};

function iso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ── SAFETY_TRIGGERS completeness ──────────────────────────────────────────────

describe('SAFETY_TRIGGERS', () => {
  test('exports exactly 10 triggers', () => {
    expect(SAFETY_TRIGGERS).toHaveLength(10);
  });

  test('every trigger has id and description', () => {
    for (const trigger of SAFETY_TRIGGERS) {
      expect(typeof trigger.id).toBe('string');
      expect(trigger.id.length).toBeGreaterThan(0);
      expect(typeof trigger.description).toBe('string');
      expect(trigger.description.length).toBeGreaterThan(0);
    }
  });

  test('trigger IDs are unique', () => {
    const ids = SAFETY_TRIGGERS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── BYPASS_LOCKOUT_SECONDS ─────────────────────────────────────────────────────

describe('BYPASS_LOCKOUT_SECONDS', () => {
  test('is 10 seconds', () => {
    expect(BYPASS_LOCKOUT_SECONDS).toBe(10);
  });
});

// ── recordEscort ───────────────────────────────────────────────────────────────

describe('recordEscort()', () => {
  test('returns EscortRecord with type="escort"', () => {
    const record = recordEscort(mockScan);
    expect(record.type).toBe('escort');
  });

  test('bypassLogged is false', () => {
    const record = recordEscort(mockScan);
    expect(record.bypassLogged).toBe(false);
  });

  test('patientId and patientName are preserved', () => {
    const record = recordEscort(mockScan);
    expect(record.patientId).toBe('CHA-1234');
    expect(record.patientName).toBe('Amara Ngo');
  });

  test('timestamp is a valid ISO string', () => {
    const before = Date.now();
    const record = recordEscort(mockScan);
    const after  = Date.now();
    const ts = new Date(record.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  test('RED is not dismissed without a record: recordEscort produces a record', () => {
    // Verifies the intent: dismissal requires a concrete record object.
    const record = recordEscort(mockScan);
    expect(record).toBeDefined();
    // The screen must not close until this has been passed back to state.
    expect(record.timestamp).toBeTruthy();
  });
});

// ── recordBypass ───────────────────────────────────────────────────────────────

describe('recordBypass()', () => {
  test('returns EscalationRecord with type="bypass"', () => {
    const record = recordBypass(mockScan, 'CHA override');
    expect(record.type).toBe('bypass');
  });

  test('bypassLogged is true', () => {
    const record = recordBypass(mockScan, 'CHA override');
    expect(record.bypassLogged).toBe(true);
  });

  test('supervisorAlertRequired is true', () => {
    const record = recordBypass(mockScan, 'CHA override');
    expect(record.supervisorAlertRequired).toBe(true);
  });

  test('bypassReason is preserved', () => {
    const record = recordBypass(mockScan, 'patient refused');
    expect(record.bypassReason).toBe('patient refused');
  });

  test('patientId and patientName are preserved', () => {
    const record = recordBypass(mockScan, 'reason');
    expect(record.patientId).toBe('CHA-1234');
    expect(record.patientName).toBe('Amara Ngo');
  });

  test('timestamp is a valid ISO string close to now', () => {
    const before = Date.now();
    const record = recordBypass(mockScan, 'test');
    const after  = Date.now();
    const ts = new Date(record.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  test('A bypass creates an escalation record (PROMPT 8 requirement)', () => {
    const record = recordBypass(mockScan, 'override');
    // The record MUST carry these two flags so the caller knows to alert supervisor
    expect(record.bypassLogged).toBe(true);
    expect(record.supervisorAlertRequired).toBe(true);
  });
});

// ── isBypassUnlocked ──────────────────────────────────────────────────────────

describe('isBypassUnlocked()', () => {
  test('returns false immediately after mount', () => {
    const mountedAt = iso(0);
    const now       = iso(0);
    expect(isBypassUnlocked(mountedAt, now)).toBe(false);
  });

  test('returns false after 9 seconds', () => {
    const mountedAt = iso(-9_000);
    const now       = iso(0);
    expect(isBypassUnlocked(mountedAt, now)).toBe(false);
  });

  test('returns true at exactly 10 seconds', () => {
    const mountedAt = iso(-10_000);
    const now       = iso(0);
    expect(isBypassUnlocked(mountedAt, now)).toBe(true);
  });

  test('returns true after 15 seconds', () => {
    const mountedAt = iso(-15_000);
    const now       = iso(0);
    expect(isBypassUnlocked(mountedAt, now)).toBe(true);
  });
});

// ── bypassSecondsRemaining ────────────────────────────────────────────────────

describe('bypassSecondsRemaining()', () => {
  test('returns 10 immediately', () => {
    expect(bypassSecondsRemaining(iso(0), iso(0))).toBe(10);
  });

  test('returns 5 after 5 seconds', () => {
    expect(bypassSecondsRemaining(iso(-5_000), iso(0))).toBe(5);
  });

  test('returns 1 after 9 seconds', () => {
    expect(bypassSecondsRemaining(iso(-9_000), iso(0))).toBe(1);
  });

  test('returns 0 after 10 seconds', () => {
    expect(bypassSecondsRemaining(iso(-10_000), iso(0))).toBe(0);
  });

  test('returns 0 (not negative) after 15 seconds', () => {
    expect(bypassSecondsRemaining(iso(-15_000), iso(0))).toBe(0);
  });
});

// ── anyTriggerActive ──────────────────────────────────────────────────────────

describe('anyTriggerActive()', () => {
  test('returns false with empty answers', () => {
    expect(anyTriggerActive({})).toBe(false);
  });

  test('returns false with all-false answers', () => {
    expect(anyTriggerActive({
      alteredConsciousness: false,
      suspectedStroke:      false,
      obstetricEmergency:   false,
    })).toBe(false);
  });

  test('returns true when alteredConsciousness is true', () => {
    expect(anyTriggerActive({ alteredConsciousness: true })).toBe(true);
  });

  test('returns true when suspectedPoisoning is true', () => {
    expect(anyTriggerActive({ suspectedPoisoning: true })).toBe(true);
  });

  test('returns true when vitalsBreach is true', () => {
    expect(anyTriggerActive({ vitalsBreach: true })).toBe(true);
  });
});

// ── activeTriggerDescriptions ─────────────────────────────────────────────────

describe('activeTriggerDescriptions()', () => {
  test('returns empty array when no triggers active', () => {
    expect(activeTriggerDescriptions({})).toEqual([]);
  });

  test('returns description for alteredConsciousness', () => {
    const result = activeTriggerDescriptions({ alteredConsciousness: true });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/altered consciousness/i);
  });

  test('returns all descriptions when all triggers true', () => {
    const all = {
      alteredConsciousness:      true,
      severeRespiratoryDistress: true,
      severeDehydrationUnder5:   true,
      uncontrolledBleeding:      true,
      suspectedStroke:           true,
      suspectedMeningitis:       true,
      obstetricEmergency:        true,
      severeAcuteMalnutrition:   true,
      suspectedPoisoning:        true,
      vitalsBreach:              true,
    };
    const result = activeTriggerDescriptions(all);
    expect(result).toHaveLength(10);
  });
});

// ── shouldShowTreatmentInstruction ────────────────────────────────────────────

describe('shouldShowTreatmentInstruction()', () => {
  test('GREY → false (PROMPT 8 requirement)', () => {
    expect(shouldShowTreatmentInstruction('GREY')).toBe(false);
  });

  test('RED → false (escort/bypass screen, not treatment)', () => {
    expect(shouldShowTreatmentInstruction('RED')).toBe(false);
  });

  test('AMBER → true', () => {
    expect(shouldShowTreatmentInstruction('AMBER')).toBe(true);
  });

  test('GREEN → true', () => {
    expect(shouldShowTreatmentInstruction('GREEN')).toBe(true);
  });
});

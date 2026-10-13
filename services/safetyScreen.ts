/**
 * MediAid · services/safetyScreen.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Pure business logic for the non-bypassable RED alert screen.
 * Extracted from app/safety.tsx so it can be unit-tested without React.
 *
 * UNICEF REQUIREMENTS (non-negotiable):
 *   1. The safety screen CANNOT be dismissed without an action.
 *   2. Escort confirmation → logs timestamp, no escalation record.
 *   3. Bypass confirmation → creates an EscalationRecord; supervisor is alerted.
 *   4. Bypass is locked for BYPASS_LOCKOUT_SECONDS (10s) from screen mount.
 *   5. GREY outcome → no treatment instructions are shown.
 *
 * The 10 triggers that drive RED (from services/triage.ts) are re-exported
 * here as MANDATORY_TRIGGERS for easy reference in tests.
 */

import { SAFETY_TRIGGERS, type SafetyAnswers } from './triage';

export { SAFETY_TRIGGERS };

// ── Constants ──────────────────────────────────────────────────────────────────

export const BYPASS_LOCKOUT_SECONDS = 10;

// ── Types ──────────────────────────────────────────────────────────────────────

export type SafetyAction = 'escort' | 'bypass' | 'none';

export interface EscortRecord {
  type: 'escort';
  patientId: string;
  patientName: string;
  timestamp: string;       // ISO-8601
  bypassLogged: false;
}

export interface EscalationRecord {
  type: 'bypass';
  patientId: string;
  patientName: string;
  timestamp: string;       // ISO-8601
  bypassLogged: true;
  bypassReason: string;
  /** Must be transmitted to supervisor (SMS / push). */
  supervisorAlertRequired: true;
}

export type ActionRecord = EscortRecord | EscalationRecord;

/**
 * Minimal scan data required by the safety screen logic.
 * Does NOT include raw audio, images or patient addresses.
 */
export interface SafetyScanSummary {
  patientId:   string;
  patientName: string;
  spo2:        number;
  heartRate:   number;
  hasRedAlert: boolean;
}

// ── Core functions ─────────────────────────────────────────────────────────────

/**
 * Build a list of human-readable RED metric alerts from a scan summary.
 * Used by the safety screen to display which metrics triggered the alert.
 * Mirrors the logic in app/safety.tsx redMetrics computation.
 */
export function buildRedMetricAlerts(scan: SafetyScanSummary): string[] {
  const alerts: string[] = [];
  if (scan.spo2 <= 90) {
    alerts.push(`SpO₂: ${scan.spo2}% (critical hypoxia — threshold ≤90%)`);
  }
  if (scan.heartRate < 40 || scan.heartRate > 150) {
    alerts.push(`Heart Rate: ${scan.heartRate} BPM (critical — threshold <40 or >150)`);
  }
  return alerts;
}

/**
 * Record an escort confirmation.
 *
 * An escort record is created and returned. No escalation is fired.
 * The calling UI MUST update the scan history with bypassLogged: false.
 *
 * @param scan  The scan that triggered the RED alert.
 * @returns     EscortRecord with ISO-8601 timestamp.
 */
export function recordEscort(scan: SafetyScanSummary): EscortRecord {
  return {
    type:        'escort',
    patientId:   scan.patientId,
    patientName: scan.patientName,
    timestamp:   new Date().toISOString(),
    bypassLogged: false,
  };
}

/**
 * Record a bypass with reason.
 *
 * An EscalationRecord is created and returned. The caller MUST:
 *   1. Update the scan history with bypassLogged: true.
 *   2. Send a supervisor alert (SMS or push notification).
 *
 * @param scan    The scan that triggered the RED alert.
 * @param reason  Free-text reason (e.g. "CHA override").
 * @returns       EscalationRecord requiring supervisor notification.
 */
export function recordBypass(scan: SafetyScanSummary, reason: string): EscalationRecord {
  return {
    type:                   'bypass',
    patientId:              scan.patientId,
    patientName:            scan.patientName,
    timestamp:              new Date().toISOString(),
    bypassLogged:           true,
    bypassReason:           reason,
    supervisorAlertRequired: true,
  };
}

/**
 * Returns true if the bypass button should be unlocked.
 * The button is locked for BYPASS_LOCKOUT_SECONDS from mountedAt.
 *
 * @param mountedAt  ISO-8601 timestamp of when the screen mounted.
 * @param now        ISO-8601 timestamp of the current moment.
 */
export function isBypassUnlocked(mountedAt: string, now: string): boolean {
  const elapsed = (new Date(now).getTime() - new Date(mountedAt).getTime()) / 1000;
  return elapsed >= BYPASS_LOCKOUT_SECONDS;
}

/**
 * Returns the remaining lockout seconds (0 when unlocked).
 *
 * @param mountedAt  ISO-8601 timestamp of when the screen mounted.
 * @param now        ISO-8601 timestamp of the current moment.
 */
export function bypassSecondsRemaining(mountedAt: string, now: string): number {
  const elapsed = (new Date(now).getTime() - new Date(mountedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(BYPASS_LOCKOUT_SECONDS - elapsed));
}

/**
 * Returns true if any of the 10 mandatory safety triggers are active.
 * If this returns true, the safety screen MUST be shown regardless of
 * any user or system decision.
 *
 * @param answers  Map of trigger IDs to boolean values.
 */
export function anyTriggerActive(answers: Partial<SafetyAnswers>): boolean {
  return SAFETY_TRIGGERS.some((trigger) => answers[trigger.id] === true);
}

/**
 * Returns the descriptions of all active safety triggers.
 * Used by the safety screen to display which triggers fired.
 */
export function activeTriggerDescriptions(answers: Partial<SafetyAnswers>): string[] {
  return SAFETY_TRIGGERS
    .filter((trigger) => answers[trigger.id] === true)
    .map((trigger) => trigger.description);
}

/**
 * Returns true if the outcome should include a treatment instruction.
 * GREEN and AMBER may show guidance. RED shows escort/escalation only.
 * GREY NEVER shows a treatment instruction (adjunct metrics only).
 *
 * @param colour  The triage colour from classify().
 */
export function shouldShowTreatmentInstruction(colour: 'GREEN' | 'AMBER' | 'RED' | 'GREY'): boolean {
  // RED → escort/bypass UI, not treatment instructions
  // GREY → adjunct only — explicitly prohibited from triggering clinical action
  return colour === 'GREEN' || colour === 'AMBER';
}

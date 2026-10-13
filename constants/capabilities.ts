/**
 * MediAid · constants/capabilities.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * SINGLE SOURCE OF TRUTH for what MediAid can actually do today.
 *
 * Every UI label, status line, and README table must read from this file.
 * The goal: a label can NEVER claim more than the code does.
 *
 * Status values:
 *   'implemented'   — code exists, tests pass, behaviour is real
 *   'simulated'     — the workflow exists, outputs come from a PRNG / mock;
 *                     every screen must show the "Simulated" label
 *   'experimental'  — code exists but accuracy is not validated on-device
 *   'investigational' — code exists, outputs are adjunct-only, never affect
 *                       referral colour (see model registry)
 *   'planned'       — not yet built; must never appear in funded-scope screens
 */

export type CapabilityStatus =
  | 'implemented'
  | 'simulated'
  | 'experimental'
  | 'investigational'
  | 'planned';

export interface Capability {
  id: string;
  label: string;
  status: CapabilityStatus;
  /** Human-readable one-liner for README / status table */
  note: string;
}

export const CAPABILITIES: Capability[] = [
  // ── Funded scope ──────────────────────────────────────────────────────────
  {
    id: 'scan_flow',
    label: '90-second scan flow',
    status: 'implemented',
    note: 'Timer, parts A–E, consent, voice TTS — real. All clinical outputs: simulated.',
  },
  {
    id: 'cough_detection',
    label: 'Cough event detection (microphone)',
    status: 'implemented',
    note: 'Real expo-av metering + adaptive burst detector (services/coughDetector.ts).',
  },
  {
    id: 'tremor_sensor',
    label: 'Resting tremor (accelerometer)',
    status: 'implemented',
    note: 'Real 20 Hz accelerometer RMS via expo-sensors. Risk score: simulated.',
  },
  {
    id: 'triage_safety',
    label: 'Triage + non-bypassable safety screen',
    status: 'implemented',
    note: '10 triggers, escort/bypass logic, escalation record, 10-second lockout.',
  },
  {
    id: 'deidentification_gate',
    label: 'De-identification gate',
    status: 'implemented',
    note: 'Branded RadarEvent, 11-field whitelist, assertNoIdentifiers, suppressSmallCells.',
  },
  {
    id: 'radar_write',
    label: 'Outbreak radar write path + offline queue',
    status: 'implemented',
    note: 'AsyncStorage queue, exponential backoff, idempotent upsert, cap-500.',
  },
  {
    id: 'outbreak_radar_view',
    label: 'Supabase outbreak_radar + 7-day alert view',
    status: 'implemented',
    note: 'SQL migration, RLS (anon INSERT only), server-side alert rule, small-cell suppression.',
  },
  {
    id: 'public_dashboard',
    label: 'Public outbreak dashboard (GitHub Pages)',
    status: 'implemented',
    note: 'docs/index.html reads outbreak_radar_7d; safe rendering; 30-second auto-refresh.',
  },
  {
    id: 'model_registry',
    label: 'Model-swap registry',
    status: 'implemented',
    note: 'validateContract(), install(), rollback(), run() — 5 modules, simulated provider.',
  },

  // ── Clinical models ───────────────────────────────────────────────────────
  {
    id: 'tb_cough_model',
    label: 'TB cough model (tb_cough)',
    status: 'simulated',
    note: 'Output is randomised within published sensitivity ranges. Real HeAR/TFLite: planned.',
  },
  {
    id: 'anaemia_model',
    label: 'Anaemia model (anaemia)',
    status: 'simulated',
    note: 'Conjunctival pallor — simulated. Real PPG conjunctiva inference: planned.',
  },
  {
    id: 'bioacoustic_model',
    label: 'Bio-acoustic model (bioacoustic)',
    status: 'simulated',
    note: 'Heart rate, SpO₂, AFib, resp. rate — simulated from mock PRNG.',
  },
  {
    id: 'jaundice_model',
    label: 'Jaundice model (jaundice)',
    status: 'investigational',
    note: 'Simulated + adjunct only. Never affects referral colour.',
  },
  {
    id: 'cardiac_ppg_model',
    label: 'Cardiac PPG model (cardiac_ppg)',
    status: 'investigational',
    note: 'CVD risk, glucose flag — simulated + adjunct only. Never affects referral colour.',
  },

  // ── Partially implemented ─────────────────────────────────────────────────
  {
    id: 'voice_commands',
    label: 'Voice commands (EN / FR)',
    status: 'experimental',
    note: 'expo-speech-recognition, en-US / fr-FR; graceful no-op in Expo Go. Not in EAS builds yet.',
  },
  {
    id: 'voice_print',
    label: 'Voice / biometric identity',
    status: 'simulated',
    note: 'Timer is cosmetic; hashes are deterministic; matching uses Math.random(). See app/biometric-identity.tsx.',
  },
  {
    id: 'sms_sync_fallback',
    label: 'SMS sync fallback',
    status: 'implemented',
    note: 'Opens native SMS composer via expo-sms (native) or no-op stub (web). Actual delivery depends on device.',
  },
  {
    id: 'consent_logging',
    label: 'Oral consent timestamp logging',
    status: 'implemented',
    note: 'ISO-8601 timestamp stored in scan record. Audio is never stored or transmitted.',
  },
  {
    id: 'ci_coverage',
    label: 'CI and test coverage',
    status: 'implemented',
    note: 'GitHub Actions, jest-expo, 80% threshold on logic modules. Android build job included.',
  },

  // ── Planned features ──────────────────────────────────────────────────────
  {
    id: 'tflite_inference',
    label: 'TFLite / on-device AI inference',
    status: 'planned',
    note: 'Provider interface exists; throws NotImplementedError today. Phase 1 deliverable.',
  },
  {
    id: 'encrypted_store',
    label: 'AES-256 encrypted local store',
    status: 'planned',
    note: 'Not implemented. Current storage: unencrypted AsyncStorage. Phase 1 deliverable.',
  },
  {
    id: 'dhis2_sync',
    label: 'DHIS2 / FHIR R4 structured sync',
    status: 'planned',
    note: 'Outbreak radar aggregate sync is live. FHIR R4 bundles and DHIS2 event format: planned Q2.',
  },
  {
    id: 'climate_layer',
    label: 'Climate-health intelligence layer',
    status: 'planned',
    note: 'ERA-5 / CHIRPS rainfall anomaly input. DHIS2 Climate App integration: planned Q2.',
  },
  {
    id: 'fulfulde_language',
    label: 'Fulfulde language support',
    status: 'planned',
    note: 'English and French voice prompts are implemented. Fulfulde: planned.',
  },
];

/** Look up a capability by id. Returns undefined if not found. */
export function getCapability(id: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}

/**
 * Return a short display label for use in status lines.
 * Example: statusLine('encrypted_store') → 'Planned'
 */
export function statusLine(id: string): string {
  const cap = getCapability(id);
  if (!cap) return 'Unknown';
  const map: Record<CapabilityStatus, string> = {
    implemented:    'Implemented',
    simulated:      'Simulated',
    experimental:   'Experimental',
    investigational: 'Investigational',
    planned:        'Planned',
  };
  return map[cap.status];
}

/**
 * Short label suitable for UI badges.
 * Includes the capability label and status.
 * Example: capabilityBadge('tb_cough_model') → 'TB cough model — Simulated'
 */
export function capabilityBadge(id: string): string {
  const cap = getCapability(id);
  if (!cap) return id;
  return `${cap.label} — ${statusLine(id)}`;
}

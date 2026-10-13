# MediAid — Open-Source, Offline-First Community Health Screening Aid (Prototype)

**AICEXPERTS Limited · Douala, Cameroon**
`contact@mediaid.health`

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Android%208.0%2B-blue)](https://reactnative.dev)
[![Built with Expo](https://img.shields.io/badge/Built%20with-Expo%2053-black)](https://expo.dev)
[![Outbreak Radar](https://img.shields.io/badge/Live%20Data-Outbreak%20Radar-teal)](https://bmpafe1.github.io/MediAid)
[![CI](https://github.com/bmpafe1/MediAid/actions/workflows/ci.yml/badge.svg)](https://github.com/bmpafe1/MediAid/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-see%20docs%2Fcoverage.md-blue)](docs/coverage.md)

> **Screening and triage support for Community Health Aides — not a diagnostic device.**
> Clinical outputs are currently simulated. On-device AI inference is planned for Phase 1.

---

## Current Status

| Component | Status | Notes |
|---|---|---|
| 90-second scan flow (UI, timer, consent, TTS) | **Implemented** | All clinical outputs are simulated |
| Cough event detection (real microphone) | **Implemented** | expo-av metering + burst detector |
| Resting tremor (real accelerometer) | **Implemented** | 20 Hz RMS via expo-sensors |
| Triage + non-bypassable safety screen | **Implemented** | 10 triggers, escort/bypass, escalation record |
| De-identification gate | **Implemented** | Branded RadarEvent, 11-field whitelist, tests |
| Outbreak radar write path + offline queue | **Implemented** | AsyncStorage, backoff, idempotent upsert |
| Supabase outbreak_radar table + 7-day alert view | **Implemented** | RLS, server-side alert rule, small-cell suppression |
| Public outbreak dashboard (GitHub Pages) | **Implemented** | docs/index.html, 30-second auto-refresh |
| Model-swap registry | **Implemented** | validateContract, install, rollback, run — 5 modules |
| CI and test coverage (logic modules ≥80%) | **Implemented** | GitHub Actions, jest-expo |
| TB cough model (tb_cough) | **Simulated** | PRNG within published ranges. Real HeAR/TFLite: planned |
| Anaemia model (anaemia) | **Simulated** | Conjunctival pallor inference: planned |
| Bio-acoustic model (bioacoustic) | **Simulated** | HR, SpO₂, AFib, resp. rate: planned |
| Jaundice model (jaundice) | **Investigational / Simulated** | Adjunct only, never affects referral colour |
| Cardiac PPG model (cardiac_ppg) | **Investigational / Simulated** | Adjunct only, never affects referral colour |
| Voice commands (EN/FR) | **Experimental** | expo-speech-recognition, graceful no-op in Expo Go |
| Voice/biometric identity | **Simulated** | Timer cosmetic; matching is Math.random() — see app/biometric-identity.tsx |
| SMS sync fallback | **Implemented** | Opens native SMS composer via expo-sms |
| AES-256 encrypted local store | **Planned** | Current storage: unencrypted AsyncStorage |
| TFLite / on-device AI inference | **Planned** | Provider interface exists; throws NotImplementedError |
| DHIS2 / FHIR R4 structured sync | **Planned Q2** | Radar aggregate sync is live; structured bundles planned |
| Climate-health intelligence layer | **Planned Q2** | ERA-5 / CHIRPS integration via DHIS2 Climate App |
| Fulfulde language support | **Planned** | English and French voice prompts are implemented |

All status values are generated from `constants/capabilities.ts` — the single source of truth for what MediAid can do today.

---

## What is MediAid?

MediAid is a **community health screening and triage aid** for Community Health Aides (CHAs) in rural Cameroon. It runs on any Android 8.0+ smartphone, requires no internet for core clinical functions, and returns a four-colour triage result (GREEN / AMBER / RED / GREY) in 90 seconds.

**It is not a diagnostic device.** Every clinical output is clearly labelled as simulated. When on-device inference is integrated in Phase 1, labels will reflect validated models only.

**Live outbreak radar dashboard (real aggregated screening data):** https://bmpafe1.github.io/MediAid

---

## The 90-Second Scan Protocol

| Segment | Action | Conditions Targeted |
|---|---|---|
| 0–30 s | Patient faces front camera (facial video PPG) | AFib, heart rate, anaemia, jaundice, CVD risk |
| 30–60 s | 3 coughs into microphone + real cough burst detector | TB, respiratory rate, COVID-19 flag |
| 60–90 s | Finger on rear camera + flash | SpO₂ confirmation, PPG glucose flag |

**Cough detection is real** (expo-av metering + adaptive burst detector in `services/coughDetector.ts`).
**All clinical classifications are simulated** (labelled on every result card).

---

## Clinical Evidence Base

All accuracy figures below are sourced from independently published peer-reviewed studies. These describe the capabilities MediAid is designed to integrate in Phase 1. **MediAid does not claim these figures from its own field testing.**

| Capability | Literature Finding | Citation |
|---|---|---|
| Contactless AFib screening via facial PPG | 95% sensitivity, 96% specificity | Yan et al. (2018) |
| 10-year cardiovascular risk score from PPG | C-statistic 71.1% | Weng / Google Health (2024) |
| TB cough detection | 94% accuracy | Yellapu et al. (2023) / HeAR |
| Anaemia (conjunctival camera AI) | AUC 0.97 | Wemyss et al. (2023) |
| Early Parkinson's via accelerometer voice | AUC 0.89, sensitivity 0.95 | He et al. (2024) |
| 7-condition eye disease screening | AUC 0.91–0.97 | Jin et al. (2024) |
| Neonatal jaundice | 94% sensitivity (CE-marked) | Aune et al. (2023) |
| COVID-19 breathing detection | AUROC 0.90 | Alkhodari & Khandoker (2022) |

---

## Non-Bypassable Safety Screen

When any of the 10 mandatory triggers is active, a RED alert fires and the CHA **cannot proceed** without confirming patient escort or recording a bypass. Bypass creates a persistent escalation record in AsyncStorage and displays an honest notice: *"Escalation recorded. SMS not yet sent: no SMS gateway configured."*

The 10 triggers (from `services/triage.ts` and `services/safetyScreen.ts`):
1. Altered consciousness
2. Severe respiratory distress at rest
3. Severe dehydration — child under 5
4. Uncontrolled bleeding
5. Suspected stroke (FAST+ positive)
6. Suspected meningitis
7. Obstetric emergency
8. Severe acute malnutrition with complications
9. Suspected poisoning
10. SpO₂ ≤ 90% OR heart rate > 150 OR heart rate < 40

---

## Privacy Guarantees

Only 11 fields ever leave the device (enforced by `services/deidentify.ts`):

| Field | Description |
|---|---|
| `village_geohash` | 4-char geohash (~39 km² cell) — never raw GPS |
| `data_source` | `simulated_demo` / `training` / `field_test` |
| `total_scans` | Always 1 per event |
| `green_count` / `amber_count` / `red_count` | Binary outcome flags |
| `cough_positive` | 0 or 1 |
| `referral_count` | 0 or 1 |
| `fever_flag` | Always 0 (planned for Phase 1) |
| `client_event_id` | UUID v4 for idempotent upsert |
| `recorded_at` | ISO-8601 truncated to minute precision |

Patient names, IDs, GPS coordinates, audio, video, and biometric templates **never leave the device**.

**Local storage:** Currently unencrypted AsyncStorage. AES-256 encrypted store is planned for Phase 1.

---

## UNICEF Scope Flag

Set `EXPO_PUBLIC_VISION_MODULES=true` in `.env` to unlock research/vision modules (LLM Validation, AI Advisor, Self-Healing AI, formulary, risk calculators, etc.). The default is `false` — only the funded scope is visible.

See `constants/featureFlags.ts` for the full list of hidden routes.

---

## Development Setup

### Prerequisites
- Node.js 18+, pnpm (`npm install -g pnpm`), Expo CLI

### Environment Variables
Create `.env`:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# Optional: unlock vision/research modules
# EXPO_PUBLIC_VISION_MODULES=true
```

### Install and Run
```bash
pnpm install
pnpm start        # Expo dev server
pnpm android      # Android
pnpm web          # Browser
```

### Tests and Coverage
Coverage is measured **only on logic modules** (not UI screens).
Covered: `alertRule`, `coughDetector`, `deidentify`, `modelRegistry`, `radarQueue`, `safetyScreen`, `triage`.
Threshold: **80% lines / branches / functions / statements**.

```bash
npx jest                   # watch mode
npx jest --ci --coverage   # CI mode with coverage
npx tsc --noEmit           # TypeScript check
```

See [`docs/coverage.md`](docs/coverage.md) for latest report.

### Apply Supabase Migration
```bash
supabase db push
# or manually run:
# supabase/migrations/001_outbreak_radar.sql
```

### Build Android APK
```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Outbreak Radar Alert Rule

Matches the SQL view in `supabase/migrations/001_outbreak_radar.sql` exactly:

```
alert_level = OUTBREAK  if SUM(red_count) >= 2        (7-day window)
alert_level = ELEVATED  if SUM(cough_positive) / SUM(total_scans) > 0.35
alert_level = NORMAL    otherwise
```

Small-cell suppression: field data rows with fewer than 5 scans are hidden from the public dashboard.

**Public REST API:** documented in [`docs/api-schema.md`](docs/api-schema.md).

---

## Research Programme (Planned)

The following research workstreams are planned for Phase 1 and are **not part of the funded scope**:

- **PPG Skin-Tone Calibration** — Makerere AI Lab, Uganda (Fitzpatrick V/VI rPPG accuracy)
- **Cough Acoustic Transfer** — University of Buea (TB model performance on Cameroonian population)
- **Anaemia/Jaundice AI Bias** — University of Buea (conjunctival colorimetry on Fitzpatrick V/VI)
- **Voice Biomarker Language Transfer** — University of Buea (depression/MCI on Fulfulde speakers)

All workstreams will collect data during the standard 90-second scan — zero additional field cost.

---

## Licence

MIT License — Copyright (c) 2026 AICEXPERTS Limited

*MediAid v1.0 · Prototype · UNICEF Venture Fund · AICEXPERTS Limited · Douala, Cameroon*

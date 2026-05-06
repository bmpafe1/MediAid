# MediAid — AI-Powered Diagnostic Operating System for the Last Mile

**AICEXPERTS Limited · Douala, Cameroon**
`contact@mediaid.health` · [www.mediaid.health](https://mediaid.health)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Android%208.0%2B-blue)](https://reactnative.dev)
[![Built with Expo](https://img.shields.io/badge/Built%20with-Expo%2053-black)](https://expo.dev)
[![Outbreak Radar](https://img.shields.io/badge/Live%20Data-Outbreak%20Radar-teal)](https://bmpafe1.github.io/MediAid)

---

## What is MediAid?

MediAid is a post-disease diagnostic operating system for the last mile — designed to turn any standard Android smartphone into a community clinic, epidemiological intelligence node, and anticipatory healthcare platform for children and communities who have never had access to any of these.

A Community Health Aide endorsed by the village chief says one word: **Scan**. In 90 seconds, without selecting any test, the unified scan protocol runs through three stages and returns a single multi-condition dashboard covering tuberculosis, cardiac conditions, anaemia, neonatal jaundice, respiratory illness, eye disease, and more. Zero internet. Zero consumables. **USD 0.22 per child screened** — 45 times cheaper than GeneXpert.

This repository contains the **fully navigable functional prototype**: the user interface, 90-second scan protocol, biometric patient identity system, CHA workflow logic, referral dashboard, safety screen, and training modules are all operational. Diagnostic AI outputs are currently simulated — showing exactly how the system will behave when real AI inference is integrated in Phase 1.

**Live outbreak radar dashboard (real-time public data):** https://bmpafe1.github.io/MediAid

---

## Key Numbers

| Metric | Value |
|---|---|
| Peer-reviewed studies validating AI capabilities | 25+ |
| Validated clinical capabilities | 16+ |
| Voice navigation languages | 200+ |
| Cost per consultation | USD 0.75 |
| Autonomous scan duration | 90 seconds |
| Marginal cost per additional condition | USD 0.00 |
| Offline operation | 100% — zero internet for any life-critical function |
| Target device | Android 8.0+, 2GB RAM, 150MB footprint |
| Battery consumption (background monitoring) | <3% per hour |

---

## Why mHealth Has Failed — and How MediAid Solves It

Six documented failure modes have prevented every prior mHealth deployment from closing the healthcare gap at the last mile. MediAid is architecturally designed to solve each one.

| Failure Mode | How It Manifests | MediAid's Structural Solution |
|---|---|---|
| Poor CHW usability | Tools built without CHW co-design lead to abandonment | Three-session co-design with named CHAs before deployment. Voice-first, one-word protocol. No menus. No literacy required. |
| Connectivity dependency | Ada Health, Babylon, HEP Assist all require internet; Babylon withdrew from Africa entirely | 100% offline-first. Zero life-critical function requires any connectivity. |
| Language and literacy exclusion | English/French interfaces exclude 773 million non-literate adults | Voice navigation in 200+ languages including Fulfuldé, Hausa, Lingala. Oral consent recorded. |
| CHW disempowerment and attrition | Algorithmic management leads to attrition; only 17% of mHealth-enabled CHWs performed optimally in one Uganda study | Traditional authority endorsement elevates CHA status. MediAid professionalises and empowers — not surveils. |
| Algorithmic bias on African populations | AI trained on non-African data systematically underperforms on African patients | African AI Equity Validation Protocol: four peer-reviewed workstreams with Makerere AI Lab and University of Buea. |
| No community trust mechanism | Tools deployed without community leadership face resistance regardless of clinical quality | Chief endorsement documented. CHA nominated by traditional authority. Social accountability is the adoption mechanism. |

---

## The 90-Second Scan Protocol

Unlike every other diagnostic application that requires the user to select a condition first, MediAid operates as a single unified protocol.

| Segment | Action | Conditions Screened |
|---|---|---|
| 0–30s | Patient faces front camera (facial video PPG) | AF, heart rate, anaemia (conjunctival), jaundice (scleral), 10-year CVD risk score |
| 30–60s | 3 coughs into microphone + accelerometer | TB, COPD/asthma transfer, respiratory rate, COVID-19 flag |
| 60–90s | Finger on rear camera + flash | HR confirmation, SpO₂ flag, PPG glucose flag |
| Optional | USD 5 macro lens attachment | Malaria, TB smear, intestinal parasites, helminths |

**Output:** A single multi-condition risk dashboard. No test menus. No repeated setup. Every patient, every encounter, the full sensor suite. The marginal cost of the 8th condition is USD 0.00.

---

## Clinical AI Evidence Base — 25+ Peer-Reviewed Studies

All accuracy figures below are sourced from independently published peer-reviewed studies. MediAid does not claim these figures from internal testing — they represent the scientific validation of the underlying AI capabilities that Phase 1 will integrate and field-validate in the Cameroonian context.

### Cardiac and Cardiovascular

| Capability | Key Finding | Citation |
|---|---|---|
| Contactless AF screening via facial PPG | 95% sensitivity, 96% specificity vs 12-lead ECG | Yan et al. (2018), n=217 inpatients |
| 10-year cardiovascular risk score from PPG | C-statistic 71.1%, non-inferior to WHO/Globorisk office score | Weng et al. / Google Health (2024), n=141,509 |
| PPG-based blood glucose flag | TinyML on-device deployment validated | Zeynali et al. (2025) |
| Heart rate and respiratory rate from skin-video PPG | RMSE ~0.37 breaths/min | Alafeef & Fraiwan (2020) |

### Respiratory and Infectious Disease

| Capability | Key Finding | Citation |
|---|---|---|
| Cough AI — TB detection | 94% accuracy | Yellapu et al. (2023); Swaasa/HeAR |
| COVID-19 detection from breathing sounds | AUROC 0.90 | Alkhodari & Khandoker (2022) |
| Breath sound screening — respiratory infection | AI classifiers ~95% accuracy | Senthilnathan et al. (2020) |

### Anaemia, Jaundice and Neonatal

| Capability | Key Finding | Citation |
|---|---|---|
| Non-invasive anaemia screening (conjunctival camera AI) | AUC 0.97; Ghana-validated in children | Wemyss et al. (2023); Deep Learning Model (2025) |
| Anaemia in Cameroonian children (Fitzpatrick V/VI) | Cameroonian population-specific validation | Tiko et al. (2023) |
| Neonatal jaundice screening | 94% sensitivity, CE-marked Picterus system | Aune et al. (2023) |

### Eye Disease

| Capability | Key Finding | Citation |
|---|---|---|
| 7-condition eye disease screening | Cataract, retinopathy, glaucoma, AMD, ROP, strabismus, leukocoria — high agreement with standard clinical exams | Jin et al. (2024) systematic review |
| Retinal imaging with non-clinical staff | Excellent agreement with desktop retinal camera; usable images obtained by non-clinical staff | Bastawrous et al. (2016), Kenya |
| Paediatric eye disease screening | Effectiveness confirmed across multiple paediatric ocular conditions | Vijendran et al. (2025) |

### Neurological and Functional

| Capability | Key Finding | Citation |
|---|---|---|
| Early Parkinson's disease detection | AUC 0.89, sensitivity 0.95 | He et al. (2024) |
| Hand and upper-limb disorders | Tremor, bradykinesia, carpal tunnel — 46-study systematic review | Fu et al. (2023) |
| Gait and fall detection | Reliable proxy for frailty and cardiovascular risk | Lipsmeier et al. (2018) |
| Fetal movement monitoring | 82% sensitivity from 32 weeks (accelerometer) | Validated proxy biomarkers |

### Microscopy and Parasitology

| Capability | Key Finding | Citation |
|---|---|---|
| Malaria detection via smartphone microscopy | ~93% accuracy at patient level; 94% specificity | Yang et al. (2019) |
| Malaria Screener field deployment | 74–92% accuracy vs expert microscopy/PCR | Yu et al. (2020, 2023) |
| NTDs — Loa loa, Schistosoma | Excellent diagnostic characteristics; >90% fluorescent microscopy agreement | Vasiman et al. (2018) |
| Soil-transmitted helminths | 83–100% sensitivity | Holmström et al. (2017) |

### Voice and Mental Health

| Capability | Key Finding | Citation |
|---|---|---|
| Depression detection via voice biomarker | 78–96% accuracy | Riad et al. (2024) / APA |
| Dementia and MCI detection via voice | AUC 0.83–0.92 | Lancet Regional Health (2025) |

### Foundational Reviews

| Capability | Key Finding | Citation |
|---|---|---|
| Smartphone sensor capabilities overview | Comprehensive validation: cardiac, respiratory, neurological, ophthalmological, dermatological | Majumder & Deen (2019) |
| Built-in sensor health apps systematic survey | Identifies validated uses and evidence gaps across hundreds of clinical applications | Baxter et al. (2020) |

---

## DHIS2 Integration Specification

MediAid integrates with the DHIS2 national health information system used in Cameroon and 40+ other countries. Integration is via the open-source **DHIS2 Climate App** already operational in Cameroon's national HMIS.

### Data Flow Architecture

```
CHA Device (offline)
    │
    │  AES-256 encrypted local store
    │  Anonymised aggregate only — no raw sensor data
    │
    ▼
Connectivity window (any 2G/SMS/WiFi)
    │
    ▼
Supabase outbreak_radar table
    │
    ├──▶ Public outbreak radar dashboard (bmpafe1.github.io/MediAid)
    │
    └──▶ DHIS2 national HMIS sync
              │
              ├──▶ District health officer dashboard
              ├──▶ Longitudinal Disease Burden Atlas (monthly)
              └──▶ Climate-health correlation alerts (DHIS2 Climate App)
```

### Sync Protocol

- **Trigger:** Any connectivity window — 2G, SMS-compatible, WiFi
- **Data transmitted:** Anonymised geohash aggregate counts only — no patient identifiers, no GPS coordinates, no raw sensor streams
- **Format:** FHIR R4 records for clinical data; DHIS2 event format for outbreak radar
- **Conflict resolution:** Last-write-wins with server timestamp
- **Encryption in transit:** TLS 1.3

### DHIS2 Data Elements Mapped

| MediAid Field | DHIS2 Data Element | Value Type |
|---|---|---|
| `total_scans` | DE_MEDIAID_SCANS | Integer |
| `green_count` | DE_MEDIAID_GREEN | Integer |
| `amber_count` | DE_MEDIAID_AMBER | Integer |
| `red_count` | DE_MEDIAID_RED | Integer |
| `cough_positive` | DE_MEDIAID_COUGH | Integer |
| `referral_count` | DE_MEDIAID_REFERRAL | Integer |
| `alert_level` | DE_MEDIAID_ALERT | Text (NORMAL/ELEVATED/OUTBREAK) |
| `village_geohash` | DE_MEDIAID_GEOHASH | Text (4-char precision) |

### Outbreak Radar Alert Logic

The 7-day rolling window cough threshold that triggers district health officer alerts:

```
alert_level = OUTBREAK  if red_count >= 2
alert_level = ELEVATED  if (cough_positive / total_scans) > 0.35
alert_level = NORMAL    otherwise
```

Climate-disease correlation alerts are generated by layering the outbreak radar data with satellite-derived rainfall anomalies via the DHIS2 Climate App (ERA-5 and CHIRPS datasets, open access). When rainfall anomalies elevate outbreak thresholds, the alert level is automatically elevated. This delivers anticipatory malaria surge predictions 1–2 months ahead of case onset, validated for the South West Region pilot communities (Bime et al., 2022).

---

## Clinical Workflow Documentation

### The Non-Bypassable 10-Trigger Safety Screen

When any of the following conditions is detected, a RED flag is issued. RED results are non-bypassable: the CHA cannot proceed without confirming patient escort, and bypassing triggers automatic SMS escalation to the Clinical Safety Officer.

1. Altered or loss of consciousness
2. Severe difficulty breathing or laboured breathing at rest
3. Severe dehydration in child under five
4. Uncontrolled or heavy bleeding
5. Suspected stroke (facial droop, arm weakness, speech difficulty)
6. Suspected meningitis (neck stiffness, photophobia, non-blanching rash)
7. Obstetric emergency (heavy bleeding, prolonged labour, eclamptic signs)
8. Severe acute malnutrition with complications
9. Suspected poisoning or overdose
10. Confirmed SpO₂ below 90% or heart rate above 150 / below 40

### Referral Colour System

| Colour | Meaning | CHA Action |
|---|---|---|
| GREEN | No urgent action. Use for clinical guidance. | Document and continue monitoring |
| AMBER | Refer for confirmation. | Issue referral, log in app, follow up |
| RED | Emergency — non-bypassable | Confirm escort, trigger escalation if bypassed |
| GREY | Adjunct only — contextual information, never triggers treatment | Note for next clinic visit |

### CHA Training Curriculum (3-Day)

**Day 1:** Basic first aid, device setup, patient consent (oral consent recording for non-literate patients), data sovereignty explanation, community co-design session

**Day 2:** 90-second scan protocol practice, referral workflow, safety screen walkthrough, emergency escalation procedures, GBV safeguarding module

**Day 3:** AMBER and RED scenario simulations, DHIS2 sync procedure, offline resilience testing, certification assessment

### Biometric Patient Identity System

MediAid uses the phone's existing front camera and microphone — no additional hardware — to enable longitudinal patient tracking without formal identification documents.

- **At registration:** 5-second voice print (spoken phrase in patient's language) + optional facial geometry hash
- **At subsequent visits:** Passive matching during the 30-second facial PPG segment
- **Storage:** Anonymised hash only — no biometric image stored, ever
- **Matching:** GREY adjunct flag only; CHA confirms manually
- **Sync:** Biometric hashes are never included in any sync transmission — stored on local device only

---

## African AI Equity Validation Protocol

MediAid is the only platform in this space with skin-tone equity correction formalised as a named four-workstream research programme producing four standalone peer-reviewed publications at zero additional field cost.

### Workstream 1 — PPG Skin-Tone Calibration Study
**Partner:** Makerere AI Lab, Uganda
**Scope:** Measurement of rPPG signal quality and AF detection accuracy stratified by Fitzpatrick skin tone V/VI population in Cameroon. Addresses documented systematic underperformance of PPG algorithms on dark skin tones.
**Output:** Peer-reviewed publication in journal TBD (targeting Lancet Digital Health or NPJ Digital Medicine)

### Workstream 2 — Cough Acoustic Transfer Study
**Partner:** University of Buea, Department of Medical Microbiology
**Scope:** Performance of TB cough AI model on Cameroonian population vs Indian/Kenyan training data. Measures acoustic feature transfer and dialect-specific signal degradation. Phase 1 hypothesis: zero-shot transfer to COPD and asthma coughs (n≥30 validation set).
**Output:** First published dataset of cough acoustic model transfer performance on Cameroonian Fulfuldé and French speakers

### Workstream 3 — Anaemia and Jaundice Conjunctival AI Bias
**Partner:** University of Buea Research Ethics Committee / UB-CeDD
**Scope:** Comparative accuracy of conjunctival colorimetry AI across Fitzpatrick scale in local population. Identifies the minimum fine-tuning dataset size needed for clinical accuracy equivalence on Fitzpatrick V/VI populations.
**Output:** Peer-reviewed publication; dataset contributed to open access repository

### Workstream 4 — Voice Biomarker Language Transfer
**Partner:** Dr. Nengieh Lizzie Wantchami, Head of Department, Journalism and Mass Communication, University of Buea
**Scope:** Evaluation of depression and MCI voice biomarker models on Fulfuldé and Cameroonian French speakers. First published dataset of voice biomarker performance in these language groups.
**Output:** First published benchmark of voice biomarker performance on Fulfuldé speakers

All four workstreams collect data during the standard Phase 1 90-second scan protocol — zero additional field cost.

---

## Gender-Based Violence (GBV) Referral Pathway

MediAid is a Clinical Decision Support Tool. It does not screen for, diagnose, or investigate Gender-Based Violence. The GBV Referral Pathway is an extension of MediAid's existing AMBER referral logic — not a new clinical module.

### Trigger Conditions (AMBER Referral Prompt)

- Unexplained or patterned injuries detected via wound monitoring module
- PHQ-9 depression score ≥10 or GAD-7 anxiety score ≥10, combined with contextual CHA observation
- Direct patient disclosure to the CHA during the consultation encounter

### Safeguarding Protocols

**Privacy first:** The GBV referral prompt is only displayed when the patient is confirmed to be alone. No GBV flag appears on the patient-facing screen at any time.

**CHA training module:** Dedicated GBV safeguarding content in the 3-day training curriculum — how to offer the referral safely, what not to say, how to respond to disclosure without placing the patient at further risk.

**Verified referral directory:** Before deployment in each pilot village, at least two verified GBV-capable referral services are mapped and confirmed active — minimum: a health centre with a GBV-trained officer and one psychosocial support or women's shelter contact.

**No diagnostic claim:** GBV referral is classified as a GREY-to-AMBER social pathway — never a diagnostic finding. No GBV referral data is included in clinical outcome metrics.

**Data protection:** No GBV referral data is synced to any external server. Referral events are stored only on the local device in an encrypted, CHA-accessible log. The patient can request deletion at any time. No GBV indicator is included in the Longitudinal Disease Burden Atlas.

**Community co-design:** The GBV referral pathway language is co-designed with female community members and reviewed by the Cultural Competence Review Board before deployment.

---

## Community Partners and Institutional Anchors

| Partner | Role |
|---|---|
| **University of Buea — Medical Microbiology** (Dr. Nicoline Fri Tanih) | Clinical validation co-investigator; ethics co-applicant; African AI Equity Workstream 2 lead. Published on TB in Bamenda and anaemia in Cameroonian children (Fitzpatrick V/VI). |
| **Cameroon Ministry of Public Health** (Dr. Dinga Jerome Nyhalah, PhD) | Official MoPH collaborator; 18 years public health; national TB and NCD strategy alignment; regulatory sandbox lead |
| **CBC Health Services (CBCHB)** | 6,000+ staff; 16 hospitals; 8 Cameroon regions including NW Region. CSO recruitment; referral pathway for RED-flagged patients; CHA co-certification; Phase 2 scale pathway (85 facilities) |
| **UB-CeDD — University of Buea Centre for Drug Discovery** | Gates Foundation-funded (USD 1M Calestous Juma Fellowship); confirmatory lab for malaria and TB validation; active collaboration with Medicines for Malaria Venture |
| **Makerere AI Lab, Uganda** | African AI Equity Validation Protocol Workstream 1 lead |
| **Faculty of Engineering, University of Buea** | Letter of Support obtained — signed by Vice Dean Dr. Donatus Nguti |
| **Direction de la Meteorologie Nationale, Cameroon** | Meteorological data partnership for climate-health integration |
| **KTECOMPANY (KTE LTD), Buea** | Offline-first Android development; DHIS2 backend integration; on-device encryption |

**Named Community Health Aides (CHA co-designers):**
- Mrs. Helene Bissong — Baligham village, 8 years CHA experience
- Mr. Hilary Bagoua — Bagam village, 10 years CHA experience

**Traditional Authority Endorsement:**
- Fon Gahnyam II — Baligham
- Chief Tenkeu Nzossie — Bagam

---

## Open Source Commitment

This repository is licensed under the **MIT Licence** — see [LICENSE](LICENSE).

As the AI models are integrated during Phase 1, the trained model weights for all clinical AI modules will be published to this repository under the same MIT licence. The open model weights commitment covers: cardiac PPG model, cough TB classifier, anaemia colorimetry model, and the bio-acoustic community baseline architecture.

DHIS2 integration code is built on the open-source DHIS2 platform and will be contributed back to the DHIS2 community as a Digital Public Good.

---

## Live Public Data

**Outbreak Radar Dashboard:** https://bmpafe1.github.io/MediAid

Real-time anonymised aggregate screening data from pilot villages, updated automatically when CHAs sync after each session. No patient data — geohash aggregate counts only.

**Public REST API:**
```
GET https://[project].supabase.co/rest/v1/outbreak_radar
    ?select=village_name,total_scans,green_count,amber_count,red_count,
            cough_positive,alert_level,recorded_at
    &order=recorded_at.desc
    &apikey=[public anon key — see README Data section]
```

Full API schema documented in [`docs/api-schema.md`](docs/api-schema.md).

---

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android emulator) or a physical Android device

### Environment Variables

Create a `.env` file in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Never commit `.env` to version control.** It is listed in `.gitignore`.

### Install and Run

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start

# Run on Android
pnpm android

# Run on iOS
pnpm ios

# Run in browser
pnpm web
```

### Project Structure

```
mediaid/
├── app/                    # Expo Router screens and navigation
├── assets/                 # Images, fonts, icons
├── components/             # Reusable UI components
├── constants/              # App-wide constants
├── contexts/               # React context providers
├── docs/                   # GitHub Pages public dashboard
│   └── index.html          # Live outbreak radar dashboard
├── hooks/                  # Custom React hooks
├── scripts/                # Build and utility scripts
├── services/               # API and external service integrations
│   └── outbreakRadar.ts    # Supabase outbreak data sync
├── template/               # Auth and core template modules
│   ├── auth/supabase/      # Supabase authentication
│   └── core/               # Shared client and config
├── .env                    # Environment variables (not committed)
├── app.json                # Expo configuration
├── package.json            # Dependencies
└── README.md               # This file
```

---

## Licence

MIT License

Copyright (c) 2026 AICEXPERTS Limited

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

*MediAid v1.0 · AICEXPERTS Limited · Douala, Cameroon · contact@mediaid.health · www.mediaid.health*

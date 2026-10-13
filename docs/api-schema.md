# MediAid — Supabase API Schema

**Project:** MediAid · AICEXPERTS Limited · MIT Licence  
**Backend:** Supabase (PostgreSQL + REST)  
**Scope:** Outbreak radar data only. Patient records never leave the device.

---

## Base URL

```
https://<YOUR_PROJECT>.supabase.co/rest/v1
```

Replace `<YOUR_PROJECT>` with your Supabase project reference ID.

---

## Authentication

| Key type | Where to use |
|----------|-------------|
| `anon` (publishable) | Public dashboard, mobile app writes, this file. Safe to commit in front-end code. |
| `service_role` (secret) | Server-side admin tasks only. **Never commit. Never put in `/docs` or the mobile app.** |

Pass the anon key in every request:

```
apikey: <ANON_KEY>
Authorization: Bearer <ANON_KEY>
```

---

## Endpoint 1 — Read aggregated radar data

### `GET /rest/v1/outbreak_radar_7d`

Returns rolling 7-day aggregated scan outcome counts per geohash cell.  
This is the **only** endpoint the public dashboard reads.

**Permissions:** `anon` role, SELECT only (via view, not base table).

**Small-cell suppression:** Rows where `data_source = 'field'` AND `total_scans < 5` are hidden to prevent reverse-identification of individuals in small villages. Prototype/training rows are always returned.

### Example request

```bash
curl -s \
  "${SUPABASE_URL}/rest/v1/outbreak_radar_7d?select=*&order=last_recorded_at.desc" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Accept: application/json"
```

### Example response

```json
[
  {
    "village_geohash":  "s0yg",
    "data_source":      "simulated_demo",
    "total_scans":      12,
    "green_count":      7,
    "amber_count":      3,
    "red_count":        2,
    "cough_positive":   5,
    "fever_flag":       0,
    "referral_count":   2,
    "last_recorded_at": "2026-04-22T14:31:00Z",
    "alert_level":      "OUTBREAK"
  },
  {
    "village_geohash":  "s0yf",
    "data_source":      "training",
    "total_scans":      8,
    "green_count":      5,
    "amber_count":      2,
    "red_count":        1,
    "cough_positive":   3,
    "fever_flag":       0,
    "referral_count":   1,
    "last_recorded_at": "2026-04-21T09:15:00Z",
    "alert_level":      "ELEVATED"
  }
]
```

### Field reference

| Field | Type | Description |
|-------|------|-------------|
| `village_geohash` | `text` | 4-character Geohash (~39 km² cell). Only geographic identifier. No GPS. |
| `data_source` | `text` | Trust level: `simulated_demo` \| `training` \| `field_test` \| `field` |
| `total_scans` | `integer` | Number of scan events in the 7-day window for this cell. |
| `green_count` | `integer` | Scans with GREEN (normal) outcome. |
| `amber_count` | `integer` | Scans with AMBER (watchlist) outcome. |
| `red_count` | `integer` | Scans with RED (high-priority) outcome. |
| `cough_positive` | `integer` | Scans where the cough segment flagged a positive signal. |
| `fever_flag` | `integer` | Always 0 in current builds. Reserved for validated fever sensor (future). |
| `referral_count` | `integer` | Scans where a referral was issued. |
| `last_recorded_at` | `timestamptz` | ISO-8601 timestamp of the most recent event in this cell. |
| `alert_level` | `text` | `OUTBREAK` \| `ELEVATED` \| `NORMAL` — computed server-side (see rule below). |

### Alert level computation rule

Computed in the `outbreak_radar_7d` Supabase view. Clients **cannot** supply or override it.

```sql
CASE
  WHEN SUM(red_count) >= 2
    THEN 'OUTBREAK'
  WHEN SUM(total_scans) > 0
       AND SUM(cough_positive)::numeric / SUM(total_scans) > 0.35
    THEN 'ELEVATED'
  ELSE 'NORMAL'
END
```

| Level | Trigger |
|-------|---------|
| `OUTBREAK` | ≥ 2 RED-alert scans in the rolling 7-day window for the same geohash |
| `ELEVATED` | Cough-positive rate > 35% of total scans (with fewer than 2 RED alerts) |
| `NORMAL` | No threshold exceeded |

**Rainfall / climate anomaly trigger:** Planned for Quarter 2. Will use DHIS2 Climate App / ERA-5 / CHIRPS satellite data. Not yet active.

---

## Endpoint 2 — Insert a scan event

### `POST /rest/v1/outbreak_radar`

Inserts a single anonymised scan event. Called by the mobile app after each completed scan.

**Permissions:** `anon` role, INSERT only. SELECT and UPDATE are forbidden for anon.

**Idempotency:** The `client_event_id` (UUID v4) is UNIQUE. Duplicate retries from offline queues are silently rejected — the server returns HTTP 200 with `onConflict: ignore`.

### Example request

```bash
curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/outbreak_radar" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=ignore-duplicates" \
  -d '{
    "client_event_id": "550e8400-e29b-41d4-a716-446655440000",
    "recorded_at":     "2026-04-22T14:31:00Z",
    "village_geohash": "s0yg",
    "data_source":     "simulated_demo",
    "total_scans":     1,
    "green_count":     0,
    "amber_count":     0,
    "red_count":       1,
    "cough_positive":  1,
    "referral_count":  1,
    "fever_flag":      0
  }'
```

### Field constraints

| Field | Type | Constraint |
|-------|------|------------|
| `client_event_id` | `uuid` | REQUIRED. Must be unique (UUID v4). |
| `recorded_at` | `timestamptz` | Optional. Defaults to `now()` on the server. |
| `village_geohash` | `text` | REQUIRED. Exactly 4 ASCII characters. |
| `data_source` | `text` | REQUIRED. One of: `simulated_demo`, `training`, `field_test`, `field`. |
| `total_scans` | `integer` | Must equal `1`. Each row = one scan. |
| `green_count` | `integer` | `0` or `1`. |
| `amber_count` | `integer` | `0` or `1`. |
| `red_count` | `integer` | `0` or `1`. |
| `cough_positive` | `integer` | `0` or `1`. |
| `referral_count` | `integer` | `0` or `1`. |
| `fever_flag` | `integer` | Always `0` in current app builds. |

**Constraint:** `green_count + amber_count + red_count <= 1` (exactly one outcome colour, or GREY = all zero).

### Fields intentionally omitted (privacy)

The following fields are **never sent by the app** and are rejected if present:

- Patient name, patient ID
- GPS latitude / longitude
- Village name (only the 4-char geohash is sent)
- Raw audio, video, or image data
- Biometric templates (voice print, facial geometry hash)
- Free text / clinical notes
- GBV (gender-based violence) indicators

### Verify INSERT-only for anon (expected: 401 or empty)

```bash
# This must return an error or empty array — not rows
curl -s \
  "${SUPABASE_URL}/rest/v1/outbreak_radar?select=*&limit=1" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}"
```

---

## Row Level Security summary

| Operation | anon role | authenticated role | postgres (owner) |
|-----------|-----------|-------------------|-----------------|
| SELECT on `outbreak_radar` (base table) | ❌ Forbidden | ❌ Forbidden | ✅ Allowed |
| INSERT on `outbreak_radar` (base table) | ✅ Allowed (with constraints) | ✅ Allowed | ✅ Allowed |
| SELECT on `outbreak_radar_7d` (view) | ✅ Allowed | ✅ Allowed | ✅ Allowed |

The view runs with the **owner's (postgres) privileges**, not the caller's — this is what allows anon to read aggregated data through the view while the base table remains protected.

---

## Privacy guarantees

1. **De-identification at source:** The mobile app's `services/deidentify.ts` is the only function that constructs a radar event. It whitelists exactly the 9 fields above.
2. **4-char geohash only:** ~39 km² spatial resolution. No finer granularity is stored or transmitted.
3. **No patient data in transit:** Patient records, scan audio/video, and biometric data are stored only on the CHA's device.
4. **Small-cell suppression:** Field rows with fewer than 5 scans are hidden in the public view.
5. **Server-enforced:** Column CHECK constraints and RLS policies are the enforcement layer — not just client-side logic.

---

## Applying the migration

See [supabase/README.md](../supabase/README.md) for step-by-step instructions to apply `supabase/migrations/001_outbreak_radar.sql` via the Supabase Dashboard SQL Editor.

---

*MediAid · AICEXPERTS Limited · MIT Licence · UNICEF Venture Fund 2026*

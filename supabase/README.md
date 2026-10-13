# MediAid · Supabase Backend

AICEXPERTS Limited · MIT Licence

---

## ⚠️ Security Warning

**Never commit your Supabase `service_role` key to this repository.**
The `service_role` key bypasses Row Level Security and has full database access.
Only the public `anon` key may appear in client code or CI environment variables.

Store keys in a `.env` file that is listed in `.gitignore`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here   # safe to expose to clients
# SUPABASE_SERVICE_ROLE_KEY=secret                  # NEVER commit this
```

---

## Applying the Migration

### Option A — Supabase Dashboard (recommended for first deploy)

1. Open your project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New query**.
3. Paste the full contents of `supabase/migrations/001_outbreak_radar.sql`.
4. Click **Run**.
5. Verify in **Table Editor** that `public.outbreak_radar` exists.
6. Verify in **Table Editor → Views** that `public.outbreak_radar_7d` exists.

### Option B — Supabase CLI

```bash
# Install CLI if not already installed
npm install -g supabase

# Link to your project (requires your project ref from the dashboard URL)
supabase link --project-ref your-project-ref

# Push all local migrations
supabase db push
```

### Idempotency

The migration is safe to run multiple times:
- `CREATE TABLE IF NOT EXISTS` skips creation if the table already exists.
- `DO $$ ... $$` blocks add only missing columns.
- `DROP VIEW IF EXISTS` + `CREATE VIEW` replaces the view cleanly.
- `DROP POLICY IF EXISTS` + `CREATE POLICY` replaces the policy cleanly.

---

## Security Architecture

| Role | Base table `outbreak_radar` | View `outbreak_radar_7d` |
|---|---|---|
| `anon` (public key) | **INSERT only** | **SELECT** |
| `authenticated` | No policy (blocked by RLS) | **SELECT** |
| `postgres` / `service_role` | Full access | Full access |

**Why anon cannot SELECT the base table:**
1. `REVOKE ALL ON public.outbreak_radar FROM anon` removes any inherited SELECT.
2. `ROW LEVEL SECURITY` is `ENABLED` — without an explicit SELECT policy, anon sees zero rows even if a grant existed.
3. The only `GRANT` given to anon on the base table is `INSERT`.

The view is owned by `postgres` (definer semantics, not invoker). PostgreSQL evaluates the view query with the owner's privileges, so anon can SELECT through the view without touching the base table directly.

---

## Testing with curl

Set your environment variables first:

```bash
export URL="https://your-project.supabase.co"
export KEY="your-anon-key"    # the publishable key — NOT service_role
```

### (i) Insert one test row

```bash
curl -s -X POST "$URL/rest/v1/outbreak_radar" \
  -H "apikey: $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "client_event_id": "00000000-0000-0000-0000-000000000001",
    "village_geohash": "tst1",
    "data_source": "training",
    "total_scans": 1,
    "green_count": 1,
    "amber_count": 0,
    "red_count": 0,
    "cough_positive": 0,
    "fever_flag": 0,
    "referral_count": 0,
    "alert_level": "NORMAL"
  }'
# Expected: HTTP 201, JSON row returned (or 409 if duplicate client_event_id)
```

### (ii) Read the 7-day aggregated view

```bash
curl -s "$URL/rest/v1/outbreak_radar_7d?select=*" \
  -H "apikey: $KEY"
# Expected: HTTP 200, JSON array (empty [] or rows with alert_level computed)
```

### (iii) Confirm direct SELECT on base table is blocked

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "$URL/rest/v1/outbreak_radar?select=*&limit=1" \
  -H "apikey: $KEY"
# Expected: 200 with empty body [] (RLS returns 0 rows, not a 403, in PostgREST)
# OR: 403 Forbidden depending on Supabase version.
# In both cases NO rows should be returned.
```

> **Note:** PostgREST with RLS returns `[]` (empty array) rather than HTTP 403
> when the role has a GRANT but RLS blocks all rows. The absence of rows
> is the correct security signal — not the status code. Confirm with:
> ```bash
> curl -s "$URL/rest/v1/outbreak_radar?select=count" -H "apikey: $KEY"
> # Should return [{"count": 0}] or [] — never actual row data
> ```

---

## Data Schema Reference

### `public.outbreak_radar` (base table — anon INSERT only)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | Auto-generated primary key |
| `recorded_at` | timestamptz | Server timestamp, default now() |
| `client_event_id` | uuid | Device-generated idempotency key |
| `village_geohash` | text | 4-char geohash (~39 km²), no GPS |
| `data_source` | text | `simulated_demo` / `training` / `field_test` / `field` |
| `total_scans` | int | Always 1 per row |
| `green_count` | int | 0 or 1 |
| `amber_count` | int | 0 or 1 |
| `red_count` | int | 0 or 1 |
| `cough_positive` | int | 0 or 1 |
| `fever_flag` | int | 0 or 1 |
| `referral_count` | int | 0 or 1 |
| `alert_level` | text | **DEPRECATED** — ignored, kept for compatibility |
| `village_name` | text | **DEPRECATED** — nullable, kept for compatibility |

### `public.outbreak_radar_7d` (view — anon SELECT allowed)

| Column | Type | Notes |
|---|---|---|
| `village_geohash` | text | 4-char geohash |
| `data_source` | text | Source tier |
| `total_scans` | int | 7-day sum |
| `green_count` | int | 7-day sum |
| `amber_count` | int | 7-day sum |
| `red_count` | int | 7-day sum |
| `cough_positive` | int | 7-day sum |
| `fever_flag` | int | 7-day sum |
| `referral_count` | int | 7-day sum |
| `last_recorded_at` | timestamptz | Most recent event in window |
| `alert_level` | text | Server-computed: `NORMAL` / `ELEVATED` / `OUTBREAK` |

**Alert logic:**
- `OUTBREAK` — `red_count ≥ 2` in the 7-day window
- `ELEVATED` — `cough_positive / total_scans > 35%` in the 7-day window
- `NORMAL` — otherwise

**Small-cell suppression:** `field` rows with fewer than 5 scans in the window are excluded from the view. Demo/training/field_test rows are always shown.

**Planned (Q2):** Rainfall anomaly ELEVATED trigger via DHIS2 Climate App (ERA-5 / CHIRPS datasets). Not yet implemented.

---

## Running the SQL Tests

Open **Supabase Dashboard → SQL Editor** and paste the contents of
`supabase/tests/outbreak_radar.test.sql`. Run the entire file. All
`ASSERT` statements should pass silently. Any failure raises an exception
with a descriptive message.

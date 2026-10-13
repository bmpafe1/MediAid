-- =============================================================================
-- MediAid · Migration 001 · outbreak_radar table and 7-day alert view
-- AICEXPERTS Limited · MIT Licence
-- Apply via: Supabase Dashboard → SQL Editor → paste and run
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLE public.outbreak_radar
--    One row = one anonymised scan event from a CHA device.
--    Only aggregate counts are stored — never patient IDs, GPS coordinates,
--    names, raw sensor streams, biometric templates, or GBV indicators.
--    alert_level on the base table is DEPRECATED; the view computes it.
--    village_name kept nullable for backwards-compat; the app stops sending it.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.outbreak_radar (
  id               bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at      timestamptz   NOT NULL DEFAULT now(),

  -- Idempotency key: the device generates a fresh UUID per event.
  -- Duplicate retries are silently rejected (unique constraint).
  client_event_id  uuid          NOT NULL UNIQUE,

  -- 4-character Geohash (≈39 km² cell) — no finer granularity transmitted.
  village_geohash  text          NOT NULL
    CHECK (char_length(village_geohash) = 4),

  -- Trust level of the sending device. 'field' rows are suppressed in the
  -- public view unless the cell has ≥5 scans (small-cell suppression rule).
  data_source      text          NOT NULL DEFAULT 'simulated_demo'
    CHECK (data_source IN ('simulated_demo', 'training', 'field_test', 'field')),

  -- Each row represents exactly one scan. Counts are 0 or 1 per row;
  -- aggregation happens in the view, not on insert.
  total_scans      int           NOT NULL DEFAULT 1
    CHECK (total_scans = 1),

  green_count      int           NOT NULL DEFAULT 0
    CHECK (green_count IN (0, 1)),

  amber_count      int           NOT NULL DEFAULT 0
    CHECK (amber_count IN (0, 1)),

  red_count        int           NOT NULL DEFAULT 0
    CHECK (red_count IN (0, 1)),

  -- At most one outcome colour per scan row.
  CONSTRAINT single_outcome CHECK (green_count + amber_count + red_count <= 1),

  cough_positive   int           NOT NULL DEFAULT 0
    CHECK (cough_positive IN (0, 1)),

  fever_flag       int           NOT NULL DEFAULT 0,

  referral_count   int           NOT NULL DEFAULT 0
    CHECK (referral_count IN (0, 1)),

  -- DEPRECATED on the base table. Kept for schema stability.
  -- The outbreak_radar_7d view derives alert_level server-side.
  -- Do not trust this column; always read from the view.
  alert_level      text          NOT NULL DEFAULT 'NORMAL',

  -- Kept nullable for backwards compatibility with older app builds.
  -- New app builds do NOT send this field (privacy: geohash only).
  village_name     text
);

-- ---------------------------------------------------------------------------
-- 1a. ADD MISSING COLUMNS to an already-existing table (idempotent block).
--     Safe to run repeatedly; each DO block catches "column already exists".
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- client_event_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'outbreak_radar'
      AND column_name  = 'client_event_id'
  ) THEN
    ALTER TABLE public.outbreak_radar
      ADD COLUMN client_event_id uuid NOT NULL UNIQUE;
  END IF;

  -- village_geohash
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'outbreak_radar'
      AND column_name  = 'village_geohash'
  ) THEN
    ALTER TABLE public.outbreak_radar
      ADD COLUMN village_geohash text NOT NULL DEFAULT '0000'
        CHECK (char_length(village_geohash) = 4);
  END IF;

  -- data_source
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'outbreak_radar'
      AND column_name  = 'data_source'
  ) THEN
    ALTER TABLE public.outbreak_radar
      ADD COLUMN data_source text NOT NULL DEFAULT 'simulated_demo'
        CHECK (data_source IN ('simulated_demo', 'training', 'field_test', 'field'));
  END IF;

  -- fever_flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'outbreak_radar'
      AND column_name  = 'fever_flag'
  ) THEN
    ALTER TABLE public.outbreak_radar
      ADD COLUMN fever_flag int NOT NULL DEFAULT 0;
  END IF;

  -- village_name (nullable, backwards-compat)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'outbreak_radar'
      AND column_name  = 'village_name'
  ) THEN
    ALTER TABLE public.outbreak_radar
      ADD COLUMN village_name text;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
--    The anon (public) Supabase key may only INSERT — never read the base
--    table directly. All public reads go through the outbreak_radar_7d view.
--
--    Why INSERT-only on the base table?
--    • Prevents an attacker with the anon key from harvesting raw event rows
--      that, in aggregate, could re-identify a village above the small-cell
--      suppression threshold.
--    • The view enforces small-cell suppression (≥5 scans for 'field' rows)
--      and computes alert_level server-side — so clients cannot forge it.
-- ---------------------------------------------------------------------------

ALTER TABLE public.outbreak_radar ENABLE ROW LEVEL SECURITY;

-- Revoke every privilege on the base table from the anon role, then grant
-- only INSERT. (REVOKE is safe even if the grant was never made.)
REVOKE ALL ON public.outbreak_radar FROM anon;
GRANT INSERT ON public.outbreak_radar TO anon;

-- INSERT policy: allow any anon insert that satisfies the column constraints.
-- We do NOT add a data_source <> 'field' restriction here because the
-- small-cell suppression rule in the view is the correct enforcement point.
-- If we later want to restrict field inserts to authenticated devices, that
-- check belongs in an Edge Function, not this policy.
DROP POLICY IF EXISTS "anon_insert" ON public.outbreak_radar;
CREATE POLICY "anon_insert"
  ON public.outbreak_radar
  FOR INSERT
  TO anon
  WITH CHECK (true);
  -- Column-level constraints (geohash length, count ranges, single_outcome)
  -- are enforced by the CHECK constraints defined on the table above.
  -- This policy simply says "anon may attempt an INSERT"; the DB enforces
  -- data integrity through its own constraint layer.

-- ---------------------------------------------------------------------------
-- 3. VIEW public.outbreak_radar_7d
--    Rolling 7-day aggregation per (village_geohash, data_source).
--
--    Security model:
--    • View is owned by the postgres role (which has full table access).
--    • PostgreSQL evaluates view queries with the VIEW OWNER's privileges,
--      not the calling role's — so anon can SELECT from the view even though
--      anon has no SELECT grant on the base table.
--    • DO NOT add SECURITY INVOKER; that would make the view run with anon's
--      privileges, immediately failing since anon has no SELECT on the table.
--
--    Small-cell suppression:
--    • Rows where data_source = 'field' AND sum(total_scans) < 5 are hidden.
--      This prevents reverse-identification of individuals in tiny villages.
--    • Demo / training / field_test rows are always shown (they contain no
--      real patient events) but carry their data_source label so callers can
--      distinguish them from genuine field data.
--
--    alert_level computation (matches services/alertRule.ts exactly):
--    • OUTBREAK : sum(red_count) ≥ 2 in the 7-day window
--    • ELEVATED : cough_positive / total_scans > 35 % in the 7-day window
--    • NORMAL   : otherwise
--
--    NOTE — Rainfall anomaly integration (DHIS2 Climate App / ERA-5 /
--    CHIRPS datasets) is NOT YET IMPLEMENTED. When implemented in Quarter 2,
--    an additional ELEVATED trigger will be added here based on the
--    satellite-derived rainfall anomaly score. Until then, alert_level is
--    based solely on scan outcome counts.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.outbreak_radar_7d;

CREATE VIEW public.outbreak_radar_7d AS
SELECT
  village_geohash,
  data_source,
  SUM(total_scans)::int                               AS total_scans,
  SUM(green_count)::int                               AS green_count,
  SUM(amber_count)::int                               AS amber_count,
  SUM(red_count)::int                                 AS red_count,
  SUM(cough_positive)::int                            AS cough_positive,
  SUM(fever_flag)::int                                AS fever_flag,
  SUM(referral_count)::int                            AS referral_count,
  MAX(recorded_at)                                    AS last_recorded_at,

  -- alert_level is computed here, server-side.
  -- The base-table alert_level column is DEPRECATED and ignored.
  CASE
    WHEN SUM(red_count) >= 2
      THEN 'OUTBREAK'
    WHEN SUM(total_scans) > 0
         AND SUM(cough_positive)::numeric / SUM(total_scans) > 0.35
      THEN 'ELEVATED'
    ELSE 'NORMAL'
  END                                                 AS alert_level

FROM public.outbreak_radar
WHERE recorded_at >= NOW() - INTERVAL '7 days'
GROUP BY village_geohash, data_source

-- Small-cell suppression:
-- For genuine field data, publish only when ≥5 scans are present in the cell.
-- Demo / training / field_test rows are always published (no real patients).
HAVING (data_source <> 'field') OR (SUM(total_scans) >= 5);

COMMENT ON VIEW public.outbreak_radar_7d IS
  'Rolling 7-day aggregation of scan outcome counts per village geohash. '
  'alert_level is computed server-side. Real field rows with fewer than 5 '
  'scans are suppressed (small-cell privacy rule). '
  'PLANNED (Q2): rainfall anomaly ELEVATED trigger via DHIS2 Climate App.';

-- Grant SELECT on the view to anon (public dashboard and curl access).
-- The base table remains unreadable to anon.
GRANT SELECT ON public.outbreak_radar_7d TO anon;

-- Also grant to the authenticated role so logged-in users can read it.
GRANT SELECT ON public.outbreak_radar_7d TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. COMMENTS
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.outbreak_radar IS
  'One row per anonymised scan event from a CHA device. '
  'Contains only aggregate counts and a 4-char geohash — no patient IDs, '
  'names, GPS coordinates, raw sensor data, biometric templates, or GBV '
  'indicators. alert_level on this table is DEPRECATED; use the '
  'outbreak_radar_7d view instead.';

COMMENT ON COLUMN public.outbreak_radar.client_event_id IS
  'UUID generated by the device before transmission. Allows safe offline '
  'retry without creating duplicate rows (UNIQUE constraint).';

COMMENT ON COLUMN public.outbreak_radar.village_geohash IS
  '4-character Geohash (~39 km² cell). Finest granularity transmitted. '
  'No GPS coordinates or sub-village identifiers are stored or synced.';

COMMENT ON COLUMN public.outbreak_radar.data_source IS
  'Trust level: simulated_demo (prototype UI), training (CHA onboarding), '
  'field_test (pre-deployment validation), field (live clinical data). '
  'Field rows with <5 total_scans are suppressed in the public view.';

COMMENT ON COLUMN public.outbreak_radar.alert_level IS
  'DEPRECATED. This column is ignored. Alert level is always derived '
  'from aggregate counts in the outbreak_radar_7d view. Kept for schema '
  'backwards compatibility with older app builds only.';

COMMENT ON COLUMN public.outbreak_radar.village_name IS
  'DEPRECATED. Kept nullable for backwards compatibility with older app '
  'builds. New builds do not send this field. Geohash is the only '
  'geographic identifier transmitted.';

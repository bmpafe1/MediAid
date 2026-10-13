-- =============================================================================
-- MediAid · SQL Assertions for outbreak_radar schema
-- Run in: Supabase Dashboard → SQL Editor (paste full file, click Run)
-- All assertions must pass silently. Failures raise exceptions.
-- =============================================================================

DO $$
DECLARE
  v_alert_level text;
  v_total       int;
  v_red         int;
  v_cough       int;
BEGIN

  -- -------------------------------------------------------------------------
  -- SETUP: Insert 6 training rows for geohash 'tst1'
  --   • 3 rows with cough_positive = 1
  --   • 2 rows with red_count     = 1  (triggers OUTBREAK: red_count sum ≥ 2)
  --   • 1 clean green row
  -- -------------------------------------------------------------------------

  INSERT INTO public.outbreak_radar
    (client_event_id, village_geohash, data_source,
     total_scans, green_count, amber_count, red_count,
     cough_positive, fever_flag, referral_count, alert_level)
  VALUES
    -- Row 1: red
    ('aaaaaaaa-0000-0000-0000-000000000001'::uuid,
     'tst1', 'training', 1, 0, 0, 1, 1, 0, 1, 'NORMAL'),
    -- Row 2: red
    ('aaaaaaaa-0000-0000-0000-000000000002'::uuid,
     'tst1', 'training', 1, 0, 0, 1, 1, 0, 0, 'NORMAL'),
    -- Row 3: cough only (no red)
    ('aaaaaaaa-0000-0000-0000-000000000003'::uuid,
     'tst1', 'training', 1, 0, 1, 0, 1, 1, 0, 'NORMAL'),
    -- Row 4: green
    ('aaaaaaaa-0000-0000-0000-000000000004'::uuid,
     'tst1', 'training', 1, 1, 0, 0, 0, 0, 0, 'NORMAL'),
    -- Row 5: amber, no cough
    ('aaaaaaaa-0000-0000-0000-000000000005'::uuid,
     'tst1', 'training', 1, 0, 1, 0, 0, 0, 0, 'NORMAL'),
    -- Row 6: green, no cough
    ('aaaaaaaa-0000-0000-0000-000000000006'::uuid,
     'tst1', 'training', 1, 1, 0, 0, 0, 0, 0, 'NORMAL');

  -- -------------------------------------------------------------------------
  -- TEST 1: Row count — exactly 6 rows inserted for 'tst1'
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_total
  FROM public.outbreak_radar
  WHERE village_geohash = 'tst1'
    AND client_event_id::text LIKE 'aaaaaaaa-%';

  ASSERT v_total = 6,
    FORMAT('TEST 1 FAILED: expected 6 rows, got %s', v_total);

  -- -------------------------------------------------------------------------
  -- TEST 2: View returns exactly 1 row for geohash 'tst1' / 'training'
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_total
  FROM public.outbreak_radar_7d
  WHERE village_geohash = 'tst1'
    AND data_source = 'training';

  ASSERT v_total = 1,
    FORMAT('TEST 2 FAILED: expected 1 view row, got %s', v_total);

  -- -------------------------------------------------------------------------
  -- TEST 3: View aggregates total_scans = 6
  -- -------------------------------------------------------------------------
  SELECT total_scans INTO v_total
  FROM public.outbreak_radar_7d
  WHERE village_geohash = 'tst1'
    AND data_source = 'training';

  ASSERT v_total = 6,
    FORMAT('TEST 3 FAILED: expected total_scans=6, got %s', v_total);

  -- -------------------------------------------------------------------------
  -- TEST 4: View aggregates red_count = 2
  -- -------------------------------------------------------------------------
  SELECT red_count INTO v_red
  FROM public.outbreak_radar_7d
  WHERE village_geohash = 'tst1'
    AND data_source = 'training';

  ASSERT v_red = 2,
    FORMAT('TEST 4 FAILED: expected red_count=2, got %s', v_red);

  -- -------------------------------------------------------------------------
  -- TEST 5: View aggregates cough_positive = 3
  -- -------------------------------------------------------------------------
  SELECT cough_positive INTO v_cough
  FROM public.outbreak_radar_7d
  WHERE village_geohash = 'tst1'
    AND data_source = 'training';

  ASSERT v_cough = 3,
    FORMAT('TEST 5 FAILED: expected cough_positive=3, got %s', v_cough);

  -- -------------------------------------------------------------------------
  -- TEST 6: alert_level = OUTBREAK (red_count 2 ≥ 2 triggers OUTBREAK first)
  -- -------------------------------------------------------------------------
  SELECT alert_level INTO v_alert_level
  FROM public.outbreak_radar_7d
  WHERE village_geohash = 'tst1'
    AND data_source = 'training';

  ASSERT v_alert_level = 'OUTBREAK',
    FORMAT('TEST 6 FAILED: expected OUTBREAK, got %s', v_alert_level);

  -- -------------------------------------------------------------------------
  -- TEST 7: Small-cell suppression — 'field' row with 1 scan not visible
  -- -------------------------------------------------------------------------
  INSERT INTO public.outbreak_radar
    (client_event_id, village_geohash, data_source,
     total_scans, green_count, amber_count, red_count,
     cough_positive, fever_flag, referral_count, alert_level)
  VALUES
    ('bbbbbbbb-0000-0000-0000-000000000001'::uuid,
     'tst2', 'field', 1, 0, 0, 1, 1, 0, 0, 'NORMAL');

  SELECT COUNT(*) INTO v_total
  FROM public.outbreak_radar_7d
  WHERE village_geohash = 'tst2'
    AND data_source = 'field';

  ASSERT v_total = 0,
    FORMAT('TEST 7 FAILED: field cell with 1 scan should be suppressed, got %s rows', v_total);

  -- -------------------------------------------------------------------------
  -- TEST 8: ELEVATED alert (no reds, high cough rate above 35%)
  -- Insert 3 rows for 'tst3': 0 red, 2 cough_positive → 2/3 = 67% > 35%
  -- -------------------------------------------------------------------------
  INSERT INTO public.outbreak_radar
    (client_event_id, village_geohash, data_source,
     total_scans, green_count, amber_count, red_count,
     cough_positive, fever_flag, referral_count, alert_level)
  VALUES
    ('cccccccc-0000-0000-0000-000000000001'::uuid,
     'tst3', 'training', 1, 0, 1, 0, 1, 0, 0, 'NORMAL'),
    ('cccccccc-0000-0000-0000-000000000002'::uuid,
     'tst3', 'training', 1, 0, 1, 0, 1, 0, 0, 'NORMAL'),
    ('cccccccc-0000-0000-0000-000000000003'::uuid,
     'tst3', 'training', 1, 1, 0, 0, 0, 0, 0, 'NORMAL');

  SELECT alert_level INTO v_alert_level
  FROM public.outbreak_radar_7d
  WHERE village_geohash = 'tst3'
    AND data_source = 'training';

  ASSERT v_alert_level = 'ELEVATED',
    FORMAT('TEST 8 FAILED: expected ELEVATED, got %s', v_alert_level);

  -- -------------------------------------------------------------------------
  -- TEST 9: NORMAL alert (1 scan, no red, no cough)
  -- -------------------------------------------------------------------------
  INSERT INTO public.outbreak_radar
    (client_event_id, village_geohash, data_source,
     total_scans, green_count, amber_count, red_count,
     cough_positive, fever_flag, referral_count, alert_level)
  VALUES
    ('dddddddd-0000-0000-0000-000000000001'::uuid,
     'tst4', 'training', 1, 1, 0, 0, 0, 0, 0, 'NORMAL');

  SELECT alert_level INTO v_alert_level
  FROM public.outbreak_radar_7d
  WHERE village_geohash = 'tst4'
    AND data_source = 'training';

  ASSERT v_alert_level = 'NORMAL',
    FORMAT('TEST 9 FAILED: expected NORMAL, got %s', v_alert_level);

  -- -------------------------------------------------------------------------
  -- TEST 10: Duplicate client_event_id is rejected (idempotency)
  -- -------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.outbreak_radar
      (client_event_id, village_geohash, data_source,
       total_scans, green_count, amber_count, red_count,
       cough_positive, fever_flag, referral_count, alert_level)
    VALUES
      -- Repeat row 1 from tst1 setup — must conflict
      ('aaaaaaaa-0000-0000-0000-000000000001'::uuid,
       'tst1', 'training', 1, 0, 0, 1, 1, 0, 1, 'NORMAL');

    -- If we reach here, the unique constraint failed to fire
    ASSERT false, 'TEST 10 FAILED: duplicate client_event_id was accepted';
  EXCEPTION WHEN unique_violation THEN
    -- Expected — unique constraint correctly rejected the duplicate
    NULL;
  END;

  RAISE NOTICE 'All 10 tests passed.';

  -- -------------------------------------------------------------------------
  -- CLEANUP: Delete all test rows
  -- -------------------------------------------------------------------------
  DELETE FROM public.outbreak_radar
  WHERE village_geohash IN ('tst1', 'tst2', 'tst3', 'tst4')
    AND client_event_id::text SIMILAR TO
        '(aaaaaaaa|bbbbbbbb|cccccccc|dddddddd)-%';

  RAISE NOTICE 'Cleanup complete — all test rows deleted.';

END;
$$;

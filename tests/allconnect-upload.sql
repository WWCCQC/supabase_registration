-- Run the whole file together. All live-data changes are rolled back.
BEGIN;
SET LOCAL statement_timeout = '8s';
SET LOCAL ROLE service_role;

DO $test$
DECLARE
  snapshot timestamptz;
  batch uuid := gen_random_uuid();
  malformed_batch uuid := gen_random_uuid();
  stale_batch uuid := gen_random_uuid();
  volume_batch uuid := gen_random_uuid();
  invalid_batch uuid;
  base_payload jsonb;
  live_rows jsonb;
  result record;
  role_name text;
  privilege_name text;
  original_count integer;
  source_fingerprint text;
  replacement_started_at timestamptz;
  replacement_ms numeric;
BEGIN
  SELECT max(updated_at) INTO snapshot FROM public.allconnect;
  SELECT to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at']
    INTO base_payload FROM public.allconnect a LIMIT 1;
  IF base_payload IS NULL THEN
    RAISE EXCEPTION 'Regression requires an existing Allconnect source row';
  END IF;

  -- Exercise one full upload chunk; full-snapshot timing has separate fixture setup.
  INSERT INTO public.allconnect_import_rows(batch_id, row_number, payload)
  SELECT volume_batch, row_number() OVER (ORDER BY a.uuid)::integer,
    to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at']
  FROM public.allconnect a ORDER BY a.uuid LIMIT 200;
  SELECT count(*), md5(string_agg(md5(payload::text), '' ORDER BY md5(payload::text)))
    INTO original_count, source_fingerprint
  FROM public.allconnect_import_rows WHERE batch_id = volume_batch;

  INSERT INTO public.allconnect_import_rows(batch_id, row_number, payload) VALUES
    (batch, 1, base_payload || '{"HANDLER_ID":"TEST-001"}'::jsonb),
    (batch, 2, base_payload || '{"HANDLER_ID":"TEST-002"}'::jsonb),
    (stale_batch, 1, base_payload || '{"HANDLER_ID":"STALE"}'::jsonb);

  SELECT * INTO STRICT result FROM public.replace_allconnect_import(batch, snapshot);
  IF result.inserted_count IS DISTINCT FROM 2 OR (SELECT count(*) FROM public.allconnect) <> 2 THEN
    RAISE EXCEPTION 'Atomic replacement row count is incorrect';
  END IF;
  IF result.imported_at IS NULL OR EXISTS (
    SELECT 1 FROM public.allconnect
    WHERE uuid IS NULL OR created_at IS DISTINCT FROM result.imported_at
      OR updated_at IS DISTINCT FROM result.imported_at
  ) THEN
    RAISE EXCEPTION 'Generated audit fields are missing or inconsistent';
  END IF;
  IF (SELECT array_agg("HANDLER_ID" ORDER BY "HANDLER_ID") FROM public.allconnect)
    IS DISTINCT FROM ARRAY['TEST-001', 'TEST-002'] THEN
    RAISE EXCEPTION 'Replacement did not preserve source values';
  END IF;
  IF EXISTS (SELECT 1 FROM public.allconnect_import_rows WHERE batch_id = batch)
    OR (SELECT count(*) FROM public.allconnect_import_rows WHERE batch_id = stale_batch) <> 1 THEN
    RAISE EXCEPTION 'Successful replacement must clean only its own staging batch';
  END IF;
  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.uuid) INTO live_rows FROM public.allconnect a;

  INSERT INTO public.allconnect_import_rows(batch_id, row_number, payload)
  VALUES (malformed_batch, 1, '{"HANDLER_ID":"MISSING-OTHER-FIELDS"}'::jsonb);
  BEGIN
    PERFORM public.replace_allconnect_import(malformed_batch, result.imported_at);
    RAISE EXCEPTION 'Malformed payload should fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.uuid) FROM public.allconnect a) IS DISTINCT FROM live_rows
    OR (SELECT count(*) FROM public.allconnect_import_rows WHERE batch_id = malformed_batch) <> 1 THEN
    RAISE EXCEPTION 'Failed replacement changed live data or removed staged data';
  END IF;

  BEGIN
    PERFORM public.replace_allconnect_import(stale_batch, snapshot);
    RAISE EXCEPTION 'Stale snapshot should fail';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Expected stale SQLSTATE PT409, got %', SQLSTATE;
  END;
  IF (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.uuid) FROM public.allconnect a) IS DISTINCT FROM live_rows
    OR (SELECT count(*) FROM public.allconnect_import_rows WHERE batch_id = stale_batch) <> 1 THEN
    RAISE EXCEPTION 'Stale replacement changed live data or removed staged data';
  END IF;

  invalid_batch := gen_random_uuid();
  BEGIN
    PERFORM public.replace_allconnect_import(invalid_batch, result.imported_at);
    RAISE EXCEPTION 'Empty batch should fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO public.allconnect_import_rows(batch_id, row_number, payload) VALUES
    (invalid_batch, 1, base_payload), (invalid_batch, 3, base_payload);
  BEGIN
    PERFORM public.replace_allconnect_import(invalid_batch, result.imported_at);
    RAISE EXCEPTION 'Non-contiguous rows should fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  DELETE FROM public.allconnect_import_rows WHERE batch_id = invalid_batch AND row_number = 1;
  BEGIN
    PERFORM public.replace_allconnect_import(invalid_batch, result.imported_at);
    RAISE EXCEPTION 'Rows not starting at one should fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  invalid_batch := gen_random_uuid();
  INSERT INTO public.allconnect_import_rows(batch_id, row_number, payload)
  VALUES (invalid_batch, 1, base_payload || jsonb_build_object('uuid', gen_random_uuid()));
  BEGIN
    PERFORM public.replace_allconnect_import(invalid_batch, result.imported_at);
    RAISE EXCEPTION 'Extra payload keys or caller-supplied audit fields should fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.uuid) FROM public.allconnect a) IS DISTINCT FROM live_rows THEN
    RAISE EXCEPTION 'Invalid batch changed live data';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
    WHERE oid = 'public.allconnect_import_rows'::regclass) THEN
    RAISE EXCEPTION 'Staging RLS must be enabled';
  END IF;
  IF (SELECT prosecdef OR NOT (coalesce(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""'])
    FROM pg_catalog.pg_proc
    WHERE oid = 'public.replace_allconnect_import(uuid,timestamptz)'::regprocedure) THEN
    RAISE EXCEPTION 'Replacement must be SECURITY INVOKER with an empty search_path';
  END IF;
  IF NOT (SELECT coalesce(proconfig, ARRAY[]::text[]) @> ARRAY['statement_timeout=30s']
    FROM pg_catalog.pg_proc
    WHERE oid = 'public.replace_allconnect_import(uuid,timestamptz)'::regprocedure) THEN
    RAISE EXCEPTION 'Replacement must declare a function-scoped 30-second timeout';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege(role_name, 'public.allconnect_import_rows', privilege_name) THEN
        RAISE EXCEPTION '% must not have % staging access', role_name, privilege_name;
      END IF;
    END LOOP;
    IF has_function_privilege(role_name, 'public.replace_allconnect_import(uuid,timestamptz)', 'EXECUTE') THEN
      RAISE EXCEPTION '% must not execute replacement', role_name;
    END IF;
  END LOOP;

  replacement_started_at := clock_timestamp();
  SELECT * INTO STRICT result FROM public.replace_allconnect_import(volume_batch, result.imported_at);
  replacement_ms := extract(epoch FROM clock_timestamp() - replacement_started_at) * 1000;
  IF result.inserted_count IS DISTINCT FROM original_count
    OR (SELECT count(*) FROM public.allconnect) <> original_count THEN
    RAISE EXCEPTION 'Representative-volume replacement row count is incorrect';
  END IF;
  IF (SELECT md5(string_agg(md5((to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at'])::text), ''
      ORDER BY md5((to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at'])::text)))
    FROM public.allconnect a) IS DISTINCT FROM source_fingerprint THEN
    RAISE EXCEPTION 'Representative-volume replacement changed source values';
  END IF;
  IF result.imported_at IS NULL OR EXISTS (
    SELECT 1 FROM public.allconnect
    WHERE uuid IS NULL OR created_at IS DISTINCT FROM result.imported_at
      OR updated_at IS DISTINCT FROM result.imported_at
  ) OR EXISTS (SELECT 1 FROM public.allconnect_import_rows WHERE batch_id = volume_batch) THEN
    RAISE EXCEPTION 'Representative-volume audit fields or staging cleanup are incorrect';
  END IF;
  IF replacement_ms >= 1000 THEN
    RAISE EXCEPTION 'One upload chunk took % ms; repeated composite evaluation may have returned', replacement_ms;
  END IF;
  PERFORM set_config('allconnect_test.metrics', jsonb_build_object(
    'rows', original_count, 'replacement_ms', replacement_ms
  )::text, true);
END
$test$;

SELECT 'PASS: atomic Allconnect replacement and rollback' AS result,
  current_setting('allconnect_test.metrics')::jsonb AS metrics;
ROLLBACK;

-- Fixture staging is not part of the commit RPC's eight-second request budget.
-- Run the entire file together; no live or staged data changes are committed.
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL statement_timeout = '60s';

DO $stage$
DECLARE
  batch uuid := gen_random_uuid();
  snapshot timestamptz;
  staged_count integer;
  fingerprint text;
BEGIN
  SELECT max(updated_at) INTO snapshot FROM public.allconnect;
  INSERT INTO public.allconnect_import_rows(batch_id, row_number, payload)
  SELECT batch, row_number() OVER (ORDER BY a.uuid)::integer,
    to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at']
  FROM public.allconnect a;
  SELECT count(*), md5(string_agg(md5(payload::text), '' ORDER BY md5(payload::text)))
    INTO staged_count, fingerprint
  FROM public.allconnect_import_rows WHERE batch_id = batch;
  IF staged_count < 200 THEN
    RAISE EXCEPTION 'Full-volume regression requires at least 200 source rows';
  END IF;
  PERFORM set_config('allconnect_test.batch', batch::text, true);
  PERFORM set_config('allconnect_test.snapshot', snapshot::text, true);
  PERFORM set_config('allconnect_test.count', staged_count::text, true);
  PERFORM set_config('allconnect_test.fingerprint', fingerprint, true);
END
$stage$;

SET LOCAL statement_timeout = '8s';
DO $replace$
DECLARE
  started_at timestamptz := clock_timestamp();
  result record;
  elapsed_ms numeric;
BEGIN
  SELECT * INTO STRICT result FROM public.replace_allconnect_import(
    current_setting('allconnect_test.batch')::uuid,
    current_setting('allconnect_test.snapshot')::timestamptz
  );
  elapsed_ms := extract(epoch FROM clock_timestamp() - started_at) * 1000;
  IF result.inserted_count IS DISTINCT FROM current_setting('allconnect_test.count')::integer THEN
    RAISE EXCEPTION 'Full-volume inserted count is incorrect';
  END IF;
  IF elapsed_ms >= 8000 THEN
    RAISE EXCEPTION 'Full-volume replacement exceeded the eight-second API budget';
  END IF;
  PERFORM set_config('allconnect_test.imported_at', result.imported_at::text, true);
  PERFORM set_config('allconnect_test.metrics', jsonb_build_object(
    'rows', result.inserted_count, 'replacement_ms', elapsed_ms
  )::text, true);
END
$replace$;

SET LOCAL statement_timeout = '60s';
DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.allconnect) <> current_setting('allconnect_test.count')::integer THEN
    RAISE EXCEPTION 'Full-volume live row count is incorrect';
  END IF;
  IF (SELECT md5(string_agg(md5((to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at'])::text), ''
      ORDER BY md5((to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at'])::text)))
    FROM public.allconnect a) IS DISTINCT FROM current_setting('allconnect_test.fingerprint') THEN
    RAISE EXCEPTION 'Full-volume source values changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.allconnect WHERE uuid IS NULL
      OR created_at IS DISTINCT FROM current_setting('allconnect_test.imported_at')::timestamptz
      OR updated_at IS DISTINCT FROM current_setting('allconnect_test.imported_at')::timestamptz
  ) OR EXISTS (
    SELECT 1 FROM public.allconnect_import_rows
    WHERE batch_id = current_setting('allconnect_test.batch')::uuid
  ) THEN
    RAISE EXCEPTION 'Full-volume audit fields or staging cleanup are incorrect';
  END IF;
END
$verify$;

SELECT 'PASS: full-snapshot replacement within API budget and rollback' AS result,
  current_setting('allconnect_test.metrics')::jsonb AS metrics;
ROLLBACK;

-- Install the volume API harness's test probe first. Never modify the production RPC.
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL statement_timeout = '30s';

DO $safety$
DECLARE
  batch uuid := gen_random_uuid();
  snapshot timestamptz;
  baseline_count integer;
  baseline_fingerprint text;
  source_fingerprint text;
  error_detail text;
  evidence jsonb;
  skip_cleanup boolean;
  malformed text;
BEGIN
  SELECT count(*), max(updated_at), md5(string_agg(md5(to_jsonb(a)::text), '' ORDER BY uuid))
    INTO baseline_count, snapshot, baseline_fingerprint FROM public.allconnect a;
  INSERT INTO public.allconnect_import_rows(batch_id, row_number, payload)
  SELECT batch, row_number() OVER (ORDER BY a.uuid)::integer,
    to_jsonb(a) - ARRAY['uuid', 'created_at', 'updated_at']
  FROM public.allconnect a ORDER BY a.uuid LIMIT 200;
  IF (SELECT count(*) FROM public.allconnect_import_rows WHERE batch_id = batch) <> 200 THEN
    RAISE EXCEPTION 'Safety proof needs 200 complete fixture rows';
  END IF;
  SELECT md5(string_agg(md5(payload::text), '' ORDER BY md5(payload::text)))
    INTO source_fingerprint FROM public.allconnect_import_rows WHERE batch_id = batch;

  FOREACH malformed IN ARRAY ARRAY[
    'aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}',
    'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    '------------------------------------',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' || E'\n',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' || E'\r\n', NULL
  ] LOOP
    BEGIN
      PERFORM public.test_allconnect_upload_volume_probe(malformed, snapshot, 200, source_fingerprint, false);
      RAISE EXCEPTION 'Non-canonical UUID unexpectedly accepted';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;

  FOREACH skip_cleanup IN ARRAY ARRAY[false, true] LOOP
    BEGIN
      PERFORM public.test_allconnect_upload_volume_probe(batch::text, snapshot, 200, source_fingerprint, skip_cleanup);
      RAISE EXCEPTION 'Probe returned normally and could commit live replacement';
    EXCEPTION WHEN SQLSTATE 'PT409' OR SQLSTATE 'PT412' THEN
      IF SQLSTATE IS DISTINCT FROM (CASE WHEN skip_cleanup THEN 'PT412' ELSE 'PT409' END) THEN
        RAISE EXCEPTION 'Wrong probe outcome for skipped cleanup = %', skip_cleanup;
      END IF;
      GET STACKED DIAGNOSTICS error_detail = PG_EXCEPTION_DETAIL;
      evidence := error_detail::jsonb;
      IF evidence->>'rows' IS DISTINCT FROM '200'
        OR evidence->>'remaining_staged_rows' IS DISTINCT FROM (CASE WHEN skip_cleanup THEN '200' ELSE '0' END)
        OR evidence->>'source_fingerprint' IS DISTINCT FROM source_fingerprint THEN
        RAISE EXCEPTION 'Proof did not exercise successful replacement and the expected cleanup behavior';
      END IF;
    END;
    -- These assertions run BEFORE outer ROLLBACK, proving the probe itself undid writes.
    IF (SELECT count(*) FROM public.allconnect) <> baseline_count
      OR (SELECT md5(string_agg(md5(to_jsonb(a)::text), '' ORDER BY uuid)) FROM public.allconnect a)
        IS DISTINCT FROM baseline_fingerprint
      OR (SELECT count(*) FROM public.allconnect_import_rows WHERE batch_id = batch) <> 200 THEN
      RAISE EXCEPTION 'Probe did not roll back live data and staging with skipped cleanup = %', skip_cleanup;
    END IF;
  END LOOP;
END
$safety$;

SELECT 'PASS: canonical UUID rejection and unconditional rollback with working or broken cleanup' AS result;
ROLLBACK;

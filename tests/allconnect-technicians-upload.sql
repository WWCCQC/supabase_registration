BEGIN;
SET LOCAL ROLE service_role;
DO $test$
DECLARE
  batch uuid := gen_random_uuid();
  bad_batch uuid := gen_random_uuid();
  payload jsonb;
  snapshot timestamptz;
  result record;
BEGIN
  SELECT max(update_at) INTO snapshot FROM public.allconnect_technicians;
  SELECT jsonb_object_agg(attname, '') INTO payload FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.allconnect_technicians'::regclass AND attnum > 0 AND NOT attisdropped
      AND attname NOT IN ('uuid', 'create_at', 'update_at');
  INSERT INTO public.allconnect_technicians_import_rows(batch_id, row_number, payload) VALUES
    (batch, 1, payload || '{"tech_id":"00123","tel":"0812345678","tech_name":"ทดสอบ"}'::jsonb),
    (batch, 2, payload || '{"tech_id":"00123"}'::jsonb);
  SELECT * INTO STRICT result FROM public.replace_allconnect_technicians_import(batch, snapshot, 2);
  IF result.inserted_count <> 2 OR (SELECT count(*) FROM public.allconnect_technicians) <> 2
    OR (SELECT count(*) FROM public.allconnect_technicians WHERE tech_id = '00123') <> 2 THEN
    RAISE EXCEPTION 'Replacement or duplicate preservation failed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.allconnect_technicians WHERE uuid IS NULL
    OR create_at IS DISTINCT FROM result.imported_at OR update_at IS DISTINCT FROM result.imported_at)
    OR EXISTS (SELECT 1 FROM public.allconnect_technicians_import_rows WHERE batch_id = batch) THEN
    RAISE EXCEPTION 'Audit values or cleanup failed';
  END IF;
  INSERT INTO public.allconnect_technicians_import_rows(batch_id, row_number, payload)
    VALUES (bad_batch, 1, payload || '{"extra":"invalid"}'::jsonb);
  BEGIN
    PERFORM public.replace_allconnect_technicians_import(bad_batch, result.imported_at, 1);
    RAISE EXCEPTION 'Invalid columns accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.replace_allconnect_technicians_import(bad_batch, snapshot, 1);
    RAISE EXCEPTION 'Stale snapshot accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  BEGIN
    PERFORM public.replace_allconnect_technicians_import(bad_batch, result.imported_at, 2);
    RAISE EXCEPTION 'Partial upload accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM public.allconnect_technicians) <> 2 OR
    (SELECT max(update_at) FROM public.allconnect_technicians) IS DISTINCT FROM result.imported_at THEN
    RAISE EXCEPTION 'Rejected upload changed live data';
  END IF;
  IF has_table_privilege('anon', 'public.allconnect_technicians', 'SELECT')
    OR has_table_privilege('authenticated', 'public.allconnect_technicians', 'INSERT')
    OR has_function_privilege('authenticated', 'public.replace_allconnect_technicians_import(uuid,timestamptz,integer)', 'EXECUTE')
    OR NOT has_table_privilege('authenticated', 'public.allconnect_technicians', 'SELECT') THEN
    RAISE EXCEPTION 'Unexpected read/write privileges';
  END IF;
END;
$test$;
SELECT 'PASS: replacement, duplicates, audit columns, invalid/stale/incomplete rejection, RLS grants' AS result;
ROLLBACK;

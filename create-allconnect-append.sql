-- Append complete, previously unseen work dates. Never modify existing source rows.
BEGIN;
CREATE OR REPLACE FUNCTION public.allconnect_work_date(value text)
RETURNS date LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER SET search_path = '' AS $$
DECLARE parsed date;
BEGIN
  IF btrim(value) !~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN RETURN NULL; END IF;
  parsed := pg_catalog.to_date(btrim(value), 'DD/MM/YYYY');
  IF pg_catalog.to_char(parsed, 'DD/MM/YYYY') <> btrim(value) THEN RETURN NULL; END IF;
  RETURN parsed;
EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.allconnect_work_date(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allconnect_work_date(text) TO service_role;

CREATE TABLE IF NOT EXISTS public.allconnect_import_runs (
  batch_id uuid PRIMARY KEY,
  source_key text NOT NULL UNIQUE,
  staged_count integer NOT NULL CHECK (staged_count >= 0),
  inserted_count integer NOT NULL CHECK (inserted_count >= 0),
  skipped_count integer NOT NULL CHECK (skipped_count >= 0),
  new_dates date[] NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CHECK (staged_count = inserted_count + skipped_count)
);
ALTER TABLE public.allconnect_import_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.allconnect_import_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.allconnect_import_runs TO service_role;

CREATE OR REPLACE FUNCTION public.allconnect_existing_dates()
RETURNS TABLE(work_date date) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT DISTINCT public.allconnect_work_date("PERFORMANCE_DATE") FROM public.allconnect
 WHERE public.allconnect_work_date("PERFORMANCE_DATE") IS NOT NULL ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.allconnect_existing_dates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allconnect_existing_dates() TO service_role;

CREATE OR REPLACE FUNCTION public.append_allconnect_new_dates(
 p_batch_id uuid, p_expected_count integer, p_source_key text
) RETURNS TABLE(inserted_count integer, skipped_count integer, new_dates date[], imported_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET statement_timeout = '120s' AS $$
DECLARE
 v_count integer; v_min integer; v_max integer; v_keys text[]; v_dates date[];
 v_inserted integer; v_time timestamptz := statement_timestamp(); v_receipt public.allconnect_import_runs%ROWTYPE;
BEGIN
 IF p_batch_id IS NULL OR p_expected_count IS NULL OR p_expected_count < 0
    OR p_source_key IS NULL OR length(p_source_key) NOT BETWEEN 1 AND 500 THEN
   RAISE EXCEPTION 'Invalid import manifest' USING ERRCODE='23514';
 END IF;
 -- Same advisory lock as legacy uploader, plus real table locks against any writer.
 PERFORM pg_advisory_xact_lock(hashtextextended('public.allconnect replacement', 0));
 SELECT * INTO v_receipt FROM public.allconnect_import_runs r WHERE r.source_key=p_source_key OR r.batch_id=p_batch_id;
 IF FOUND THEN
   IF v_receipt.source_key <> p_source_key OR v_receipt.staged_count <> p_expected_count THEN
     RAISE EXCEPTION 'Import manifest changed' USING ERRCODE='23514';
   END IF;
   RETURN QUERY SELECT v_receipt.inserted_count,v_receipt.skipped_count,v_receipt.new_dates,v_receipt.imported_at;
   RETURN;
 END IF;
 LOCK TABLE public.allconnect IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE public.allconnect_import_rows IN SHARE MODE;
 SELECT count(*),min(row_number),max(row_number) INTO v_count,v_min,v_max
 FROM public.allconnect_import_rows WHERE batch_id=p_batch_id;
 IF v_count <> p_expected_count OR (v_count > 0 AND (v_min <> 1 OR v_max <> v_count)) THEN
   RAISE EXCEPTION 'Incomplete staged import' USING ERRCODE='23514';
 END IF;
 SELECT array_agg(a.attname::text ORDER BY a.attname::text COLLATE pg_catalog."C") INTO v_keys
 FROM pg_catalog.pg_attribute a WHERE a.attrelid='public.allconnect'::regclass AND a.attnum>0 AND NOT a.attisdropped
 AND a.attname NOT IN ('uuid','created_at','updated_at');
 IF EXISTS (
   SELECT 1 FROM public.allconnect_import_rows s WHERE s.batch_id=p_batch_id AND (
    (SELECT array_agg(k ORDER BY k COLLATE pg_catalog."C") FROM jsonb_object_keys(s.payload) k) IS DISTINCT FROM v_keys
    OR EXISTS (SELECT 1 FROM jsonb_each(s.payload) kv WHERE jsonb_typeof(kv.value)<>'string')
    OR public.allconnect_work_date(s.payload->>'PERFORMANCE_DATE') IS NULL
    OR btrim(s.payload->>'Month') IS DISTINCT FROM to_char(public.allconnect_work_date(s.payload->>'PERFORMANCE_DATE'),'YYYY-MM')
   )
 ) THEN RAISE EXCEPTION 'Invalid source columns or work date' USING ERRCODE='23514'; END IF;
 SELECT coalesce(array_agg(d.work_date ORDER BY d.work_date),ARRAY[]::date[]) INTO v_dates FROM (
   SELECT DISTINCT public.allconnect_work_date(payload->>'PERFORMANCE_DATE') AS work_date
   FROM public.allconnect_import_rows WHERE batch_id=p_batch_id
   EXCEPT SELECT public.allconnect_work_date("PERFORMANCE_DATE") FROM public.allconnect
 ) d;
 INSERT INTO public.allconnect
 SELECT r.* FROM public.allconnect_import_rows s
 CROSS JOIN LATERAL jsonb_populate_record(NULL::public.allconnect, s.payload || jsonb_build_object(
   'uuid',gen_random_uuid(),'created_at',v_time,'updated_at',v_time)) r
 WHERE s.batch_id=p_batch_id AND public.allconnect_work_date(s.payload->>'PERFORMANCE_DATE')=ANY(v_dates)
 ORDER BY s.row_number;
 GET DIAGNOSTICS v_inserted=ROW_COUNT;
 INSERT INTO public.allconnect_import_runs(batch_id,source_key,staged_count,inserted_count,skipped_count,new_dates,imported_at)
 VALUES(p_batch_id,p_source_key,v_count,v_inserted,v_count-v_inserted,v_dates,v_time);
 DELETE FROM public.allconnect_import_rows WHERE batch_id=p_batch_id;
 RETURN QUERY SELECT v_inserted,v_count-v_inserted,v_dates,v_time;
END $$;
REVOKE ALL ON FUNCTION public.append_allconnect_new_dates(uuid,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_allconnect_new_dates(uuid,integer,text) TO service_role;

-- Preserve deployed browser/API compatibility while removing its destructive behavior.
CREATE OR REPLACE FUNCTION public.replace_allconnect_import(p_batch_id uuid,p_expected_snapshot timestamptz)
RETURNS TABLE(inserted_count integer,imported_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET statement_timeout='120s' AS $$
DECLARE v_count integer;
BEGIN
 SELECT staged_count INTO v_count FROM public.allconnect_import_runs WHERE batch_id=p_batch_id;
 IF NOT FOUND THEN
   SELECT count(*) INTO v_count FROM public.allconnect_import_rows WHERE batch_id=p_batch_id;
   IF v_count=0 THEN RAISE EXCEPTION 'Empty staged import' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN QUERY SELECT r.inserted_count,r.imported_at
 FROM public.append_allconnect_new_dates(p_batch_id,v_count,'manual:'||p_batch_id::text) r;
END $$;
REVOKE ALL ON FUNCTION public.replace_allconnect_import(uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_allconnect_import(uuid,timestamptz) TO service_role;
COMMENT ON FUNCTION public.replace_allconnect_import(uuid,timestamptz) IS
 'Legacy API name only: now appends complete missing dates; never replaces or updates existing allconnect rows.';
NOTIFY pgrst,'reload schema';
COMMIT;

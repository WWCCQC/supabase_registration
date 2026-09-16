CREATE TABLE public.allconnect_import_rows (
  batch_id uuid NOT NULL,
  row_number integer NOT NULL CHECK (row_number > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (batch_id, row_number)
);

ALTER TABLE public.allconnect_import_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.allconnect_import_rows FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.allconnect_import_rows TO service_role;

CREATE OR REPLACE FUNCTION public.replace_allconnect_import(
  p_batch_id uuid,
  p_expected_snapshot timestamptz
)
RETURNS TABLE(inserted_count integer, imported_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_count integer;
  v_min_row integer;
  v_max_row integer;
  v_current_snapshot timestamptz;
  v_imported_at timestamptz := statement_timestamp();
  v_expected_keys text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('public.allconnect replacement', 0));

  SELECT max(a.updated_at) INTO v_current_snapshot FROM public.allconnect a;
  IF v_current_snapshot IS DISTINCT FROM p_expected_snapshot THEN
    RAISE EXCEPTION 'Allconnect snapshot changed during upload' USING ERRCODE = '40001';
  END IF;

  SELECT count(*), min(row_number), max(row_number)
    INTO v_count, v_min_row, v_max_row
  FROM public.allconnect_import_rows WHERE batch_id = p_batch_id;
  IF v_count = 0 OR v_min_row <> 1 OR v_max_row <> v_count THEN
    RAISE EXCEPTION 'Staged rows are missing or non-contiguous' USING ERRCODE = '23514';
  END IF;

  -- Catalog names and JSON keys must use the same deterministic sort order.
  SELECT array_agg(a.attname::text ORDER BY a.attname::text COLLATE pg_catalog."C") INTO v_expected_keys
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = 'public.allconnect'::regclass AND a.attnum > 0 AND NOT a.attisdropped
    AND a.attname NOT IN ('uuid', 'created_at', 'updated_at');

  IF EXISTS (
    SELECT 1 FROM public.allconnect_import_rows s
    WHERE s.batch_id = p_batch_id
      AND (SELECT array_agg(k ORDER BY k COLLATE pg_catalog."C") FROM jsonb_object_keys(s.payload) k) IS DISTINCT FROM v_expected_keys
  ) THEN
    RAISE EXCEPTION 'Staged payload columns do not match allconnect' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.allconnect;
  INSERT INTO public.allconnect
  SELECT (jsonb_populate_record(
    NULL::public.allconnect,
    s.payload || jsonb_build_object('uuid', gen_random_uuid(), 'created_at', v_imported_at, 'updated_at', v_imported_at)
  )).* FROM public.allconnect_import_rows s
  WHERE s.batch_id = p_batch_id ORDER BY s.row_number;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.allconnect_import_rows WHERE batch_id = p_batch_id;
  RETURN QUERY SELECT v_count, v_imported_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_allconnect_import(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_allconnect_import(uuid, timestamptz)
  TO service_role;

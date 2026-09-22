CREATE TABLE public.allconnect_technicians (
  "area" text,
  "tech_id" text,
  "company_type" text,
  "cbm" text,
  "cbm_th" text,
  "rbm" text,
  "type_of_work" text,
  "job_accept_type" text,
  "group" text,
  "province" text,
  "depot_name" text,
  "depot_code" text,
  "team_name" text,
  "type" text,
  "team" text,
  "item" text,
  "workgroup_status" text,
  "tech_name" text,
  "tech_surename" text,
  "tech_name_eng" text,
  "tech_surename_eng" text,
  "tech_id_wfm" text,
  "register_date" text,
  "tel" text,
  "remark1" text,
  "rbm_group" text,
  "province_group" text,
  "period" text,
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  create_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  update_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
-- No source primary key: duplicate technician IDs from the workbook are retained.
CREATE UNIQUE INDEX allconnect_technicians_uuid_idx ON public.allconnect_technicians(uuid);
ALTER TABLE public.allconnect_technicians ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.allconnect_technicians FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.allconnect_technicians TO authenticated;
GRANT ALL ON public.allconnect_technicians TO service_role;
CREATE POLICY allconnect_technicians_read ON public.allconnect_technicians
  FOR SELECT TO authenticated USING (true);

CREATE FUNCTION public.set_allconnect_technicians_update_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $body$
BEGIN
  NEW.update_at := clock_timestamp();
  RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.set_allconnect_technicians_update_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER allconnect_technicians_update_at BEFORE UPDATE ON public.allconnect_technicians
  FOR EACH ROW EXECUTE FUNCTION public.set_allconnect_technicians_update_at();

CREATE TABLE public.allconnect_technicians_import_rows (
  batch_id uuid NOT NULL,
  row_number integer NOT NULL CHECK (row_number > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (batch_id, row_number)
);
ALTER TABLE public.allconnect_technicians_import_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.allconnect_technicians_import_rows FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.allconnect_technicians_import_rows TO service_role;

CREATE FUNCTION public.replace_allconnect_technicians_import(
  p_batch_id uuid, p_expected_snapshot timestamptz, p_expected_count integer
)
RETURNS TABLE(inserted_count integer, imported_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET statement_timeout = '30s'
AS $body$
DECLARE
  v_count integer;
  v_min integer;
  v_max integer;
  v_snapshot timestamptz;
  v_time timestamptz;
  v_keys text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('public.allconnect_technicians replacement', 0));
  SELECT max(update_at) INTO v_snapshot FROM public.allconnect_technicians;
  IF v_snapshot IS DISTINCT FROM p_expected_snapshot THEN
    RAISE EXCEPTION 'Technician snapshot changed' USING ERRCODE = 'PT409';
  END IF;
  SELECT count(*), min(row_number), max(row_number) INTO v_count, v_min, v_max
    FROM public.allconnect_technicians_import_rows WHERE batch_id = p_batch_id;
  IF p_expected_count IS NULL OR p_expected_count < 1 OR v_count <> p_expected_count OR v_min <> 1 OR v_max <> v_count THEN
    RAISE EXCEPTION 'Incomplete import' USING ERRCODE = '23514';
  END IF;
  SELECT array_agg(attname::text ORDER BY attname::text COLLATE pg_catalog."C") INTO v_keys
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.allconnect_technicians'::regclass AND attnum > 0 AND NOT attisdropped
      AND attname NOT IN ('uuid', 'create_at', 'update_at');
  IF EXISTS (
    SELECT 1 FROM public.allconnect_technicians_import_rows s WHERE batch_id = p_batch_id AND (
      (SELECT array_agg(k ORDER BY k COLLATE pg_catalog."C") FROM jsonb_object_keys(s.payload) k) IS DISTINCT FROM v_keys
      OR EXISTS (SELECT 1 FROM jsonb_each(s.payload) e WHERE jsonb_typeof(e.value) <> 'string')
    )
  ) THEN
    RAISE EXCEPTION 'Invalid source columns or types' USING ERRCODE = '23514';
  END IF;
  v_time := clock_timestamp();
  DELETE FROM public.allconnect_technicians WHERE true;
  INSERT INTO public.allconnect_technicians
    SELECT r.* FROM public.allconnect_technicians_import_rows s
    CROSS JOIN LATERAL jsonb_populate_record(NULL::public.allconnect_technicians,
      s.payload || jsonb_build_object('uuid', gen_random_uuid(), 'create_at', v_time, 'update_at', v_time)) r
    WHERE s.batch_id = p_batch_id ORDER BY s.row_number;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.allconnect_technicians_import_rows WHERE batch_id = p_batch_id;
  RETURN QUERY SELECT v_count, v_time;
END;
$body$;
REVOKE ALL ON FUNCTION public.replace_allconnect_technicians_import(uuid, timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_allconnect_technicians_import(uuid, timestamptz, integer) TO service_role;
NOTIFY pgrst, 'reload schema';

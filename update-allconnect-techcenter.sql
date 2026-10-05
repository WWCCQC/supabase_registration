-- Preserve the previous import before changing the active source format.
ALTER TABLE public.allconnect RENAME TO allconnect_backup_20261005;
ALTER TABLE public.allconnect_backup_20261005
  RENAME CONSTRAINT allconnect_pkey TO allconnect_backup_20261005_pkey;
REVOKE ALL ON TABLE public.allconnect_backup_20261005 FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.allconnect_backup_20261005 TO service_role;

CREATE TABLE public.allconnect (
  "Month" text,
  "PERFORMANCE_DATE" text,
  "Primary_Team_RBM" text,
  "Primary_Team_CBM" text,
  "Primary_Team_Province" text,
  "Primary_Team_District" text,
  "DEPOT" text,
  "SUB_NAME" text,
  "STAFF_ID" text,
  "STAFF_NAME" text,
  "RBM" text,
  "CBM" text,
  "PROVINCE" text,
  "District" text,
  "SubDistrict" text,
  "Group_Tech_Up" text,
  "MasterTech_team_code" text,
  "MasterTech_tech_team_type" text,
  "MasterTech_group_of_work_assign" text,
  "Job_Install" text,
  "Job_Repair" text,
  "Status_Tech" text,
  "Team_Fucntion" text,
  uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

COMMENT ON TABLE public.allconnect IS
  'Current techcenter installation/repair CSV snapshot; 23 source fields retained as text.';

CREATE TRIGGER allconnect_set_updated_at
BEFORE UPDATE ON public.allconnect
FOR EACH ROW EXECUTE FUNCTION public.allconnect_set_updated_at();

ALTER TABLE public.allconnect ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.allconnect FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.allconnect TO anon, authenticated;
GRANT ALL ON TABLE public.allconnect TO service_role;
CREATE POLICY allconnect_read ON public.allconnect
FOR SELECT TO anon, authenticated USING (true);

-- Source metadata has no filters, joins, or technician classification.
CREATE OR REPLACE FUNCTION public.allconnect_sources_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $function$
SELECT jsonb_build_object(
  'comparisonEnabled', false,
  'dataset', jsonb_build_object(
    'totalRows', (SELECT count(*) FROM public.allconnect),
    'importedAt', (SELECT max(created_at) FROM public.allconnect),
    'updatedAt', (SELECT max(updated_at) FROM public.allconnect),
    'techniciansTotalRows', (SELECT count(*) FROM public.allconnect_technicians),
    'techniciansUpdatedAt', (SELECT max(update_at) FROM public.allconnect_technicians)
  )
);
$function$;
REVOKE ALL ON FUNCTION public.allconnect_sources_status()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allconnect_sources_status()
  TO service_role;

-- Older deployed applications must stop rather than show inaccurate results.
CREATE OR REPLACE FUNCTION public.allconnect_compare_dashboard(
  p_rbm text DEFAULT NULL,
  p_status text DEFAULT 'without_work',
  p_search text DEFAULT '',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'Allconnect comparison is paused pending new calculation rules' USING ERRCODE = 'PT503';
END;
$function$;
REVOKE ALL ON FUNCTION public.allconnect_compare_dashboard(text, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allconnect_compare_dashboard(text, text, text, integer, integer)
  TO service_role;

-- Rebind replacement to the new row type. Only a completely staged, validated
-- batch replaces the active snapshot, in one transaction.
CREATE OR REPLACE FUNCTION public.replace_allconnect_import(
  p_batch_id uuid,
  p_expected_snapshot timestamptz
)
RETURNS TABLE(inserted_count integer, imported_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
SET statement_timeout = '30s'
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
    RAISE EXCEPTION 'Allconnect snapshot changed during upload' USING ERRCODE = 'PT409';
  END IF;

  SELECT count(*), min(row_number), max(row_number)
  INTO v_count, v_min_row, v_max_row
  FROM public.allconnect_import_rows WHERE batch_id = p_batch_id;
  IF v_count = 0 OR v_min_row <> 1 OR v_max_row <> v_count THEN
    RAISE EXCEPTION 'Staged rows are missing or non-contiguous' USING ERRCODE = '23514';
  END IF;

  SELECT array_agg(a.attname::text ORDER BY a.attname::text COLLATE pg_catalog."C") INTO v_expected_keys
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = 'public.allconnect'::regclass AND a.attnum > 0 AND NOT a.attisdropped
    AND a.attname NOT IN ('uuid', 'created_at', 'updated_at');
  IF EXISTS (
    SELECT 1 FROM public.allconnect_import_rows s WHERE s.batch_id = p_batch_id
    AND (SELECT array_agg(k ORDER BY k COLLATE pg_catalog."C") FROM jsonb_object_keys(s.payload) k)
      IS DISTINCT FROM v_expected_keys
  ) THEN
    RAISE EXCEPTION 'Staged payload columns do not match allconnect' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.allconnect WHERE true;
  INSERT INTO public.allconnect
  SELECT r.* FROM public.allconnect_import_rows s
  CROSS JOIN LATERAL jsonb_populate_record(NULL::public.allconnect,
    s.payload || jsonb_build_object('uuid', gen_random_uuid(), 'created_at', v_imported_at, 'updated_at', v_imported_at)
  ) AS r
  WHERE s.batch_id = p_batch_id ORDER BY s.row_number;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.allconnect_import_rows WHERE batch_id = p_batch_id;
  RETURN QUERY SELECT v_count, v_imported_at;
END;
$function$;
REVOKE ALL ON FUNCTION public.replace_allconnect_import(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_allconnect_import(uuid, timestamptz) TO service_role;
NOTIFY pgrst, 'reload schema';

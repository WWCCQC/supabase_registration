-- Regression checks run against temporary fixtures, never source data.
BEGIN;
CREATE TEMP TABLE compare_technicians (
  tech_id text, full_name text, tech_first_name text, tech_last_name text,
  "RBM" text, "CBM" text, provider text DEFAULT 'WW-Provider', depot_code text, depot_name text,
  province text, workgroup_status text DEFAULT 'หัวหน้า', status text, updated_at timestamptz, national_id text,
  provider_group_type text DEFAULT 'Install', job_accept_type text DEFAULT 'Multi Skill', card_register_date text
) ON COMMIT DROP;
CREATE TEMP TABLE compare_allconnect (
  "HANDLER_ID" text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
) ON COMMIT DROP;

DO $setup$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.allconnect_compare_dashboard(text,text,text,integer,integer)'::regprocedure);
  definition := replace(definition, 'FUNCTION public.allconnect_compare_dashboard(', 'FUNCTION pg_temp.compare_dashboard(');
  definition := replace(definition, 'FROM public.allconnect a', 'FROM pg_temp.compare_allconnect a');
  definition := replace(definition, 'FROM public.technicians t', 'FROM pg_temp.compare_technicians t');
  EXECUTE definition;
END;
$setup$;

INSERT INTO compare_technicians (tech_id, full_name, "RBM", national_id, updated_at) VALUES
  (' 001 ', 'Old record', 'R9_OLD', 'old', '2000-01-01'),
  ('001', 'Latest record', 'R1_A', 'new', '2026-01-01'),
  ('1', 'Leading zero matters', 'R2_B', 'one', '2026-01-01'),
  ('ABC', 'Alphabetic ID', 'R1_A', 'alpha', '2026-01-01'),
  ('abc', 'Case matters', 'R2_B', 'lower', '2026-01-01'),
  (NULL, 'Missing ID', 'R3_C', 'missing', '2026-01-01'),
  (' ', 'Blank ID', 'R3_C', 'blank', '2026-01-01'),
  ('NONE', '50%_Example', 'R10_D', 'none', '2026-01-01');
INSERT INTO compare_allconnect ("HANDLER_ID") VALUES ('001'), (' 001 '), (' ABC '), ('UNKNOWN'), (NULL);

UPDATE compare_technicians
SET card_register_date = CASE national_id
  WHEN 'old' THEN '2000-01-01'
  WHEN 'new' THEN '2026-01-15'
END
WHERE national_id IN ('old', 'new');

UPDATE compare_technicians
SET provider_group_type = ' Install-Repair ', workgroup_status = ' หัวหน้า ', provider = ' เถ้าแก่เทค ',
    job_accept_type = ' Install '
WHERE tech_id = 'ABC';
INSERT INTO compare_technicians (tech_id, "RBM", provider_group_type, workgroup_status) VALUES
  ('UNKNOWN', 'R99_EXCLUDED', 'Repair', 'หัวหน้า'),
  ('MEMBER', 'R99_EXCLUDED', 'Install', 'ลูกทีม'),
  ('MEMBER2', 'R99_EXCLUDED', 'Install-Repair', 'ลูกทีม'),
  ('NULL_GROUP', 'R99_EXCLUDED', NULL, 'หัวหน้า'),
  ('NULL_STATUS', 'R99_EXCLUDED', 'Install', NULL),
  ('EMPTY_GROUP', 'R99_EXCLUDED', '', 'หัวหน้า'),
  ('EMPTY_STATUS', 'R99_EXCLUDED', 'Install', ''),
  ('LOWERCASE', 'R99_EXCLUDED', 'install', 'หัวหน้า');
INSERT INTO compare_technicians (tech_id, "RBM", provider_group_type, workgroup_status, provider) VALUES
  ('OTHER_PROVIDER', 'R99_EXCLUDED', 'Install', 'หัวหน้า', 'Other'),
  ('EMPTY_PROVIDER', 'R99_EXCLUDED', 'Install', 'หัวหน้า', ''),
  ('NULL_PROVIDER', 'R99_EXCLUDED', 'Install-Repair', 'หัวหน้า', NULL),
  ('LOWER_PROVIDER', 'R99_EXCLUDED', 'Install', 'หัวหน้า', 'ww-provider');
INSERT INTO compare_technicians (tech_id, "RBM", provider_group_type, workgroup_status, provider, job_accept_type) VALUES
  ('REPAIR_JOB', 'R99_EXCLUDED', 'Install', 'หัวหน้า', 'WW-Provider', 'Repair'),
  ('EMPTY_JOB', 'R99_EXCLUDED', 'Install', 'หัวหน้า', 'WW-Provider', ''),
  ('NULL_JOB', 'R99_EXCLUDED', 'Install-Repair', 'หัวหน้า', 'เถ้าแก่เทค', NULL),
  ('LOWER_JOB', 'R99_EXCLUDED', 'Install', 'หัวหน้า', 'WW-Provider', 'install');

UPDATE compare_technicians
SET depot_code = CASE
      WHEN national_id IN ('old', 'new', 'alpha') THEN 'D-A'
      WHEN national_id IN ('one', 'lower') THEN 'D-B'
      WHEN national_id IN ('missing', 'blank') THEN 'D-C'
      WHEN national_id = 'none' THEN 'D-D'
    END,
    depot_name = CASE
      WHEN national_id IN ('old', 'new', 'alpha') THEN 'Depot Alpha'
      WHEN national_id IN ('one', 'lower') THEN 'Depot Beta'
      WHEN national_id IN ('missing', 'blank') THEN 'Depot Gamma'
      WHEN national_id = 'none' THEN 'Depot Delta'
    END
WHERE national_id IS NOT NULL;

DO $tests$
DECLARE d jsonb;
BEGIN
  d := pg_temp.compare_dashboard(NULL, 'all', '', 1, 50);
  IF jsonb_array_length(d->'rows') <> 7 OR jsonb_array_length(d->'regions') <> 4
     OR (d->'pagination'->>'total')::int <> 7 THEN
    RAISE EXCEPTION 'Only eligible provider, group, job type and leader technicians should appear in rows, regions and pagination';
  END IF;
  IF d->'summary' <> '{"total":7,"withWork":2,"withoutWork":3,"pending":2,"jobCount":3,"coverage":40.0}'::jsonb THEN
    RAISE EXCEPTION 'ID normalization, deduplication or summary incorrect: %', d->'summary';
  END IF;
  IF (d->'dataset'->>'unknownHandlers')::int <> 1 OR (d->'dataset'->>'missingHandlerRows')::int <> 1
     OR (d->'dataset'->>'duplicateTechIds')::int <> 1 OR (d->'dataset'->>'missingTechIds')::int <> 2 THEN
    RAISE EXCEPTION 'Data quality counts incorrect';
  END IF;
  IF d->'regions'->0->>'rbm' <> 'R1_A' OR d->'regions'->3->>'rbm' <> 'R10_D' THEN
    RAISE EXCEPTION 'RBM order incorrect';
  END IF;
  IF d->'depots' IS NULL OR jsonb_array_length(d->'depots') <> 4
     OR d->'depots'->0->>'depotCode' <> 'D-B' OR (d->'depots'->0->>'withoutWork')::int <> 2
     OR d->'depots'->1->>'depotCode' <> 'D-D' OR (d->'depots'->1->>'withoutWork')::int <> 1
     OR d->'depots'->2->>'depotCode' <> 'D-A' OR (d->'depots'->2->>'withWork')::int <> 2
     OR d->'depots'->3->>'depotCode' <> 'D-C' OR (d->'depots'->3->>'pending')::int <> 2 THEN
    RAISE EXCEPTION 'Depot totals or descending without-work order incorrect: %', d->'depots';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d->'rows') r WHERE r->>'techId'='001' AND r->>'fullName'='Latest record'
     AND r->>'cardRegisterDate'='2026-01-15' AND (r->>'jobCount')::int=2) THEN
    RAISE EXCEPTION 'Latest duplicate registration, register date or repeated job count incorrect';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(d->'depots') depot
    WHERE depot->'withoutWorkTechnicians' IS NULL
       OR jsonb_array_length(depot->'withoutWorkTechnicians') <> (depot->>'withoutWork')::int) THEN
    RAISE EXCEPTION 'Depot child counts must match without-work totals';
  END IF;
  IF (SELECT array_agg(child->>'techId' ORDER BY child->>'techId')
      FROM jsonb_array_elements(d->'depots'->0->'withoutWorkTechnicians') child) IS DISTINCT FROM ARRAY['1', 'abc'] THEN
    RAISE EXCEPTION 'Depot children must include only its technicians without work';
  END IF;

  d := pg_temp.compare_dashboard('R2_B', 'without_work', '', 999, 1);
  IF (d->'summary'->>'total')::int <> 2 OR (d->'pagination'->>'total')::int <> 2
     OR (d->'pagination'->>'page')::int <> 2 OR jsonb_array_length(d->'rows') <> 1 THEN
    RAISE EXCEPTION 'RBM filter, status filter or pagination incorrect';
  END IF;

  d := pg_temp.compare_dashboard(NULL, 'without_work', '%_', 1, 50);
  IF (d->'pagination'->>'total')::int <> 1 OR d->'rows'->0->>'techId' <> 'NONE' THEN
    RAISE EXCEPTION 'Search did not treat wildcard characters literally';
  END IF;
  d := pg_temp.compare_dashboard(NULL, 'without_work', 'Does not exist', 1, 50);
  IF (d->'pagination'->>'total')::int <> 0 OR d->'rows' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Empty search result incorrect';
  END IF;

  TRUNCATE pg_temp.compare_allconnect;
  d := pg_temp.compare_dashboard(NULL, 'all', '', 1, 50);
  IF (d->'summary'->>'withoutWork')::int <> 0 OR (d->'summary'->>'pending')::int <> 7
     OR d->'summary'->>'coverage' IS NOT NULL THEN
    RAISE EXCEPTION 'Empty Allconnect must not classify technicians as without work';
  END IF;
END;
$tests$;

SELECT 'PASS: text IDs, latest duplicate, missing IDs, repeated jobs, unknown handlers, RBM totals/order, pagination, literal search and empty import' AS result;
ROLLBACK;

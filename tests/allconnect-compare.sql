-- Regression checks run against temporary fixtures, never source data.
BEGIN;
CREATE TEMP TABLE compare_technicians (
  tech_id text, full_name text, tech_first_name text, tech_last_name text,
  "RBM" text, "CBM" text, provider text, depot_code text, depot_name text,
  province text, workgroup_status text, status text, updated_at timestamptz, national_id text
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

DO $tests$
DECLARE d jsonb;
BEGIN
  d := pg_temp.compare_dashboard(NULL, 'all', '', 1, 50);
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
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d->'rows') r WHERE r->>'techId'='001' AND r->>'fullName'='Latest record' AND (r->>'jobCount')::int=2) THEN
    RAISE EXCEPTION 'Latest duplicate registration or repeated job count incorrect';
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

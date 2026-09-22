-- Regression checks run against temporary fixtures, never source data.
BEGIN;
CREATE TEMP TABLE compare_allconnect_technicians (
  tech_id text, tech_name text, tech_surename text, register_date text,
  rbm text, cbm text, company_type text, depot_code text, depot_name text,
  province text, workgroup_status text, type_of_work text, job_accept_type text,
  update_at timestamptz, uuid text
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
  definition := replace(definition, 'FROM public.allconnect_technicians t', 'FROM pg_temp.compare_allconnect_technicians t');
  EXECUTE definition;
END;
$setup$;

INSERT INTO compare_allconnect_technicians (
  tech_id, tech_name, tech_surename, register_date, rbm, cbm, company_type,
  depot_code, depot_name, province, workgroup_status, type_of_work, job_accept_type, update_at, uuid
) VALUES
  (' 001 ', 'ช่างเก่า', 'หนึ่ง', '01/01/2020', 'R9_OLD', 'OLD', 'Old company', 'D-OLD', 'Old depot', 'กรุงเทพฯ', 'หัวหน้า', 'Installation', 'เก่า', '2000-01-01', 'old'),
  ('001', 'ช่างใหม่', 'หนึ่ง', '15/01/2026', 'R1_A', 'CBM-A', 'Company A', 'D-A', 'Depot Alpha', 'กรุงเทพฯ', 'หัวหน้า', 'Installation', 'ประจำ', '2026-09-12 07:08:09+00', 'new'),
  ('1', 'เลขศูนย์', 'สำคัญ', '16/01/2026', 'R2_B', 'CBM-B', 'Company B', 'D-B', 'Depot Beta', 'นนทบุรี', 'หัวหน้า', 'Installation', 'ประจำ', '2026-01-01', 'one'),
  ('ABC', 'ตัวอักษร', 'ใหญ่', '17/01/2026', 'R1_A', 'CBM-A', 'Company A', 'D-A', 'Depot Alpha', 'กรุงเทพฯ', 'หัวหน้า', 'Installation', 'ประจำ', '2026-01-01', 'alpha'),
  (NULL, 'ไม่มี', 'รหัส', '', 'R3_C', 'CBM-C', 'Company C', 'D-C', 'Depot Gamma', 'ชลบุรี', 'หัวหน้า', 'Installation', 'ประจำ', '2026-01-01', 'missing'),
  ('NONE', 'ไม่มีงาน', 'ตัวอย่าง', '18/01/2026', 'R10_D', 'CBM-D', 'Company D', 'D-D', 'Depot Delta', 'เชียงใหม่', 'หัวหน้า', 'Installation', 'ประจำ', '2026-01-01', 'none'),
  ('MEMBER', 'ต้อง', 'ไม่แสดง', '19/01/2026', 'R99_EXCLUDED', 'CBM-X', 'Company X', 'D-X', 'Depot X', 'ภูเก็ต', 'ลูกน้อง', 'Installation', 'ประจำ', '2026-01-01', 'member'),
  ('REPAIR', 'ต้อง', 'ไม่แสดง', '19/01/2026', 'R99_EXCLUDED', 'CBM-X', 'Company X', 'D-X', 'Depot X', 'ภูเก็ต', 'หัวหน้า', 'Repair', 'ประจำ', '2026-01-01', 'repair');

INSERT INTO compare_allconnect ("HANDLER_ID", created_at, updated_at) VALUES
  ('001', '2026-09-10 01:02:03+00', '2026-09-11 04:05:06+00'),
  (' 001 ', '2026-09-10 01:02:03+00', '2026-09-11 04:05:06+00'),
  (' ABC ', '2026-09-10 01:02:03+00', '2026-09-11 04:05:06+00'),
  ('REPAIR', '2026-09-10 01:02:03+00', '2026-09-11 04:05:06+00'),
  (NULL, '2026-09-10 01:02:03+00', '2026-09-11 04:05:06+00');

DO $tests$
DECLARE d jsonb;
BEGIN
  d := pg_temp.compare_dashboard(NULL, 'all', '', 1, 50);
  IF d->'summary' <> '{"total":5,"withWork":2,"withoutWork":2,"pending":1,"jobCount":3,"coverage":50.0}'::jsonb THEN
    RAISE EXCEPTION 'Installation filter, matching or summary incorrect: %', d->'summary';
  END IF;
  IF (d->'dataset'->>'unknownHandlers')::int <> 1
     OR (d->'dataset'->>'missingHandlerRows')::int <> 1
     OR (d->'dataset'->>'duplicateTechIds')::int <> 1
     OR (d->'dataset'->>'missingTechIds')::int <> 1 THEN
    RAISE EXCEPTION 'Data quality counts incorrect: %', d->'dataset';
  END IF;
  IF (d->'dataset'->>'updatedAt')::timestamptz <> '2026-09-11 04:05:06+00'::timestamptz
     OR (d->'dataset'->>'techniciansUpdatedAt')::timestamptz <> '2026-09-12 07:08:09+00'::timestamptz THEN
    RAISE EXCEPTION 'Source update timestamps must be tracked separately: %', d->'dataset';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(d->'rows') r WHERE r->>'techId' IN ('MEMBER', 'REPAIR')) THEN
    RAISE EXCEPTION 'Non-leader and non-Installation technicians must be excluded';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(d->'rows') r
    WHERE r->>'techId' = '001'
      AND r->>'fullName' = 'ช่างใหม่ หนึ่ง'
      AND r->>'cardRegisterDate' = '15/01/2026'
      AND r->>'rbm' = 'R1_A'
      AND r->>'cbm' = 'CBM-A'
      AND r->>'provider' = 'Company A'
      AND r->>'depotCode' = 'D-A'
      AND r->>'depotName' = 'Depot Alpha'
      AND r->>'technicianStatus' = 'หัวหน้า'
      AND (r->>'jobCount')::int = 2
  ) THEN
    RAISE EXCEPTION 'New source mapping or latest duplicate selection incorrect';
  END IF;
  IF d->'regions'->0->>'rbm' <> 'R1_A' OR d->'regions'->3->>'rbm' <> 'R10_D' THEN
    RAISE EXCEPTION 'RBM ordering incorrect: %', d->'regions';
  END IF;
  IF d->'depots'->0->>'depotCode' NOT IN ('D-B', 'D-D')
     OR (d->'depots'->0->>'withoutWork')::int <> 1 THEN
    RAISE EXCEPTION 'Depot totals incorrect: %', d->'depots';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(d->'depots') depot
    CROSS JOIN LATERAL jsonb_array_elements(depot->'withoutWorkTechnicians') technician
    WHERE technician->>'techId' = '1'
      AND technician->>'fullName' = 'เลขศูนย์ สำคัญ'
      AND technician->>'typeOfWork' = 'Installation'
      AND technician->>'jobAcceptType' = 'ประจำ'
  ) THEN
    RAISE EXCEPTION 'Expanded Depot technician fields incorrect: %', d->'depots';
  END IF;

  d := pg_temp.compare_dashboard('R2_B', 'without_work', 'เลขศูนย์', 99, 1);
  IF (d->'summary'->>'total')::int <> 1
     OR (d->'pagination'->>'total')::int <> 1
     OR d->'rows'->0->>'techId' <> '1' THEN
    RAISE EXCEPTION 'RBM, status, search or pagination filter incorrect: %', d;
  END IF;

  TRUNCATE pg_temp.compare_allconnect;
  d := pg_temp.compare_dashboard(NULL, 'all', '', 1, 50);
  IF (d->'summary'->>'withoutWork')::int <> 0
     OR (d->'summary'->>'pending')::int <> 5
     OR d->'summary'->>'coverage' IS NOT NULL THEN
    RAISE EXCEPTION 'Empty Allconnect must leave technicians pending: %', d->'summary';
  END IF;
END;
$tests$;

SELECT 'PASS: allconnect_technicians mapping, Installation leader filters, matching, regions, depots and pagination' AS result;
ROLLBACK;

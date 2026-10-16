-- Split Allconnect compare dashboard into smaller RPCs so the page only recomputes what changed:
--   allconnect_compare_summary            cards, charts, region/depot tables (reload on month/RBM change)
--   allconnect_compare_rows               technician detail table page        (reload on page/status/search)
--   allconnect_compare_depot_technicians  technicians without work in a depot (loaded when a depot is expanded)
-- Business rules are identical to public.allconnect_compare_jobs_dashboard (create-allconnect-jobs-dashboard.sql).
-- IDs remain text: trim boundary whitespace, never cast to a number.
-- Functions are plpgsql so each call is planned with the actual filter values (lets the indexes below be used).

-- 1) Indexes -----------------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS allconnect_month_btrim_idx ON public.allconnect (btrim("Month"));
CREATE INDEX IF NOT EXISTS allconnect_staff_id_btrim_idx ON public.allconnect (btrim("STAFF_ID"));
CREATE INDEX IF NOT EXISTS allconnect_technicians_status_btrim_idx ON public.allconnect_technicians (btrim(workgroup_status));
CREATE INDEX IF NOT EXISTS allconnect_technicians_tech_id_btrim_idx ON public.allconnect_technicians (btrim(tech_id));
ANALYZE public.allconnect;
ANALYZE public.allconnect_technicians;

-- 2) Shared head list ----------------------------------------------------------------------------------------
-- Every row of a head ('หัวหน้า'); id_rank = 1 is the most recently updated registration for a tech_id.
CREATE OR REPLACE FUNCTION public.allconnect_compare_heads()
RETURNS TABLE (
  tech_id text, full_name text, card_register_date text, rbm text, cbm text, provider text,
  depot_code text, depot_name text, province text, type_of_work text, job_accept_type text,
  technician_status text, id_rank bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT nullif(btrim(t.tech_id), ''),
         coalesce(nullif(btrim(concat_ws(' ', nullif(btrim(t.tech_name), ''), nullif(btrim(t.tech_surename), ''))), ''), '-'),
         coalesce(nullif(btrim(t.register_date), ''), ''),
         coalesce(nullif(btrim(t.rbm), ''), 'ไม่ระบุพื้นที่'),
         coalesce(t.cbm, ''),
         coalesce(t.company_type, ''),
         coalesce(t.depot_code, ''),
         coalesce(t.depot_name, ''),
         coalesce(t.province, ''),
         coalesce(t.type_of_work, ''),
         coalesce(t.job_accept_type, ''),
         coalesce(t.workgroup_status, ''),
         row_number() OVER (PARTITION BY nullif(btrim(t.tech_id), '') ORDER BY t.update_at DESC NULLS LAST, t.uuid)
  FROM public.allconnect_technicians t
  WHERE btrim(t.workgroup_status) = 'หัวหน้า'
$function$;

-- 3) Summary: cards, charts, regions, depots (without technician lists) ------------------------------------------
CREATE OR REPLACE FUNCTION public.allconnect_compare_summary(
  p_rbm text DEFAULT NULL,
  p_month text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF nullif(p_month, '') IS NULL THEN p_month := NULL; END IF;
  IF nullif(p_rbm, '') IS NULL THEN p_rbm := NULL; END IF;
  RETURN (
    WITH job_source AS MATERIALIZED (
      SELECT nullif(btrim(a."STAFF_ID"), '') AS handler_id, a."Job_Install", a."Job_Repair", a.created_at, a.updated_at,
        CASE WHEN btrim(a."Job_Install") ~ '^[0-9]+$' THEN btrim(a."Job_Install")::numeric ELSE 0 END AS install_count,
        CASE WHEN btrim(a."Job_Repair") ~ '^[0-9]+$' THEN btrim(a."Job_Repair")::numeric ELSE 0 END AS repair_count
      FROM public.allconnect a
      WHERE p_month IS NULL OR btrim(a."Month") = p_month
    ), source_meta AS (
      SELECT count(*) AS total_rows,
             count(*) FILTER (WHERE handler_id IS NULL) AS missing_handler_rows,
             max(created_at) AS imported_at, max(updated_at) AS updated_at,
             (SELECT max(t.update_at) FROM public.allconnect_technicians t) AS technicians_updated_at,
             count(*) FILTER (WHERE (nullif(btrim("Job_Install"), '') IS NOT NULL AND btrim("Job_Install") !~ '^[0-9]+$')
                                 OR (nullif(btrim("Job_Repair"), '') IS NOT NULL AND btrim("Job_Repair") !~ '^[0-9]+$')) AS invalid_job_rows
      FROM job_source
    ), jobs AS (
      SELECT handler_id, sum(install_count) AS install_count, sum(repair_count) AS repair_count,
             sum(install_count + repair_count) AS job_count
      FROM job_source WHERE handler_id IS NOT NULL GROUP BY 1
    ), source_tech AS MATERIALIZED (
      SELECT * FROM public.allconnect_compare_heads()
    ), tech AS (
      SELECT * FROM source_tech WHERE tech_id IS NULL OR id_rank = 1
    ), compared AS MATERIALIZED (
      SELECT t.*, coalesce(j.job_count, 0) AS job_count,
             coalesce(j.install_count, 0) AS install_count, coalesce(j.repair_count, 0) AS repair_count,
             CASE WHEN m.total_rows = 0 OR t.tech_id IS NULL THEN 'pending'
                  WHEN j.job_count > 0 THEN 'with_work'
                  ELSE 'without_work' END AS work_status
      FROM tech t CROSS JOIN source_meta m
      LEFT JOIN jobs j ON j.handler_id = t.tech_id
    ), scoped AS (
      SELECT * FROM compared WHERE p_rbm IS NULL OR rbm = p_rbm
    ), summary AS (
      SELECT count(*) AS total,
             count(*) FILTER (WHERE work_status = 'with_work') AS with_work,
             count(*) FILTER (WHERE work_status = 'without_work') AS without_work,
             count(*) FILTER (WHERE work_status = 'pending') AS pending,
             coalesce(sum(job_count), 0) AS job_count,
             coalesce(sum(install_count), 0) AS install_count, coalesce(sum(repair_count), 0) AS repair_count
      FROM scoped
    ), regions AS (
      SELECT rbm, count(*) AS total,
             count(*) FILTER (WHERE work_status = 'with_work') AS with_work,
             count(*) FILTER (WHERE work_status = 'without_work') AS without_work,
             count(*) FILTER (WHERE work_status = 'pending') AS pending,
             coalesce(sum(job_count), 0) AS job_count,
             coalesce(sum(install_count), 0) AS install_count, coalesce(sum(repair_count), 0) AS repair_count
      FROM compared GROUP BY rbm
    ), depots AS (
      SELECT rbm,
             coalesce(nullif(btrim(depot_code), ''), '-') AS depot_code,
             coalesce(nullif(btrim(depot_name), ''), '-') AS depot_name,
             count(*) AS total,
             count(*) FILTER (WHERE work_status = 'with_work') AS with_work,
             count(*) FILTER (WHERE work_status = 'without_work') AS without_work,
             count(*) FILTER (WHERE work_status = 'pending') AS pending,
             coalesce(sum(job_count), 0) AS job_count,
             coalesce(sum(install_count), 0) AS install_count, coalesce(sum(repair_count), 0) AS repair_count
      FROM compared
      GROUP BY 1, 2, 3
    ), monthly_source AS MATERIALIZED (
      -- Monthly trend ignores p_month so every month stays visible.
      -- The month comes from PERFORMANCE_DATE (DD/MM/YYYY), not the uploaded Month column.
      SELECT btrim(a."PERFORMANCE_DATE") AS performance_date, nullif(btrim(a."STAFF_ID"), '') AS handler_id,
        btrim(a."Month") AS upload_month,
        sum(CASE WHEN btrim(a."Job_Install") ~ '^[0-9]+$' THEN btrim(a."Job_Install")::numeric ELSE 0 END
          + CASE WHEN btrim(a."Job_Repair") ~ '^[0-9]+$' THEN btrim(a."Job_Repair")::numeric ELSE 0 END) AS completed_jobs
      FROM public.allconnect a
      GROUP BY 1, 2, 3
    ), dataset_months AS (
      SELECT DISTINCT upload_month AS work_month
      FROM monthly_source WHERE upload_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    ), monthly_dates AS MATERIALIZED (
      SELECT value,
        CASE WHEN value ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          AND pg_input_is_valid(concat(substring(value, 7, 4), '-', substring(value, 4, 2), '-', substring(value, 1, 2)), 'date')
          THEN concat(substring(value, 7, 4), '-', substring(value, 4, 2), '-', substring(value, 1, 2))::date
          ELSE NULL END AS work_date
      FROM (SELECT DISTINCT performance_date AS value FROM monthly_source) dates
    ), performance_months AS (
      SELECT DISTINCT to_char(work_date, 'YYYY-MM') AS work_month FROM monthly_dates WHERE work_date IS NOT NULL
    ), monthly_jobs AS MATERIALIZED (
      SELECT to_char(d.work_date, 'YYYY-MM') AS work_month, s.handler_id
      FROM monthly_source s JOIN monthly_dates d ON d.value = s.performance_date
      WHERE d.work_date IS NOT NULL AND s.handler_id IS NOT NULL
      GROUP BY 1, 2
      HAVING sum(s.completed_jobs) > 0
    ), monthly AS (
      SELECT m.work_month, count(*) AS total,
             count(*) FILTER (WHERE s.tech_id IS NOT NULL AND j.handler_id IS NOT NULL) AS with_work,
             count(*) FILTER (WHERE s.tech_id IS NOT NULL AND j.handler_id IS NULL) AS without_work,
             count(*) FILTER (WHERE s.tech_id IS NULL) AS pending
      FROM performance_months m
      CROSS JOIN (SELECT tech_id FROM scoped) s
      LEFT JOIN monthly_jobs j ON j.handler_id = s.tech_id AND j.work_month = m.work_month
      GROUP BY m.work_month
    ), monthly_company_types AS (
      SELECT m.work_month,
             coalesce(nullif(btrim(s.provider), ''), 'ไม่ระบุประเภท') AS company_type,
             count(*) FILTER (WHERE s.tech_id IS NOT NULL AND j.handler_id IS NULL) AS without_work
      FROM performance_months m
      CROSS JOIN (SELECT tech_id, provider FROM scoped) s
      LEFT JOIN monthly_jobs j ON j.handler_id = s.tech_id AND j.work_month = m.work_month
      GROUP BY m.work_month, coalesce(nullif(btrim(s.provider), ''), 'ไม่ระบุประเภท')
    )
    SELECT jsonb_build_object(
      'dataset', (SELECT jsonb_build_object(
        'totalRows', m.total_rows, 'importedAt', m.imported_at, 'updatedAt', m.updated_at,
        'techniciansUpdatedAt', m.technicians_updated_at,
        'missingHandlerRows', m.missing_handler_rows,
        'unknownHandlers', (SELECT count(*) FROM jobs j WHERE NOT EXISTS (SELECT 1 FROM tech t WHERE t.tech_id = j.handler_id)),
        'missingTechIds', (SELECT count(*) FROM tech WHERE tech_id IS NULL),
        'duplicateTechIds', (SELECT count(*) FROM source_tech WHERE tech_id IS NOT NULL AND id_rank > 1),
        'months', (SELECT coalesce(jsonb_agg(work_month ORDER BY work_month), '[]'::jsonb) FROM dataset_months),
        'invalidJobRows', m.invalid_job_rows
      ) FROM source_meta m),
      'summary', (SELECT jsonb_build_object(
        'total', s.total, 'withWork', s.with_work, 'withoutWork', s.without_work,
        'pending', s.pending, 'jobCount', s.job_count, 'installCount', s.install_count, 'repairCount', s.repair_count,
        'coverage', round(100.0 * s.with_work / nullif(s.with_work + s.without_work, 0), 1)
      ) FROM summary s),
      'regions', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'rbm', r.rbm, 'total', r.total, 'withWork', r.with_work, 'withoutWork', r.without_work,
        'pending', r.pending, 'jobCount', r.job_count, 'installCount', r.install_count, 'repairCount', r.repair_count,
        'coverage', round(100.0 * r.with_work / nullif(r.with_work + r.without_work, 0), 1)
      ) ORDER BY substring(r.rbm FROM '^R([0-9]+)')::integer NULLS LAST, r.rbm) FROM regions r), '[]'::jsonb),
      'monthly', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'month', mo.work_month, 'total', mo.total, 'withWork', mo.with_work,
        'withoutWork', mo.without_work, 'pending', mo.pending,
        'coverage', round(100.0 * mo.with_work / nullif(mo.with_work + mo.without_work, 0), 1)
      ) ORDER BY mo.work_month) FROM monthly mo), '[]'::jsonb),
      'monthlyByCompanyType', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'month', mt.work_month, 'companyType', mt.company_type, 'withoutWork', mt.without_work
      ) ORDER BY mt.company_type, mt.work_month) FROM monthly_company_types mt), '[]'::jsonb),
      'depots', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'rbm', d.rbm, 'depotCode', d.depot_code, 'depotName', d.depot_name,
        'total', d.total, 'withWork', d.with_work, 'withoutWork', d.without_work,
        'pending', d.pending, 'jobCount', d.job_count, 'installCount', d.install_count, 'repairCount', d.repair_count,
        'coverage', round(100.0 * d.with_work / nullif(d.with_work + d.without_work, 0), 1)
      ) ORDER BY d.without_work DESC, d.total DESC,
                 substring(d.rbm FROM '^R([0-9]+)')::integer NULLS LAST,
                 d.rbm, d.depot_code, d.depot_name) FROM depots d), '[]'::jsonb)
    )
  );
END;
$function$;

-- 4) Detail rows: one page of technicians plus weekly job counts for that page only -----------------------------
CREATE OR REPLACE FUNCTION public.allconnect_compare_rows(
  p_rbm text DEFAULT NULL,
  p_status text DEFAULT 'without_work',
  p_search text DEFAULT '',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_month text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF nullif(p_month, '') IS NULL THEN p_month := NULL; END IF;
  IF nullif(p_rbm, '') IS NULL THEN p_rbm := NULL; END IF;
  p_search := lower(coalesce(btrim(p_search), ''));
  p_status := coalesce(p_status, 'all');
  RETURN (
    WITH job_source AS MATERIALIZED (
      SELECT nullif(btrim(a."STAFF_ID"), '') AS handler_id, btrim(a."PERFORMANCE_DATE") AS performance_date,
        a.created_at, a.updated_at,
        CASE WHEN btrim(a."Job_Install") ~ '^[0-9]+$' THEN btrim(a."Job_Install")::numeric ELSE 0 END
          + CASE WHEN btrim(a."Job_Repair") ~ '^[0-9]+$' THEN btrim(a."Job_Repair")::numeric ELSE 0 END AS completed_jobs,
        CASE WHEN btrim(a."Job_Install") ~ '^[0-9]+$' THEN btrim(a."Job_Install")::numeric ELSE 0 END AS install_count,
        CASE WHEN btrim(a."Job_Repair") ~ '^[0-9]+$' THEN btrim(a."Job_Repair")::numeric ELSE 0 END AS repair_count
      FROM public.allconnect a
      WHERE p_month IS NULL OR btrim(a."Month") = p_month
    ), source_meta AS (
      SELECT count(*) AS total_rows, max(created_at) AS imported_at, max(updated_at) AS updated_at,
             (SELECT max(t.update_at) FROM public.allconnect_technicians t) AS technicians_updated_at
      FROM job_source
    ), jobs AS (
      SELECT handler_id, sum(install_count) AS install_count, sum(repair_count) AS repair_count,
             sum(completed_jobs) AS job_count
      FROM job_source WHERE handler_id IS NOT NULL GROUP BY 1
    ), tech AS (
      SELECT * FROM public.allconnect_compare_heads() h WHERE h.tech_id IS NULL OR h.id_rank = 1
    ), filtered AS MATERIALIZED (
      SELECT t.*, coalesce(j.job_count, 0) AS job_count,
             coalesce(j.install_count, 0) AS install_count, coalesce(j.repair_count, 0) AS repair_count,
             w.work_status
      FROM tech t CROSS JOIN source_meta m
      LEFT JOIN jobs j ON j.handler_id = t.tech_id
      CROSS JOIN LATERAL (SELECT CASE WHEN m.total_rows = 0 OR t.tech_id IS NULL THEN 'pending'
                                      WHEN j.job_count > 0 THEN 'with_work'
                                      ELSE 'without_work' END AS work_status) w
      WHERE (p_rbm IS NULL OR t.rbm = p_rbm)
        AND (p_status = 'all' OR w.work_status = p_status)
        AND (p_search = '' OR strpos(
          lower(concat_ws(' ', t.tech_id, t.full_name, t.rbm, t.cbm, t.provider, t.depot_code, t.depot_name, t.province, t.technician_status)),
          p_search) > 0)
    ), page_counts AS (
      SELECT count(*) AS total, greatest(1, least(coalesce(p_page_size, 50), 500)) AS page_size FROM filtered
    ), paging AS (
      SELECT *, greatest(1, ceil(total::numeric / page_size)::integer) AS total_pages,
             least(greatest(1, coalesce(p_page, 1)), greatest(1, ceil(total::numeric / page_size)::integer)) AS page
      FROM page_counts
    ), page_rows AS MATERIALIZED (
      SELECT * FROM filtered
      -- Detail table: RBM in natural order (R1, R2 … R10), grouped by Depot, then technician.
      ORDER BY substring(rbm FROM '^R([0-9]+)')::integer NULLS LAST, rbm NULLS LAST,
               depot_code NULLS LAST, depot_name NULLS LAST, full_name, tech_id NULLS LAST
      LIMIT (SELECT page_size FROM paging)
      OFFSET (SELECT (page - 1) * page_size FROM paging)
    ), performance_dates AS MATERIALIZED (
      -- Parse once per distinct date instead of repeating it for every job row.
      SELECT value,
        CASE WHEN value ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          AND pg_input_is_valid(concat(substring(value, 7, 4), '-', substring(value, 4, 2), '-', substring(value, 1, 2)), 'date')
          THEN concat(substring(value, 7, 4), '-', substring(value, 4, 2), '-', substring(value, 1, 2))::date
          ELSE NULL END AS work_date
      FROM (SELECT DISTINCT performance_date AS value FROM job_source) dates
    ), work_periods AS (
      -- Only periods present in the uploaded data are eligible for comparison.
      SELECT DISTINCT to_char(work_date, 'YYYY-MM') AS work_month,
        date_trunc('week', work_date::timestamp)::date AS week_start
      FROM performance_dates WHERE work_date IS NOT NULL
    ), page_weekly AS (
      -- Weekly totals only for technicians shown on this page.
      SELECT a.handler_id AS tech_id, to_char(d.work_date, 'YYYY-MM') AS work_month,
        date_trunc('week', d.work_date::timestamp)::date AS week_start, sum(a.completed_jobs) AS completed_jobs
      FROM job_source a JOIN performance_dates d ON d.value = a.performance_date
      WHERE d.work_date IS NOT NULL AND a.handler_id IN (SELECT tech_id FROM page_rows WHERE tech_id IS NOT NULL)
      GROUP BY 1, 2, 3
    ), all_weekly_jobs AS (
      SELECT p.tech_id, jsonb_agg(jsonb_build_object(
        'month', w.work_month, 'weekStart', w.week_start,
        'weekEnd', w.week_start + 6, 'weekNumber', extract(week FROM w.week_start)::integer,
        'jobCount', coalesce(j.completed_jobs, 0)
      ) ORDER BY w.work_month, w.week_start) AS periods
      FROM (SELECT DISTINCT tech_id FROM page_rows) p CROSS JOIN work_periods w
      LEFT JOIN page_weekly j ON j.tech_id = p.tech_id
        AND j.work_month = w.work_month AND j.week_start = w.week_start
      GROUP BY p.tech_id
    )
    SELECT jsonb_build_object(
      'dataset', (SELECT jsonb_build_object(
        'totalRows', m.total_rows, 'importedAt', m.imported_at, 'updatedAt', m.updated_at,
        'techniciansUpdatedAt', m.technicians_updated_at,
        'workPeriods', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'month', w.work_month, 'weekStart', w.week_start, 'weekEnd', w.week_start + 6,
          'weekNumber', extract(week FROM w.week_start)::integer
        ) ORDER BY w.work_month, w.week_start), '[]'::jsonb) FROM work_periods w)
      ) FROM source_meta m),
      'rows', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'techId', p.tech_id, 'fullName', p.full_name, 'cardRegisterDate', p.card_register_date,
        'rbm', p.rbm, 'cbm', p.cbm,
        'provider', p.provider, 'depotCode', p.depot_code, 'depotName', p.depot_name,
        'province', p.province, 'technicianStatus', p.technician_status,
        'jobCount', p.job_count, 'installCount', p.install_count, 'repairCount', p.repair_count, 'workStatus', p.work_status,
        'weeklyJobs', coalesce((SELECT n.periods FROM all_weekly_jobs n WHERE n.tech_id IS NOT DISTINCT FROM p.tech_id), '[]'::jsonb)
      ) ORDER BY substring(p.rbm FROM '^R([0-9]+)')::integer NULLS LAST, p.rbm NULLS LAST,
                 p.depot_code NULLS LAST, p.depot_name NULLS LAST, p.full_name, p.tech_id NULLS LAST) FROM page_rows p), '[]'::jsonb),
      'pagination', (SELECT jsonb_build_object('total', total, 'page', page, 'pageSize', page_size, 'totalPages', total_pages) FROM paging)
    )
  );
END;
$function$;

-- 5) Technicians without work in one depot (loaded when the depot row is expanded) -----------------------------
CREATE OR REPLACE FUNCTION public.allconnect_compare_depot_technicians(
  p_rbm text,
  p_depot_code text,
  p_depot_name text,
  p_month text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF nullif(p_month, '') IS NULL THEN p_month := NULL; END IF;
  RETURN (
    WITH depot_heads AS MATERIALIZED (
      SELECT h.tech_id, h.full_name, h.type_of_work, h.job_accept_type
      FROM public.allconnect_compare_heads() h
      WHERE h.tech_id IS NOT NULL AND h.id_rank = 1
        AND h.rbm = p_rbm
        AND coalesce(nullif(btrim(h.depot_code), ''), '-') = p_depot_code
        AND coalesce(nullif(btrim(h.depot_name), ''), '-') = p_depot_name
    ), worked AS (
      -- Uses allconnect_staff_id_btrim_idx: only this depot's technicians are read.
      SELECT btrim(a."STAFF_ID") AS tech_id
      FROM public.allconnect a
      WHERE btrim(a."STAFF_ID") IN (SELECT tech_id FROM depot_heads)
        AND (p_month IS NULL OR btrim(a."Month") = p_month)
      GROUP BY 1
      HAVING sum(CASE WHEN btrim(a."Job_Install") ~ '^[0-9]+$' THEN btrim(a."Job_Install")::numeric ELSE 0 END
               + CASE WHEN btrim(a."Job_Repair") ~ '^[0-9]+$' THEN btrim(a."Job_Repair")::numeric ELSE 0 END) > 0
    )
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM public.allconnect a WHERE p_month IS NULL OR btrim(a."Month") = p_month)
      -- No comparison data: every technician is 'pending', not 'without_work'.
      THEN '[]'::jsonb
      ELSE coalesce((SELECT jsonb_agg(jsonb_build_object(
        'techId', h.tech_id, 'fullName', h.full_name, 'typeOfWork', h.type_of_work, 'jobAcceptType', h.job_accept_type
      ) ORDER BY h.full_name, h.tech_id)
      FROM depot_heads h WHERE NOT EXISTS (SELECT 1 FROM worked w WHERE w.tech_id = h.tech_id)), '[]'::jsonb)
    END
  );
END;
$function$;

-- The application authenticates admin/manager/viewer requests before using its server key.
REVOKE ALL ON FUNCTION public.allconnect_compare_heads() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.allconnect_compare_summary(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.allconnect_compare_rows(text, text, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.allconnect_compare_depot_technicians(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allconnect_compare_heads() TO service_role;
GRANT EXECUTE ON FUNCTION public.allconnect_compare_summary(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.allconnect_compare_rows(text, text, text, integer, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.allconnect_compare_depot_technicians(text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

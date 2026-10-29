-- Aggregate from the same latest head registrations and completed-job rules as the summary.
CREATE OR REPLACE FUNCTION public.allconnect_compare_region_hierarchy(p_rbm text, p_month text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $function$
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
      SELECT nullif(btrim(t.tech_id), '') AS tech_id,
        coalesce(nullif(btrim(t.rbm), ''), 'ไม่ระบุพื้นที่') AS rbm,
        coalesce(nullif(btrim(t.cbm_th), ''), 'ไม่ระบุ CBM') AS cbm_th,
        coalesce(nullif(btrim(t.province), ''), 'ไม่ระบุจังหวัด') AS province,
        row_number() OVER (PARTITION BY nullif(btrim(t.tech_id), '') ORDER BY t.update_at DESC NULLS LAST, t.uuid) AS id_rank
      FROM public.allconnect_technicians t WHERE btrim(t.workgroup_status) = 'หัวหน้า' 
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

    ), grouped AS (
      SELECT rbm, cbm_th, province, grouping(province) AS is_cbm,
        count(*) AS total,
        count(*) FILTER (WHERE work_status = 'with_work') AS with_work,
        count(*) FILTER (WHERE work_status = 'without_work') AS without_work,
        count(*) FILTER (WHERE work_status = 'pending') AS pending,
        coalesce(sum(job_count),0) AS job_count,
        coalesce(sum(install_count),0) AS install_count,
        coalesce(sum(repair_count),0) AS repair_count
      FROM compared WHERE rbm = p_rbm
      GROUP BY GROUPING SETS ((rbm, cbm_th), (rbm, cbm_th, province))
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'cbm', cbm_th, 'province', province, 'level', CASE WHEN is_cbm = 1 THEN 'cbm' ELSE 'province' END,
      'total', total, 'withWork', with_work, 'withoutWork', without_work, 'pending', pending,
      'jobCount', job_count, 'installCount', install_count, 'repairCount', repair_count,
      'coverage', round(100.0 * with_work / nullif(with_work + without_work,0),1)
    ) ORDER BY cbm_th, is_cbm DESC, province), '[]'::jsonb) FROM grouped
;
$function$;
REVOKE ALL ON FUNCTION public.allconnect_compare_region_hierarchy(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allconnect_compare_region_hierarchy(text,text) TO service_role;

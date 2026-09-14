-- Read-only dashboard over the current allconnect import snapshot.
-- IDs remain text: trim boundary whitespace, never cast to a number.
CREATE FUNCTION public.allconnect_compare_dashboard(
  p_rbm text DEFAULT NULL,
  p_status text DEFAULT 'without_work',
  p_search text DEFAULT '',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
WITH source_meta AS (
  SELECT count(*) AS total_rows,
         count(*) FILTER (WHERE nullif(btrim(a."HANDLER_ID"), '') IS NULL) AS missing_handler_rows,
         max(a.created_at) AS imported_at,
         max(a.updated_at) AS updated_at
  FROM public.allconnect a
), jobs AS (
  SELECT nullif(btrim(a."HANDLER_ID"), '') AS handler_id, count(*) AS job_count
  FROM public.allconnect a
  WHERE nullif(btrim(a."HANDLER_ID"), '') IS NOT NULL
  GROUP BY 1
), source_tech AS (
  SELECT nullif(btrim(t.tech_id), '') AS tech_id,
         coalesce(nullif(btrim(t.full_name), ''), nullif(btrim(concat_ws(' ', t.tech_first_name, t.tech_last_name)), ''), '-') AS full_name,
         coalesce(nullif(btrim(t."RBM"), ''), 'ไม่ระบุพื้นที่') AS rbm,
         coalesce(t."CBM", '') AS cbm,
         coalesce(t.provider, '') AS provider,
         coalesce(t.depot_code, '') AS depot_code,
         coalesce(t.depot_name, '') AS depot_name,
         coalesce(t.province, '') AS province,
         coalesce(t.workgroup_status, t.status, '') AS technician_status,
         row_number() OVER (
           PARTITION BY nullif(btrim(t.tech_id), '')
           ORDER BY t.updated_at DESC NULLS LAST, t.national_id, t."RBM", t.full_name
         ) AS id_rank
  FROM public.technicians t
), tech AS (
  -- Repeated IDs count once, using the most recently updated registration.
  SELECT * FROM source_tech WHERE tech_id IS NULL OR id_rank = 1
), compared AS (
  SELECT t.*, coalesce(j.job_count, 0) AS job_count,
         CASE WHEN m.total_rows = 0 OR t.tech_id IS NULL THEN 'pending'
              WHEN j.handler_id IS NOT NULL THEN 'with_work'
              ELSE 'without_work' END AS work_status
  FROM tech t
  CROSS JOIN source_meta m
  LEFT JOIN jobs j ON j.handler_id = t.tech_id
), scoped AS (
  SELECT * FROM compared WHERE p_rbm IS NULL OR p_rbm = '' OR rbm = p_rbm
), summary AS (
  SELECT count(*) AS total,
         count(*) FILTER (WHERE work_status = 'with_work') AS with_work,
         count(*) FILTER (WHERE work_status = 'without_work') AS without_work,
         count(*) FILTER (WHERE work_status = 'pending') AS pending,
         coalesce(sum(job_count), 0) AS job_count
  FROM scoped
), regions AS (
  SELECT rbm, count(*) AS total,
         count(*) FILTER (WHERE work_status = 'with_work') AS with_work,
         count(*) FILTER (WHERE work_status = 'without_work') AS without_work,
         count(*) FILTER (WHERE work_status = 'pending') AS pending,
         coalesce(sum(job_count), 0) AS job_count
  FROM compared GROUP BY rbm
), filtered AS (
  SELECT * FROM scoped
  WHERE (coalesce(p_status, 'all') = 'all' OR work_status = p_status)
    AND (coalesce(btrim(p_search), '') = '' OR strpos(
      lower(concat_ws(' ', tech_id, full_name, rbm, cbm, provider, depot_code, depot_name, province, technician_status)),
      lower(btrim(p_search))
    ) > 0)
), page_counts AS (
  SELECT count(*) AS total, greatest(1, least(coalesce(p_page_size, 50), 500)) AS page_size FROM filtered
), paging AS (
  SELECT *, greatest(1, ceil(total::numeric / page_size)::integer) AS total_pages,
         least(greatest(1, coalesce(p_page, 1)), greatest(1, ceil(total::numeric / page_size)::integer)) AS page
  FROM page_counts
), page_rows AS (
  SELECT * FROM filtered
  ORDER BY rbm, full_name, tech_id NULLS LAST, depot_code
  LIMIT (SELECT page_size FROM paging)
  OFFSET (SELECT (page - 1) * page_size FROM paging)
)
SELECT jsonb_build_object(
  'dataset', (SELECT jsonb_build_object(
    'totalRows', m.total_rows, 'importedAt', m.imported_at, 'updatedAt', m.updated_at,
    'missingHandlerRows', m.missing_handler_rows,
    'unknownHandlers', (SELECT count(*) FROM jobs j WHERE NOT EXISTS (SELECT 1 FROM tech t WHERE t.tech_id = j.handler_id)),
    'missingTechIds', (SELECT count(*) FROM tech WHERE tech_id IS NULL),
    'duplicateTechIds', (SELECT count(*) FROM source_tech WHERE tech_id IS NOT NULL AND id_rank > 1)
  ) FROM source_meta m),
  'summary', (SELECT jsonb_build_object(
    'total', s.total, 'withWork', s.with_work, 'withoutWork', s.without_work,
    'pending', s.pending, 'jobCount', s.job_count,
    'coverage', round(100.0 * s.with_work / nullif(s.with_work + s.without_work, 0), 1)
  ) FROM summary s),
  'regions', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'rbm', r.rbm, 'total', r.total, 'withWork', r.with_work, 'withoutWork', r.without_work,
    'pending', r.pending, 'jobCount', r.job_count,
    'coverage', round(100.0 * r.with_work / nullif(r.with_work + r.without_work, 0), 1)
  ) ORDER BY substring(r.rbm FROM '^R([0-9]+)')::integer NULLS LAST, r.rbm) FROM regions r), '[]'::jsonb),
  'rows', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'techId', p.tech_id, 'fullName', p.full_name, 'rbm', p.rbm, 'cbm', p.cbm,
    'provider', p.provider, 'depotCode', p.depot_code, 'depotName', p.depot_name,
    'province', p.province, 'technicianStatus', p.technician_status,
    'jobCount', p.job_count, 'workStatus', p.work_status
  ) ORDER BY p.rbm, p.full_name, p.tech_id NULLS LAST, p.depot_code) FROM page_rows p), '[]'::jsonb),
  'pagination', (SELECT jsonb_build_object('total', total, 'page', page, 'pageSize', page_size, 'totalPages', total_pages) FROM paging)
);
$function$;

-- The application authenticates admin/manager requests before using its server key.
REVOKE ALL ON FUNCTION public.allconnect_compare_dashboard(text, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allconnect_compare_dashboard(text, text, text, integer, integer)
  TO service_role;

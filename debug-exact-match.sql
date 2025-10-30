-- Debug SQL query to match the exact query user is using
SELECT 
  rsm,
  COUNT(*) as total_people,
  COUNT(CASE WHEN workgroup_status = 'หัวหน้า' THEN 1 END) as workgroup_count,
  ROUND(100.0 * COUNT(CASE WHEN workgroup_status = 'หัวหน้า' THEN 1 END) / COUNT(*), 2) as workgroup_percentage,
  NOW() as query_time
FROM technicians
WHERE rsm IS NOT NULL
  AND provider IS NOT NULL
  AND work_type IS NOT NULL
GROUP BY rsm
ORDER BY rsm;

-- Summary query
SELECT 
  COUNT(*) as total_people,
  COUNT(CASE WHEN workgroup_status = 'หัวหน้า' THEN 1 END) as workgroup_count,
  ROUND(100.0 * COUNT(CASE WHEN workgroup_status = 'หัวหน้า' THEN 1 END) / COUNT(*), 2) as workgroup_percentage,
  COUNT(DISTINCT workgroup_status) as unique_statuses,
  array_agg(DISTINCT workgroup_status) as all_statuses
FROM technicians
WHERE rsm IS NOT NULL
  AND provider IS NOT NULL  
  AND work_type IS NOT NULL;
-- นับ WW-Provider แยกตาม RSM

SELECT 
  rsm,
  COUNT(*) as "WW-Provider_count"
FROM technicians
WHERE provider = 'WW-Provider'
  AND rsm IS NOT NULL
GROUP BY rsm
ORDER BY rsm;

-- สรุปรวม
SELECT 
  SUM(CASE WHEN rsm IS NOT NULL THEN 1 ELSE 0 END) as "WW-Provider_with_RSM",
  SUM(CASE WHEN rsm IS NULL THEN 1 ELSE 0 END) as "WW-Provider_without_RSM",
  COUNT(*) as "WW-Provider_total"
FROM technicians
WHERE provider = 'WW-Provider';

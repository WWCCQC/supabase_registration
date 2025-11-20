-- เปรียบเทียบ COUNT(*) vs COUNT(DISTINCT national_id) แยกตาม RSM

SELECT 
  rsm,
  COUNT(*) as "total_rows",
  COUNT(DISTINCT national_id) as "unique_national_id",
  COUNT(*) - COUNT(DISTINCT national_id) as "duplicate_rows"
FROM technicians
WHERE provider = 'WW-Provider'
  AND rsm IS NOT NULL
GROUP BY rsm
HAVING COUNT(*) - COUNT(DISTINCT national_id) > 0
ORDER BY rsm;

-- สรุปรวมทั้งหมด
SELECT 
  COUNT(*) as "total_WW_Provider_rows",
  COUNT(DISTINCT national_id) as "unique_WW_Provider_national_id",
  COUNT(*) - COUNT(DISTINCT national_id) as "total_duplicate_rows"
FROM technicians
WHERE provider = 'WW-Provider';

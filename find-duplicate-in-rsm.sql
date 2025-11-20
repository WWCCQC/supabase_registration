-- หา national_id ที่ซ้ำกันภายใน RSM เดียวกัน (WW-Provider)

-- RSM3_UPC-East (นับเกิน 2)
SELECT 
  'RSM3_UPC-East' as rsm,
  national_id,
  COUNT(*) as duplicate_count
FROM technicians
WHERE provider = 'WW-Provider' 
  AND rsm = 'RSM3_UPC-East'
  AND national_id IS NOT NULL
GROUP BY national_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- RSM5_UPC-NOE1 (นับเกิน 2)
SELECT 
  'RSM5_UPC-NOE1' as rsm,
  national_id,
  COUNT(*) as duplicate_count
FROM technicians
WHERE provider = 'WW-Provider' 
  AND rsm = 'RSM5_UPC-NOE1'
  AND national_id IS NOT NULL
GROUP BY national_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- RSM8_UPC-SOU (นับเกิน 1)
SELECT 
  'RSM8_UPC-SOU' as rsm,
  national_id,
  COUNT(*) as duplicate_count
FROM technicians
WHERE provider = 'WW-Provider' 
  AND rsm = 'RSM8_UPC-SOU'
  AND national_id IS NOT NULL
GROUP BY national_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- หาทุก RSM ที่มี duplicate
SELECT 
  rsm,
  national_id,
  COUNT(*) as duplicate_count
FROM technicians
WHERE provider = 'WW-Provider' 
  AND rsm IS NOT NULL
  AND national_id IS NOT NULL
GROUP BY rsm, national_id
HAVING COUNT(*) > 1
ORDER BY rsm, duplicate_count DESC;

-- ตรวจสอบ records ที่อาจทำให้นับผิด

-- 1. นับ WW-Provider ที่มี national_id NULL
SELECT COUNT(*) as "WW-Provider_NULL_national_id"
FROM technicians
WHERE provider = 'WW-Provider' AND national_id IS NULL;

-- 2. นับ True Tech ที่มี national_id NULL
SELECT COUNT(*) as "True_Tech_NULL_national_id"
FROM technicians
WHERE provider = 'True Tech' AND national_id IS NULL;

-- 3. หา duplicate national_id ใน WW-Provider
SELECT national_id, COUNT(*) as count
FROM technicians
WHERE provider = 'WW-Provider' AND national_id IS NOT NULL
GROUP BY national_id
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 10;

-- 4. หา duplicate national_id ใน True Tech
SELECT national_id, COUNT(*) as count
FROM technicians
WHERE provider = 'True Tech' AND national_id IS NOT NULL
GROUP BY national_id
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 10;

-- 5. นับจำนวน unique national_id ของแต่ละ provider
SELECT 
  SUM(CASE WHEN provider = 'WW-Provider' THEN 1 ELSE 0 END) as "WW-Provider_rows",
  COUNT(DISTINCT CASE WHEN provider = 'WW-Provider' THEN national_id END) as "WW-Provider_unique",
  SUM(CASE WHEN provider = 'True Tech' THEN 1 ELSE 0 END) as "True_Tech_rows",
  COUNT(DISTINCT CASE WHEN provider = 'True Tech' THEN national_id END) as "True_Tech_unique",
  SUM(CASE WHEN provider = 'เถ้าแก่เทค' THEN 1 ELSE 0 END) as "Thao_Kae_rows",
  COUNT(DISTINCT CASE WHEN provider = 'เถ้าแก่เทค' THEN national_id END) as "Thao_Kae_unique"
FROM technicians;

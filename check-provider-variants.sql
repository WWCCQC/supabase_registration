-- หา records ที่ provider อาจมี space หรือตัวอักษรแปลกๆ

-- 1. หา provider ที่คล้าย WW-Provider แต่ไม่ตรงทีเดียว
SELECT DISTINCT 
  provider,
  LENGTH(provider) as length,
  COUNT(*) as count
FROM technicians
WHERE provider ILIKE '%WW%Provider%'
  AND provider != 'WW-Provider'
GROUP BY provider, LENGTH(provider)
ORDER BY count DESC;

-- 2. หา provider ที่คล้าย True Tech แต่ไม่ตรงทีเดียว
SELECT DISTINCT 
  provider,
  LENGTH(provider) as length,
  COUNT(*) as count
FROM technicians
WHERE provider ILIKE '%True%Tech%'
  AND provider != 'True Tech'
GROUP BY provider, LENGTH(provider)
ORDER BY count DESC;

-- 3. แสดง provider ทั้งหมดที่มีในระบบ
SELECT 
  provider,
  COUNT(*) as count,
  LENGTH(provider) as length
FROM technicians
WHERE provider IS NOT NULL
GROUP BY provider
ORDER BY count DESC;

-- 4. หา records ที่ provider มี space นำหน้าหรือต่อท้าย
SELECT 
  provider,
  CONCAT('''', provider, '''') as provider_with_quotes,
  COUNT(*) as count
FROM technicians
WHERE provider != TRIM(provider)
  OR provider LIKE ' %'
  OR provider LIKE '% '
GROUP BY provider
ORDER BY count DESC;

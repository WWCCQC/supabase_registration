-- หา national_id ที่ซ้ำกันข้าม provider

SELECT 
  national_id,
  STRING_AGG(DISTINCT provider, ', ' ORDER BY provider) as providers,
  COUNT(DISTINCT provider) as provider_count,
  COUNT(*) as total_records
FROM technicians
WHERE national_id IS NOT NULL
GROUP BY national_id
HAVING COUNT(DISTINCT provider) > 1
ORDER BY provider_count DESC, total_records DESC
LIMIT 20;

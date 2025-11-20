-- คำนวณจำนวน provider แต่ละตัว

-- Query 1: นับ WW-Provider
SELECT COUNT(*) as "WW-Provider_count"
FROM technicians
WHERE provider = 'WW-Provider';

-- Query 2: นับ True Tech
SELECT COUNT(*) as "True_Tech_count"
FROM technicians
WHERE provider = 'True Tech';

-- Query 3: นับ เถ้าแก่เทค
SELECT COUNT(*) as "Thao_Kae_Tech_count"
FROM technicians
WHERE provider = 'เถ้าแก่เทค';

-- Query 4: นับทั้ง 3 provider พร้อมกัน
SELECT 
  SUM(CASE WHEN provider = 'WW-Provider' THEN 1 ELSE 0 END) as "WW-Provider",
  SUM(CASE WHEN provider = 'True Tech' THEN 1 ELSE 0 END) as "True Tech",
  SUM(CASE WHEN provider = 'เถ้าแก่เทค' THEN 1 ELSE 0 END) as "เถ้าแก่เทค",
  SUM(CASE WHEN provider = 'WW-Provider' OR provider = 'True Tech' OR provider = 'เถ้าแก่เทค' THEN 1 ELSE 0 END) as "Total_3_providers"
FROM technicians;

-- ค้นหา "424308" ในทุก field ที่เป็นไปได้

-- ค้นหาใน tech_id
SELECT 'tech_id' as found_in, * FROM technicians 
WHERE tech_id LIKE '%424308%';

-- ค้นหาใน national_id
SELECT 'national_id' as found_in, * FROM technicians 
WHERE national_id LIKE '%424308%';

-- ค้นหาในทุก field ที่เป็น text
SELECT 'any_field' as found_in, * FROM technicians 
WHERE 
  tech_id LIKE '%424308%' OR
  national_id LIKE '%424308%' OR
  full_name LIKE '%424308%' OR
  phone LIKE '%424308%' OR
  email LIKE '%424308%';

-- ค้นหา 424308 ในทุก field เพื่อดูว่ามันอยู่ตรงไหน

-- 1. ค้นหาใน national_id โดยตรง
SELECT 'national_id exact' as search_type, national_id, tech_id, full_name 
FROM technicians 
WHERE national_id = '424308';

-- 2. ค้นหาใน national_id แบบ LIKE
SELECT 'national_id like' as search_type, national_id, tech_id, full_name 
FROM technicians 
WHERE national_id LIKE '%424308%';

-- 3. ค้นหาใน tech_id โดยตรง  
SELECT 'tech_id exact' as search_type, national_id, tech_id, full_name 
FROM technicians 
WHERE tech_id = '424308';

-- 4. ค้นหาใน tech_id แบบ LIKE
SELECT 'tech_id like' as search_type, national_id, tech_id, full_name 
FROM technicians 
WHERE tech_id LIKE '%424308%';

-- 5. ค้นหาชื่อ เฉลิมพงศ์ สุธรรมาภิวัฒน์
SELECT 'by_name' as search_type, national_id, tech_id, full_name 
FROM technicians 
WHERE full_name LIKE '%เฉลิมพงศ์%';

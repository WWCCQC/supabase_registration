-- ตรวจสอบว่า national_id หรือ tech_id นี้มีในฐานข้อมูลจริงไหม

-- ค้นหา national_id ที่ลงท้ายด้วย 3868
SELECT * FROM technicians 
WHERE national_id LIKE '%3868'
ORDER BY national_id;

-- ค้นหา tech_id = 424308
SELECT * FROM technicians 
WHERE tech_id = '424308'
ORDER BY tech_id;

-- ค้นหาชื่อ เฉลิมพงศ์
SELECT * FROM technicians 
WHERE full_name LIKE '%เฉลิมพงศ์%' OR full_name LIKE '%สุธรรมาภิวัฒน์%'
ORDER BY full_name;

-- นับจำนวนทั้งหมดในตาราง
SELECT COUNT(*) as total_records FROM technicians;

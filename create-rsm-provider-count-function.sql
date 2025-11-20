-- สร้าง PostgreSQL function สำหรับนับ RSM Provider Distribution
-- ใช้ COUNT(DISTINCT national_id) แทนการ fetch ข้อมูลมานับ

-- Function 1: นับ provider ทั้งหมด (สำหรับ legend)
CREATE OR REPLACE FUNCTION get_provider_totals()
RETURNS TABLE (
  provider text,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.provider::text,
    COUNT(DISTINCT t.national_id) as count
  FROM technicians t
  WHERE t.provider IN ('WW-Provider', 'True Tech', 'เถ้าแก่เทค')
    AND t.national_id IS NOT NULL
  GROUP BY t.provider;
END;
$$ LANGUAGE plpgsql;

-- Function 2: นับ provider แยกตาม RSM (สำหรับกราฟ)
CREATE OR REPLACE FUNCTION get_rsm_provider_distribution()
RETURNS TABLE (
  rsm text,
  provider text,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(t.rsm, 'No RSM')::text as rsm,
    t.provider::text,
    COUNT(DISTINCT t.national_id) as count
  FROM technicians t
  WHERE t.provider IN ('WW-Provider', 'True Tech', 'เถ้าแก่เทค')
    AND t.national_id IS NOT NULL
  GROUP BY COALESCE(t.rsm, 'No RSM'), t.provider
  ORDER BY rsm, provider;
END;
$$ LANGUAGE plpgsql;

-- Test queries
SELECT * FROM get_provider_totals();
SELECT * FROM get_rsm_provider_distribution();

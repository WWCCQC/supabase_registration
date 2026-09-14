-- Source: allconnect.txt (103 CSV headers, preserving case and spelling).
-- Schema only. Apply once; no source rows are imported by this script.
CREATE TABLE public.allconnect (
  "SECTION" text,
  "SGMD" text,
  "GMD" text,
  "RNSO" text,
  "ROM" text,
  "HOZ" text,
  "RGM" text,
  "HOP" text,
  "SUB_ID" text,
  "SUB_NAME" text,
  "HANDLER" text,
  "PROVINCE" text,
  "DISTRICT" text,
  "SUBDISTRICT" text,
  "GROUP_PROVINCE" text,
  "PRODUCT" text,
  "CIRCUIT_PHY" text,
  "CIRCUIT" text,
  "VOICE_ASSET" text,
  "PACKAGE" text,
  "SPEED" text,
  "STATUS" text,
  "CREATE_DATE" text,
  "APPOINT_DATE" text,
  "APPOINT_TIME" text,
  "CLOSED_DATE" text,
  "ORDER_STAT" text,
  "ORDER_ITEM_STAT" text,
  "SALE_ID" text,
  "SALE_NAME" text,
  "GROUP_SALE" text,
  "NEW_CHANNEL" text,
  "INDEX_SALE" text,
  "GROUP_CHANNEL" text,
  "CHANNEL" text,
  "DEALER" text,
  "ENTRY_FEE" text,
  "MOBILE_STATUS" text,
  "REASONCODE" text,
  "GROUP_PROBLEM" text,
  "FLAG_CALLVER" text,
  "CALL_VERIFY" text,
  "CALL_VER_ACTIVITY" text,
  "CALL_VER_DATE" text,
  "CALL_REASON" text,
  "CALL_SUB_REASON" text,
  "DISPATCH_RULE_TYPE" text,
  "DISPATCH_RULE_DESC" text,
  "DROP_WIRE_STRT" text,
  "DROP_WIRE_END" text,
  "DROP_WIRE_TYPE" text,
  "FLAG_INSTALL" text,
  "OLD_ACCESS" text,
  "WO_CREATE_TIME" text,
  "EVENT" text,
  "VERIFY" text,
  "ACTION" text,
  "ORDERCURRENTSTATUS" text,
  "ORDER_NO" text,
  "ACCEPT_DATETIME" text,
  "HANDLE_DATETIME" text,
  "VENDOR" text,
  "BLDG_ID" text,
  "BLDG_NBR" text,
  "BLDG_NM" text,
  "BLDG_NM_TH" text,
  "SCAB_CODE" text,
  "OLT_NAME" text,
  "SPLITTER_L2" text,
  "GROUP_CUSTOMER" text,
  "DROP_WIRE_LENGTH" text,
  "GROUP_DROP_WIRE_LENGTH" text,
  "HANDLER_ID" text,
  "ON_TIME" text,
  "SALESMAN_TEL" text,
  "TOL_CHANNEL_TYPE" text,
  "TDS_Province_PIS" text,
  "GROUP_SUB" text,
  "CONFIRM_BEGIN_TIME" text,
  "CONFRIM_COMPLETE_TIME" text,
  "DISTANCE" text,
  "ONTIME_REMARK" text,
  "MDU_SDU" text,
  "MDU_MODEL" text,
  "STB_AMOUNT" text,
  "INSTALL_PERIOD" text,
  "GROUP_MDU_SDU" text,
  "CLOSED_TIME" text,
  "ADD_MESH" text,
  "GROUP_TECH" text,
  "Shop_code" text,
  "CM_GROUP" text,
  "MESH_AMOUNT" text,
  "CPE_GROUP" text,
  "TVS_PROMOTION" text,
  "CPE_SN" text,
  "PREFER_DATE" text,
  "TDS_GROUP_CHANNEL" text,
  "TDS_SPECIAL_CHANNEL" text,
  "TDS_REGION" text,
  "TDS_PROVINCE" text,
  "L2_PORT" text,
  "FUSION_SPLICE" text,
  uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

COMMENT ON TABLE public.allconnect IS
  'Current allconnect import snapshot. Source fields are text. Admins may truncate rows and import a replacement file without dropping this table.';
COMMENT ON COLUMN public.allconnect.uuid IS
  'Generated row identifier. Replacement imports generate new UUIDs.';
COMMENT ON COLUMN public.allconnect.created_at IS
  'Row import timestamp. Omit this column from CSV imports to use the server timestamp.';
COMMENT ON COLUMN public.allconnect.updated_at IS
  'Initially the row import timestamp; refreshed automatically when the row is updated.';

CREATE FUNCTION public.allconnect_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.allconnect_set_updated_at()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER allconnect_set_updated_at
BEFORE UPDATE ON public.allconnect
FOR EACH ROW EXECUTE FUNCTION public.allconnect_set_updated_at();

ALTER TABLE public.allconnect ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.allconnect FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.allconnect TO anon, authenticated;
GRANT ALL ON TABLE public.allconnect TO service_role;

CREATE POLICY allconnect_read
ON public.allconnect
FOR SELECT
TO anon, authenticated
USING (true);

-- Future replacement imports: run the following separately as an admin,
-- only when ready to clear the previous data, then import the new CSV.
-- TRUNCATE TABLE public.allconnect;
-- Keep all 103 original headers. Omit uuid, created_at and updated_at.
-- These audit fields are generated automatically for every imported row.
-- Row timestamps describe the current snapshot, not a history of old files.

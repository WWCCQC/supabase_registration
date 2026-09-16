const HEADER_LINE = 'SECTION,SGMD,GMD,RNSO,ROM,HOZ,RGM,HOP,SUB_ID,SUB_NAME,HANDLER,PROVINCE,DISTRICT,SUBDISTRICT,GROUP_PROVINCE,PRODUCT,CIRCUIT_PHY,CIRCUIT,VOICE_ASSET,PACKAGE,SPEED,STATUS,CREATE_DATE,APPOINT_DATE,APPOINT_TIME,CLOSED_DATE,ORDER_STAT,ORDER_ITEM_STAT,SALE_ID,SALE_NAME,GROUP_SALE,NEW_CHANNEL,INDEX_SALE,GROUP_CHANNEL,CHANNEL,DEALER,ENTRY_FEE,MOBILE_STATUS,REASONCODE,GROUP_PROBLEM,FLAG_CALLVER,CALL_VERIFY,CALL_VER_ACTIVITY,CALL_VER_DATE,CALL_REASON,CALL_SUB_REASON,DISPATCH_RULE_TYPE,DISPATCH_RULE_DESC,DROP_WIRE_STRT,DROP_WIRE_END,DROP_WIRE_TYPE,FLAG_INSTALL,OLD_ACCESS,WO_CREATE_TIME,EVENT,VERIFY,ACTION,ORDERCURRENTSTATUS,ORDER_NO,ACCEPT_DATETIME,HANDLE_DATETIME,VENDOR,BLDG_ID,BLDG_NBR,BLDG_NM,BLDG_NM_TH,SCAB_CODE,OLT_NAME,SPLITTER_L2,GROUP_CUSTOMER,DROP_WIRE_LENGTH,GROUP_DROP_WIRE_LENGTH,HANDLER_ID,ON_TIME,SALESMAN_TEL,TOL_CHANNEL_TYPE,TDS_Province_PIS,GROUP_SUB,CONFIRM_BEGIN_TIME,CONFRIM_COMPLETE_TIME,DISTANCE,ONTIME_REMARK,MDU_SDU,MDU_MODEL,STB_AMOUNT,INSTALL_PERIOD,GROUP_MDU_SDU,CLOSED_TIME,ADD_MESH,GROUP_TECH,Shop_code,CM_GROUP,MESH_AMOUNT,CPE_GROUP,TVS_PROMOTION,CPE_SN,PREFER_DATE,TDS_GROUP_CHANNEL,TDS_SPECIAL_CHANNEL,TDS_REGION,TDS_PROVINCE,L2_PORT,FUSION_SPLICE';

export const ALLCONNECT_HEADERS = Object.freeze(HEADER_LINE.split(','));
export const MAX_ALLCONNECT_FILE_SIZE = 200 * 1024 * 1024;
export const ALLCONNECT_BATCH_SIZE = 200;

export function validateAllconnectHeaders(headers: string[]) {
  const normalized = headers.map((header, index) => index === 0 ? header.replace(/^\uFEFF/, '') : header);
  const mismatch = normalized.findIndex((header, index) => header !== ALLCONNECT_HEADERS[index]);
  if (normalized.length !== ALLCONNECT_HEADERS.length || mismatch !== -1) {
    return { ok: false as const, message: 'หัวคอลัมน์ไฟล์ไม่ตรงกับรูปแบบ Allconnect 103 คอลัมน์' };
  }
  return { ok: true as const };
}

export function normalizeAllconnectRow(row: Record<string, unknown>) {
  return Object.fromEntries(ALLCONNECT_HEADERS.map(header => [header, row[header] == null ? '' : String(row[header])]));
}

export function validateUploadFile(file: Pick<File, 'name' | 'size'>) {
  if (file.size === 0) throw new Error('File is empty');
  if (file.size > MAX_ALLCONNECT_FILE_SIZE) throw new Error('File exceeds 200 MB');
  if (!/\.(txt|csv)$/i.test(file.name)) throw new Error('File must be .txt or .csv');
}

export function calculateUploadPercent(cursor: number, fileSize: number) {
  if (fileSize <= 0) return 0;
  return Math.min(95, Math.round(Math.max(0, cursor) * 95 / fileSize));
}

export function parseUploadAction(value: unknown): 'start' | 'chunk' | 'commit' | 'abort' {
  if (value !== 'start' && value !== 'chunk' && value !== 'commit' && value !== 'abort') {
    throw new Error('Invalid upload action');
  }
  return value;
}

export function validateBatchId(value: unknown): string {
  if (typeof value !== 'string' || value.length !== 36 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
    throw new Error('Invalid batch ID');
  }
  return value;
}

export function validateChunkPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid upload payload');
  const input = value as { batchId?: unknown; startRow?: unknown; rows?: unknown };
  const batchId = validateBatchId(input.batchId);
  if (typeof input.startRow !== 'number' || !Number.isSafeInteger(input.startRow) || input.startRow < 1) {
    throw new Error('Invalid start row');
  }
  if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > ALLCONNECT_BATCH_SIZE) {
    throw new Error('Invalid batch size');
  }
  if (input.startRow + input.rows.length - 1 > 2147483647) throw new Error('Invalid end row');
  const rows = input.rows.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid row');
    const keys = Object.keys(value);
    if (keys.length !== ALLCONNECT_HEADERS.length || keys.some((key, index) => key !== ALLCONNECT_HEADERS[index])) {
      throw new Error('Invalid row columns');
    }
    return normalizeAllconnectRow(value as Record<string, unknown>);
  });
  return { batchId, startRow: input.startRow, rows };
}

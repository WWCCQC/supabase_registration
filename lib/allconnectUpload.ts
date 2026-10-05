const HEADER_LINE = 'Month,PERFORMANCE_DATE,Primary_Team_RBM,Primary_Team_CBM,Primary_Team_Province,Primary_Team_District,DEPOT,SUB_NAME,STAFF_ID,STAFF_NAME,RBM,CBM,PROVINCE,District,SubDistrict,Group_Tech_Up,MasterTech_team_code,MasterTech_tech_team_type,MasterTech_group_of_work_assign,Job_Install,Job_Repair,Status_Tech,Team_Fucntion';

export const ALLCONNECT_HEADERS = Object.freeze(HEADER_LINE.split(','));
export const MAX_ALLCONNECT_FILE_SIZE = 200 * 1024 * 1024;
export const ALLCONNECT_BATCH_SIZE = 200;

export function validateAllconnectHeaders(headers: string[]) {
  const normalized = headers.map((header, index) => index === 0 ? header.replace(/^\uFEFF/, '') : header);
  const mismatch = normalized.findIndex((header, index) => header !== ALLCONNECT_HEADERS[index]);
  if (normalized.length !== ALLCONNECT_HEADERS.length || mismatch !== -1) {
    return { ok: false as const, message: 'หัวคอลัมน์ไฟล์ไม่ตรงกับรูปแบบ Allconnect 23 คอลัมน์' };
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

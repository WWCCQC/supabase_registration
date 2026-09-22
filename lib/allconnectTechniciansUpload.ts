import * as XLSX from 'xlsx';

export const TECHNICIAN_COLUMNS = [
  'area', 'tech_id', 'company_type', 'cbm', 'cbm_th', 'rbm', 'type_of_work',
  'job_accept_type', 'group', 'province', 'depot_name', 'depot_code', 'team_name',
  'type', 'team', 'item', 'workgroup_status', 'tech_name', 'tech_surename',
  'tech_name_eng', 'tech_surename_eng', 'tech_id_wfm', 'register_date', 'tel',
  'remark1', 'rbm_group', 'province_group', 'period',
] as const;

export const TECHNICIAN_EXCEL_HEADERS = [
  'Area', 'Tech_ID', 'Company_Type', 'CTM_Province', 'CTM_Province_TH', 'RSH',
  'Type of work', 'ประเภทการรับงาน', 'Group', 'Province', 'Depot_Name', 'Depot_Code',
  'Team_Name', 'Type', 'จำนวนกองงาน', 'จำนวนช่าง', 'สถานะกองงาน', 'Tech_Name',
  'Tech_Surename', 'Tech_Name_Eng', 'Tech_Surename_Eng', 'Tech_ID_WFM 8.1',
  'Register_Date', 'Tel', 'Remark1', 'RSM Group', 'Province_Group', 'Period',
] as const;

export const TECHNICIAN_BATCH_SIZE = 200;
export const MAX_TECHNICIAN_FILE_SIZE = 50 * 1024 * 1024;

const cleanHeader = (value: unknown) => String(value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase();
const aliases = new Map<string, string>();
TECHNICIAN_COLUMNS.forEach((column, index) => {
  aliases.set(cleanHeader(column), column);
  aliases.set(cleanHeader(TECHNICIAN_EXCEL_HEADERS[index]), column);
});

function headerMapping(row: unknown[]): string[] | null {
  const headers = [...row];
  while (headers.length && cleanHeader(headers[headers.length - 1]) === '') headers.pop();
  const mapped = headers.map(value => aliases.get(cleanHeader(value)));
  if (mapped.length !== TECHNICIAN_COLUMNS.length || mapped.some(value => !value) || new Set(mapped).size !== TECHNICIAN_COLUMNS.length) return null;
  return mapped as string[];
}

export function mapTechnicianSheet(data: unknown[][]): Record<string, string>[] {
  const mapping = headerMapping(data[0] ?? []);
  if (!mapping) throw new Error('หัวคอลัมน์ไม่ตรงกับไฟล์ช่าง 28 คอลัมน์');
  // The reference workbook includes a canonical header followed by export labels.
  const secondMapping = headerMapping(data[1] ?? []);
  const offset = secondMapping ? 2 : 1;
  const effectiveMapping = secondMapping ?? mapping;
  const rows: Record<string, string>[] = [];
  for (let index = offset; index < data.length; index++) {
    const row = data[index];
    if (row.every(value => value == null || String(value).trim() === '')) continue;
    if (row.slice(TECHNICIAN_COLUMNS.length).some(value => value != null && String(value).trim() !== '')) {
      throw new Error(`แถวที่ ${index + 1} มีข้อมูลเกิน 28 คอลัมน์`);
    }
    const values = Object.fromEntries(effectiveMapping.map((column, position) => [column, row[position] == null ? '' : String(row[position])]));
    rows.push(Object.fromEntries(TECHNICIAN_COLUMNS.map(column => [column, values[column]])));
  }
  if (!rows.length) throw new Error('ไฟล์ไม่มีข้อมูลช่าง');
  return rows;
}

export function parseTechnicianWorkbook(buffer: ArrayBuffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const name = workbook.SheetNames.includes('Tech_All') ? 'Tech_All' : workbook.SheetNames.length === 1 ? workbook.SheetNames[0] : undefined;
  if (!name) throw new Error('กรุณาใช้ชีต Tech_All หรือไฟล์ที่มีชีตข้อมูลช่างเพียงชีตเดียว');
  const sheet = workbook.Sheets[name];
  // raw:false preserves displayed identifiers, leading zeros and date formatting.
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true });
  return mapTechnicianSheet(data);
}

export function validateTechnicianFile(file: { name: string; size: number }) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('กรุณาเลือกไฟล์ Excel .xlsx');
  if (file.size <= 0 || file.size > MAX_TECHNICIAN_FILE_SIZE) throw new Error('ไฟล์ต้องมีข้อมูลและมีขนาดไม่เกิน 50 MB');
}

export function validateTechnicianRows(value: unknown): Record<string, string>[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > TECHNICIAN_BATCH_SIZE) throw new Error('Invalid batch size');
  return value.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid row');
    if (Object.keys(row).length !== TECHNICIAN_COLUMNS.length || TECHNICIAN_COLUMNS.some(key => typeof row[key] !== 'string')) throw new Error('Invalid row columns');
    return Object.fromEntries(TECHNICIAN_COLUMNS.map(key => [key, row[key]]));
  });
}

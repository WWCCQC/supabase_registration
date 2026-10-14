export type ContractRow = Record<string, string | null>;
export const contractColumns = [
  ['rbm', 'RBM'], ['corporate_registration_no', 'เลขทะเบียนบริษัท'],
  ['partner_name', 'ชื่อคู่สัญญา'], ['depot_code', 'Depot'],
  ['active_status', 'สถานะ Active'], ['contract_status', 'สถานะสัญญา'],
  ['group_status', 'กลุ่มสถานะ'],
  ['start_contract', 'วันเริ่มสัญญา'], ['end_contract', 'วันสิ้นสุดสัญญา'],
  ['contract_no', 'เลขที่สัญญา'],
  ['contract_guarantee_amount', 'วงเงินค้ำประกันรวม'],
  ['contract_technician_team_count', 'จำนวนทีมช่าง'], ['bg_status', 'สถานะ BG'],
  ['installation_status', 'เหตุผล'],
] as const;
export const solarContractColumns = [
  ['rbm', 'RBM'], ['corporate_registration_no', 'เลขทะเบียนบริษัท'],
  ['partner_name', 'ชื่อคู่สัญญา'], ['active_status', 'สถานะ Active'],
  ['contract_status', 'สถานะสัญญา'], ['group_status', 'กลุ่มสถานะ'],
  ['start_contract', 'วันเริ่มสัญญา'], ['end_contract', 'วันสิ้นสุดสัญญา'],
  ['contract_no', 'เลขที่สัญญา'], ['contract_guarantee_amount', 'วงเงินค้ำประกันรวม'],
  ['installation_status', 'เหตุผล'], ['email', 'อีเมล'],
] as const;
export const contractValue = (value: string | null | undefined) => value?.trim() || 'ไม่ระบุ';
export function groupContracts(rows: ContractRow[], column: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = contractValue(row[column]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'));
}
// ลำดับการ์ดสรุปตาม group_status (การ์ด "คู่สัญญาทั้งหมด" แสดงก่อนเสมอใน component)
export const groupStatusOrder = ['Complete', 'On Process', 'Cancel'] as const;
const groupStatusKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
export function groupStatusCards(rows: ContractRow[]) {
  const counts = groupContracts(rows, 'group_status');
  const rank = (value: string) => {
    const index = groupStatusOrder.findIndex(status => groupStatusKey(status) === groupStatusKey(value));
    return index === -1 ? groupStatusOrder.length : index;
  };
  // แสดงการ์ดหลักครบทุกใบแม้จำนวนเป็น 0; ค่าอื่นที่ไม่อยู่ในลำดับจะต่อท้าย
  const missing = groupStatusOrder
    .filter(status => !counts.some(([value]) => rank(value) === rank(status)))
    .map(status => [status, 0] as [string, number]);
  return [...counts, ...missing].sort((a, b) => rank(a[0]) - rank(b[0]));
}
// กราฟรายละเอียดสถานะสัญญา: เฉพาะรายการ group_status = On Process แยกตาม installation_status
export function onProcessRows(rows: ContractRow[]) {
  return rows.filter(row => groupStatusKey(row.group_status ?? '') === groupStatusKey('On Process'));
}
export function filterContracts(rows: ContractRow[], query: string, filters: Record<string, string>) {
  const search = query.trim().toLocaleLowerCase('th');
  return rows.filter(row => Object.entries(filters).every(([key, value]) => !value || contractValue(row[key]) === value)
    && (!search || Object.values(row).some(value => String(value ?? '').toLocaleLowerCase('th').includes(search))));
}

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
export const corporateContractColumns = [
  ['corporate_registration_no', 'เลขทะเบียนบริษัท'],
  ['partner_name', 'ชื่อคู่สัญญา'], ['active_status', 'สถานะ Active'],
  ['contract_status', 'สถานะสัญญา'], ['group_status', 'กลุ่มสถานะ'],
  ['start_contract', 'วันเริ่มสัญญา'], ['end_contract', 'วันสิ้นสุดสัญญา'],
  ['contract_no', 'เลขที่สัญญา'], ['contract_guarantee_amount', 'วงเงินค้ำประกันรวม'],
  ['installation_status', 'เหตุผล'], ['email', 'อีเมล'],
] as const;
export const contractValue = (value: string | null | undefined) => value?.trim() || 'ไม่ระบุ';
// ปกปิดเลขทะเบียนบริษัทเฉพาะตอนแสดงผล/Export: แทนตัวหน้าด้วย x และแสดงจริงเฉพาะ 5 ตัวท้าย (13 หลัก → xxxxxxxx12345)
// การค้นหายังใช้ข้อมูลจริง จึงพิมพ์เลขเต็มเพื่อค้นหาได้
export function maskRegistration(value: string | null | undefined) {
  const raw = value?.trim() ?? '';
  if (!raw) return '';
  return raw.length <= 5 ? raw : 'x'.repeat(raw.length - 5) + raw.slice(-5);
}
// ใช้กับค่าคอลัมน์ในตารางสัญญา: ปกปิดเฉพาะ corporate_registration_no
export const contractCellValue = (key: string, value: string | null | undefined) =>
  key === 'corporate_registration_no' && value?.trim() ? maskRegistration(value) : value;
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
// หน้า Corporate: ไม่แสดงการ์ด Complete และ On Process
export const corporateHiddenGroupStatuses = ['Complete', 'On Process'] as const;
export const isCorporateHiddenGroupStatus = (value: string) =>
  corporateHiddenGroupStatuses.some(status => groupStatusKey(status) === groupStatusKey(value));
// การ์ด "สัญญา Active" ของหน้า Corporate นับจากคอลัมน์ contract_status
export const activeContractStatus = 'สัญญา Active';
export const countActiveContracts = (rows: ContractRow[]) =>
  rows.filter(row => groupStatusKey(row.contract_status ?? '') === groupStatusKey(activeContractStatus)).length;
// กราฟรายละเอียดสถานะสัญญา: เฉพาะรายการ group_status = On Process แยกตาม installation_status
export function onProcessRows(rows: ContractRow[]) {
  return rows.filter(row => groupStatusKey(row.group_status ?? '') === groupStatusKey('On Process'));
}
// กราฟรายละเอียดสัญญาตามพื้นที่ (หน้า Corporate): แยกตามคอลัมน์ rbm และนับจำนวนตามคอลัมน์ active_status
export function rbmActiveStatusBreakdown(rows: ContractRow[], rbmRank: (value: string) => number) {
  const statuses = groupContracts(rows, 'active_status').map(([status]) => status)
    .sort((a, b) => Number(b.toLowerCase() === 'active') - Number(a.toLowerCase() === 'active'));
  const areas = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const rbm = contractValue(row.rbm);
    const status = contractValue(row.active_status);
    const counts = areas.get(rbm) ?? new Map<string, number>();
    counts.set(status, (counts.get(status) ?? 0) + 1);
    areas.set(rbm, counts);
  }
  const items = [...areas].map(([rbm, counts]) => ({
    rbm,
    total: [...counts.values()].reduce((sum, count) => sum + count, 0),
    counts: statuses.map(status => [status, counts.get(status) ?? 0] as [string, number]),
  })).sort((a, b) => rbmRank(a.rbm) - rbmRank(b.rbm) || a.rbm.localeCompare(b.rbm, 'th', { numeric: true }));
  return { statuses, items, max: Math.max(0, ...items.map(item => item.total)) };
}
export function filterContracts(rows: ContractRow[], query: string, filters: Record<string, string>) {
  const search = query.trim().toLocaleLowerCase('th');
  return rows.filter(row => Object.entries(filters).every(([key, value]) => !value || contractValue(row[key]) === value)
    && (!search || Object.values(row).some(value => String(value ?? '').toLocaleLowerCase('th').includes(search))));
}

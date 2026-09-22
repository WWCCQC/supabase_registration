export type ContractRow = Record<string, string | null>;
export const contractColumns = [
  ['partner_name', 'ชื่อคู่สัญญา'], ['depot_code', 'รหัส Depot'],
  ['active_status', 'สถานะใช้งาน'], ['contract_status', 'สถานะสัญญา'],
  ['contract_start_date', 'วันเริ่มสัญญา'], ['contract_end_date', 'วันสิ้นสุดสัญญา'],
  ['contract_no', 'เลขที่สัญญา'], ['rbm', 'RBM'],
  ['total_contract_guarantee_amount', 'วงเงินค้ำประกันรวม'],
  ['contract_technician_team_count', 'จำนวนทีมช่าง'], ['bg_status', 'สถานะ BG'],
  ['installation_status', 'เหตุผลย่อย'], ['email', 'อีเมล'],
  ['company_registration_no', 'เลขทะเบียนบริษัท'],
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
export function filterContracts(rows: ContractRow[], query: string, filters: Record<string, string>) {
  const search = query.trim().toLocaleLowerCase('th');
  return rows.filter(row => Object.entries(filters).every(([key, value]) => !value || contractValue(row[key]) === value)
    && (!search || Object.values(row).some(value => String(value ?? '').toLocaleLowerCase('th').includes(search))));
}

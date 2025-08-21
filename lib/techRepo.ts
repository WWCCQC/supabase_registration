import { supabaseServer } from './supabaseServer';

/** นับทั้งหมดในตาราง (ถูกต้องเสมอ) */
export async function countAllTechnicians() {
  const supabase = supabaseServer();
  const { count, error } = await supabase
    .from('technicians')
    .select('national_id', { head: true, count: 'exact' });
  if (error) throw error;
  return count ?? 0;
}

/** นับตามเงื่อนไขเท่ากับ (เช่น provider = 'WW-Provider') */
export async function countEq(column: string, value: string) {
  const supabase = supabaseServer();
  const { count, error } = await supabase
    .from('technicians')
    .select(column, { head: true, count: 'exact' })
    .eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

/** ถ้าต้องดึง “ทุกแถว” ให้แบ่งหน้า (.range) ครั้งละ 1000 */
export async function fetchAllTechnicians() {
  const supabase = supabaseServer();
  const pageSize = 1000;
  let from = 0;
  let rows: any[] = [];

  for (;;) {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows = rows.concat(data ?? []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { tech_id: string };

// คีย์ที่ "ไม่ต้องการ" ให้ส่งออกไปใน popup
const EXCLUDE_KEYS = [
  "ctm_province",
  "job_accept_type",
  "group_name",
  "team_type",
  "tech_first_name",
  "tech_last_name",
  "tech_first_name_en",
  "tech_last_name_en",
  "card_expire_date_alt",
  "card_days_to_expire",
  "status",
  "is_blacklisted",
  "current_address",
] as const;

function stripKeys<T extends Record<string, any>>(row: T, keys: readonly string[]) {
  // ไม่แก้ของเดิม ใช้ shallow copy แล้วลบคีย์ที่ไม่ต้องการ
  const out: Record<string, any> = { ...row };
  for (const k of keys) delete out[k];
  return out;
}

// GET /api/technicians/[tech_id]
// รองรับ id ที่เป็นทั้ง tech_id และ national_id
export async function GET(_req: Request, { params }: { params: Params }) {
  try {
    const id = decodeURIComponent(params.tech_id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // helper: ดึง 1 แถวแบบปลอดภัย
    const getBy = async (col: string, value: string) =>
      supabase.from("technicians").select("*").eq(col, value).limit(1).maybeSingle();

    // 1) ลองค้นด้วย tech_id ก่อน
    let { data: row, error } = await getBy("tech_id", id);
    if (error) throw error;

    // 2) ถ้ายังไม่เจอ ลองด้วย national_id ต่อ
    if (!row) {
      const resNat = await getBy("national_id", id);
      if (resNat.error) throw resNat.error;
      row = resNat.data;
    }

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ตัดคีย์ที่ไม่ต้องการออกก่อนส่งกลับ (ที่เหลือส่งทั้งหมด)
    const cleaned = stripKeys(row, EXCLUDE_KEYS);

    return NextResponse.json(
      { row: cleaned },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

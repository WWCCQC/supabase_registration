export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { tech_id: string };

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

    // ส่งทุกคอลัมน์กลับ
    return NextResponse.json({ row }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

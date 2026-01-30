// app/api/meta/rsm/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    // ดึงเฉพาะคอลัมน์ RBM ทั้งหมด แล้วมาคัดกรองซ้ำฝั่ง server
    const { data, error } = await supabase
      .from("technicians")
      .select("RBM")
      .not("RBM", "is", null)
      .neq("RBM", "")
      .limit(10000); // กันเหนียว (พอสำหรับลิสต์ค่า)

    if (error) throw error;

    const options = Array.from(
      new Set(
        (data || [])
          .map((x: any) => String(x.RBM || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json(
      { options },
      { headers: { "Cache-Control": "s-maxage=180, stale-while-revalidate=86400" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}


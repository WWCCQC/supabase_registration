export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// course=g  → filter by course_g = "Pass"  / course_g != "Pass"
// course=ec → filter by course_ec = "Pass" / course_ec != "Pass"
// status=pass | notpass

const COLS = "HRBM,RBM,CBM,provider,depot_code,depot_name,tech_id,full_name,course_g,course_ec";
const PAGE_SIZE = 1000;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const course = url.searchParams.get("course") ?? ""; // "g" | "ec"
    const status = url.searchParams.get("status") ?? ""; // "pass" | "notpass"

    if (!course || !status) {
      return NextResponse.json({ error: "course and status are required" }, { status: 400 });
    }

    const col = course === "g" ? "course_g" : "course_ec";

    const supabase = supabaseAdmin();
    const allRows: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("technicians")
        .select(COLS)
        .order("RBM", { ascending: true, nullsFirst: false })
        .order("provider", { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

      if (status === "pass") {
        query = query.ilike(col, "pass");
      } else {
        // ยังไม่อบรม = ค่าว่าง (null หรือ empty string)
        query = query.or(`${col}.is.null,${col}.eq.`);
      }

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      if (data && data.length > 0) {
        allRows.push(...data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    const rows = allRows.map((r: any) => ({
      HRBM: r.HRBM ?? "-",
      RBM: r.RBM ?? "-",
      CBM: r.CBM ?? "-",
      provider: r.provider ?? "-",
      depot_code: r.depot_code ?? "-",
      depot_name: r.depot_name ?? "-",
      tech_id: r.tech_id ?? "-",
      full_name: r.full_name ?? "-",
      course_g: r.course_g ?? "-",
      course_ec: r.course_ec ?? "-",
    }));

    return NextResponse.json(
      { rows, total: rows.length },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

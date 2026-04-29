export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const COLS = "HRBM,RBM,CBM,provider,depot_code,depot_name,tech_id,full_name,power_authority,course_g,course_ec,course_h";
const PAGE_SIZE = 1000;

// Allowed course types to prevent injection
const VALID_COURSES = ["power_authority", "course_g", "course_ec", "course_h"] as const;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const course = url.searchParams.get("course") || "";

    if (!course || !VALID_COURSES.includes(course as any)) {
      return NextResponse.json(
        { error: `course must be one of: ${VALID_COURSES.join(", ")}` },
        { status: 400 }
      );
    }

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

      // Filter based on course type
      if (course === "power_authority") {
        query = query.ilike("power_authority", "yes");
      } else {
        // course_g, course_ec, course_h — non-empty, non-null
        query = query.not(course, "is", null).neq(course, "");
      }

      const { data, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

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
      power_authority: r.power_authority ?? "-",
      course_g: r.course_g ?? "-",
      course_ec: r.course_ec ?? "-",
      course_h: r.course_h ?? "-",
    }));

    return NextResponse.json(
      { rows, total: rows.length },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

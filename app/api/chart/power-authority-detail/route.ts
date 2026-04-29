export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const COLS = "HRBM,RBM,CBM,provider,depot_code,depot_name,tech_id,full_name,power_authority";
const PAGE_SIZE = 1000;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const powerAuthority = url.searchParams.get("power_authority") || "";

    if (!powerAuthority) {
      return NextResponse.json({ error: "power_authority is required" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Paginate to get all matching records
    const allRows: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("technicians")
        .select(COLS)
        .eq("power_authority", powerAuthority)
        .order("RBM", { ascending: true, nullsFirst: false })
        .order("provider", { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

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
    }));

    return NextResponse.json(
      { rows, total: rows.length },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

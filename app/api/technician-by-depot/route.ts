import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { mapCtmToThaiName } from "@/lib/ctmMapping";
import { buildDepotWorkgroups, type DepotTechnicianRow } from "@/lib/depotWorkgroups";

export const dynamic = "force-dynamic";

const COLUMNS =
  "national_id,tech_id,full_name,workgroup_status,work_type,provider,RBM,CBM,province,depot_name,depot_code,team_name,division,doc_tech_card_url";

/** Every technician grouped into workgroups (head + paired members), with photos. Requires a signed-in user. */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  const secret = process.env.JWT_SECRET;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!secret) return NextResponse.json({ error: "Server authentication is not configured" }, { status: 500 });
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = supabaseAdmin({ noStore: true });
    const rows: DepotTechnicianRow[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("technicians")
        .select(COLUMNS)
        .order("national_id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as DepotTechnicianRow[]));
      if (!data || data.length < pageSize) break;
    }

    return NextResponse.json(buildDepotWorkgroups(rows, (cbm) => (cbm ? mapCtmToThaiName(cbm) : "")), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Failed to load technician-by-depot:", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูลช่างแยกตาม Depot ได้" }, { status: 500 });
  }
}

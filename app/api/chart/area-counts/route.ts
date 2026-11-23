export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AREA_PROVIDERS, WORK_TYPES, type AreaCounts, type AreaPivot } from "@/lib/workTypes";

const SERVICE_COLUMNS = [
  "svc_install", "svc_repair", "svc_nonstandard", "svc_corporate", "svc_solar",
  "svc_fttr", "svc_2g", "svc_cctv", "svc_cyod", "svc_dongle", "svc_iot",
  "svc_gigatex", "svc_wifi", "svc_smarthome", "svc_catv_settop_box",
  "svc_true_id", "svc_true_inno", "svc_l3",
];

const SEARCH_COLUMNS = [
  "national_id", "tech_id", "full_name", "gender", "age", "degree",
  "phone", "email", "workgroup_status", "work_type", "provider",
  "area", "RBM", "CBM", "depot_code", "depot_name", "province",
];

const PAGE_SIZE = 1000;

/**
 * Both area tables ("จำนวนช่าง" and "จำนวนกองงาน") come from this one scan,
 * so they always share the same rows and filters. A workgroup is counted by
 * its head: technicians whose workgroup_status is "หัวหน้า".
 */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const get = (key: string) => (params.get(key) || "").trim();
    const supabase = supabaseAdmin();

    const buildQuery = () => {
      let query = supabase
        .from("technicians")
        .select("national_id, RBM, provider, work_type, workgroup_status")
        .not("RBM", "is", null).neq("RBM", "")
        .in("provider", [...AREA_PROVIDERS])
        .in("work_type", [...WORK_TYPES]);

      const contains: Array<[string, string]> = [
        ["national_id", get("f_national_id")],
        ["tech_id", get("f_tech_id")],
        ["RBM", get("rsm") || get("f_rsm")],
        ["CBM", get("ctm") || get("f_ctm")],
        ["depot_code", get("f_depot_code")],
      ];
      for (const [column, value] of contains) if (value) query = query.ilike(column, `%${value}%`);

      const training = get("f_training_type");
      if (SERVICE_COLUMNS.includes(training)) query = query.eq(training, "Pass");

      const q = get("q");
      if (q) query = query.or(SEARCH_COLUMNS.map((c) => `${c}.ilike.%${q}%`).join(","));

      // Stable order so pagination never skips or repeats rows.
      return query.order("national_id", { ascending: true });
    };

    const technicians: AreaPivot = {};
    const workgroups: AreaPivot = {};
    const bump = (pivot: AreaPivot, rbm: string, key: string) => {
      pivot[rbm] ??= {};
      pivot[rbm][key] = (pivot[rbm][key] || 0) + 1;
    };

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      for (const row of data ?? []) {
        const rbm = String(row.RBM).trim();
        const key = `${row.provider}_${row.work_type}`;
        bump(technicians, rbm, key);
        // "ห" prefix also matches heads whose status text was saved with broken encoding.
        if (String(row.workgroup_status || "").trim().startsWith("ห")) bump(workgroups, rbm, key);
      }
      if (!data || data.length < PAGE_SIZE) break;
    }

    const body: AreaCounts = { technicians, workgroups };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error("Area counts API error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

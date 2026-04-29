export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const supabase = supabaseAdmin();

    let allData: { power_authority: string | null; course_g: string | null; course_ec: string | null; course_h: string | null }[] = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("technicians")
        .select("power_authority, course_g, course_ec, course_h")
        .range(from, from + batchSize - 1);

      if (error) {
        console.error("Supabase error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      from += batchSize;
      if (data.length < batchSize) break;
    }

    const total = allData.length;

    // Count records that have a truthy (non-empty, non-null) value for each column
    let powerAuthorityCount = 0;
    let courseGCount = 0;
    let courseEcCount = 0;
    let courseHCount = 0;

    for (const row of allData) {
      const pa = (row.power_authority || "").trim().toLowerCase();
      if (pa === "yes") powerAuthorityCount++;

      if ((row.course_g || "").trim()) courseGCount++;
      if ((row.course_ec || "").trim()) courseEcCount++;
      if ((row.course_h || "").trim()) courseHCount++;
    }

    return NextResponse.json({
      total,
      data: [
        { subject: "อบรมการไฟฟ้า", count: powerAuthorityCount, fullMark: total },
        { subject: "Course G", count: courseGCount, fullMark: total },
        { subject: "Course EC", count: courseEcCount, fullMark: total },
        { subject: "Course H", count: courseHCount, fullMark: total },
      ],
    });
  } catch (err: any) {
    console.error("Training Radar API error:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}

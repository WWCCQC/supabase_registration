export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const COLS =
  "national_id, tech_id, full_name, provider, RBM, CBM, depot_code, depot_name, province, card_expire_date";
const PAGE_SIZE = 1000;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const monthParam = parseInt(url.searchParams.get("month") || "", 10);

    if (!monthParam || monthParam < 1 || monthParam > 12) {
      return NextResponse.json(
        { error: "month must be a number between 1 and 12" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    const currentYear = new Date().getFullYear();
    const yearSuffix = String(currentYear).slice(-2); // "26" for 2026
    const mm = String(monthParam).padStart(2, "0");
    const cardExpireValue = `${mm}/${yearSuffix}`; // e.g. "06/26"

    // Fetch technicians whose card expires in the requested month (format MM/YY)
    const allRows: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("technicians")
        .select(COLS)
        .eq("card_expire_date", cardExpireValue)
        .order("RBM", { ascending: true, nullsFirst: false })
        .order("provider", { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("Supabase error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (data && data.length > 0) {
        allRows.push(...data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    // Determine which of these technicians have renewed (training_type = renew this year)
    const renewedIds = new Set<string>();
    let tFrom = 0;
    let tHasMore = true;

    while (tHasMore) {
      const { data: tPage, error: tError } = await supabase
        .from("training_technician")
        .select("id_card")
        .eq("training_type", "renew")
        .gte("training_date", `${currentYear}-01-01`)
        .lte("training_date", `${currentYear}-12-31`)
        .range(tFrom, tFrom + PAGE_SIZE - 1);

      if (tError) {
        console.error("Training fetch error:", tError);
        break;
      }

      if (tPage && tPage.length > 0) {
        tPage.forEach((row: any) => {
          if (row.id_card) renewedIds.add(row.id_card);
        });
        tFrom += PAGE_SIZE;
        tHasMore = tPage.length === PAGE_SIZE;
      } else {
        tHasMore = false;
      }
    }

    const rows = allRows.map((r: any) => {
      const renewed = r.national_id ? renewedIds.has(r.national_id) : false;
      return {
        national_id: r.national_id ?? "-",
        tech_id: r.tech_id ?? "-",
        full_name: r.full_name ?? "-",
        provider: r.provider ?? "-",
        rsm: r.RBM ?? "-",
        ctm: r.CBM ?? "-",
        depot_code: r.depot_code ?? "-",
        depot_name: r.depot_name ?? "-",
        province: r.province ?? "-",
        card_expire_date: r.card_expire_date ?? "-",
        renew_status: renewed ? "ลงทะเบียนแล้ว" : "ยังไม่ลงทะเบียน",
      };
    });

    const renewCount = rows.filter((r) => r.renew_status === "ลงทะเบียนแล้ว").length;

    return NextResponse.json(
      {
        rows,
        total: rows.length,
        renewCount,
        notRenewedCount: rows.length - renewCount,
        month: monthParam,
        year: currentYear,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    console.error("Card expiry by month error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

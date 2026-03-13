export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin();
    const currentYear = new Date().getFullYear();
    const yearSuffix = String(currentYear).slice(-2); // "26" for 2026

    // Fetch all card_expire_date values with pagination
    let allData: { card_expire_date: string; national_id: string }[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: page, error } = await supabase
        .from("technicians")
        .select("card_expire_date, national_id")
        .not("card_expire_date", "is", null)
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Supabase error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (page && page.length > 0) {
        allData.push(...page);
        from += pageSize;
        hasMore = page.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    // Count by month for current year only (format: MM/YY)
    const monthCounts: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      monthCounts[m] = 0;
    }

    // Collect national_ids from technicians whose card expires this year
    const nationalIdSet = new Set<string>();

    allData.forEach((row) => {
      const val = row.card_expire_date?.trim();
      if (!val) return;

      const match = val.match(/^(\d{2})\/(\d{2})$/);
      if (!match) return;

      const month = parseInt(match[1], 10);
      const year = match[2];

      if (year === yearSuffix && month >= 1 && month <= 12) {
        monthCounts[month]++;
        if (row.national_id) nationalIdSet.add(row.national_id);
      }
    });

    // Fetch training_technician renew records for current year
    let allTraining: { id_card: string; training_date: string }[] = [];
    let tFrom = 0;
    let tHasMore = true;

    while (tHasMore) {
      const { data: tPage, error: tError } = await supabase
        .from("training_technician")
        .select("id_card, training_date")
        .eq("training_type", "renew")
        .gte("training_date", `${currentYear}-01-01`)
        .lte("training_date", `${currentYear}-12-31`)
        .range(tFrom, tFrom + pageSize - 1);

      if (tError) {
        console.error("Training fetch error:", tError);
        break;
      }

      if (tPage && tPage.length > 0) {
        allTraining.push(...tPage);
        tFrom += pageSize;
        tHasMore = tPage.length === pageSize;
      } else {
        tHasMore = false;
      }
    }

    // Count renew training by month (only for technicians in our technicians table)
    const renewCounts: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      renewCounts[m] = 0;
    }

    allTraining.forEach((row) => {
      if (!row.training_date || !row.id_card) return;
      if (!nationalIdSet.has(row.id_card)) return; // only count if in technicians table
      const d = new Date(row.training_date);
      const m = d.getMonth() + 1;
      if (m >= 1 && m <= 12) {
        renewCounts[m]++;
      }
    });

    const thaiMonths = [
      "", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];

    const chartData = [];
    let totalExpiring = 0;
    let totalRenew = 0;

    for (let m = 1; m <= 12; m++) {
      const count = monthCounts[m];
      const renewCount = renewCounts[m];
      totalExpiring += count;
      totalRenew += renewCount;
      chartData.push({
        month: m,
        monthLabel: `${thaiMonths[m]} ${currentYear}`,
        shortLabel: thaiMonths[m],
        count,
        renewCount,
      });
    }

    // Determine current month for highlighting
    const currentMonth = new Date().getMonth() + 1; // 1-12

    return NextResponse.json({
      chartData,
      summary: {
        year: currentYear,
        totalExpiring,
        totalRenew,
        currentMonth,
      },
    });
  } catch (error) {
    console.error("Card expiry trend error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

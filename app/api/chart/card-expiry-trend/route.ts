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
    let allData: { card_expire_date: string }[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: page, error } = await supabase
        .from("technicians")
        .select("card_expire_date")
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
    // Initialize all 12 months
    for (let m = 1; m <= 12; m++) {
      monthCounts[m] = 0;
    }

    allData.forEach((row) => {
      const val = row.card_expire_date?.trim();
      if (!val) return;

      const match = val.match(/^(\d{2})\/(\d{2})$/);
      if (!match) return;

      const month = parseInt(match[1], 10);
      const year = match[2];

      if (year === yearSuffix && month >= 1 && month <= 12) {
        monthCounts[month]++;
      }
    });

    const thaiMonths = [
      "", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];

    const chartData = [];
    let totalExpiring = 0;

    for (let m = 1; m <= 12; m++) {
      const count = monthCounts[m];
      totalExpiring += count;
      chartData.push({
        month: m,
        monthLabel: `${thaiMonths[m]} ${currentYear}`,
        shortLabel: thaiMonths[m],
        count,
      });
    }

    // Determine current month for highlighting
    const currentMonth = new Date().getMonth() + 1; // 1-12

    return NextResponse.json({
      chartData,
      summary: {
        year: currentYear,
        totalExpiring,
        currentMonth,
      },
    });
  } catch (error) {
    console.error("Card expiry trend error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

"use client";
import React from "react";
import StatusGaugeSection, { GREEN_TONE, RED_TONE } from "./StatusGaugeSection";

type PowerEntry = {
  RBM: string;
  HRBM?: string;
  Yes: number;
  No: number;
  total: number;
  CourseG?: number;
  CourseGNo?: number;
  CourseEC?: number;
  CourseECNo?: number;
  totalRbm?: number;
};

type ChartSummary = {
  totalYes?: number;
  totalNo?: number;
  totalCourseG?: number;
  totalCourseEC?: number;
};

type Props = {
  chartData: PowerEntry[];
  chartSummary?: ChartSummary | null;
  chartLoading?: boolean;
};

export default function CourseECGaugeSection({
  chartData,
  chartSummary,
  chartLoading,
}: Props) {
  const rows = chartData.map((d) => ({
    rbm: d.RBM,
    pass: d.CourseEC || 0,
    fail: d.CourseECNo || 0,
  }));

  const totalPass =
    chartSummary?.totalCourseEC ??
    chartData.reduce((s, d) => s + (d.CourseEC || 0), 0);
  const totalFail = chartData.reduce((s, d) => s + (d.CourseECNo || 0), 0);

  return (
    <StatusGaugeSection
      rows={rows}
      totalPass={totalPass}
      totalFail={totalFail}
      loading={chartLoading}
      title="Status by Course EC"
      titleIcon="📙"
      titleIconBg="linear-gradient(160deg, #dcfce7 0%, #bbf7d0 100%)"
      titleIconShadow="0 1px 0 rgba(255,255,255,0.85) inset, 0 2px 5px rgba(22,163,74,0.28)"
      tableTitle="RBM Status by Course EC"
      tableIcon="📊"
      tableIconBg="linear-gradient(160deg, #e0f2fe 0%, #bae6fd 100%)"
      tableIconShadow="0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 5px rgba(2,132,199,0.25)"
      labels={{
        passTile: "✅ ผ่านอบรม",
        failTile: "❌ ไม่ผ่านอบรม",
        colPass: "✅ ผ่านอบรม",
        colFail: "❌ ไม่ผ่านอบรม",
        colPct: "% ผ่านอบรม",
        passHint: "ที่ผ่านอบรม Course EC",
        failHint: "ที่ไม่ผ่านอบรม Course EC",
        modalPass: "📙 Course EC ผ่านอบรม",
        modalFail: "⬜ Course EC ไม่ผ่านอบรม",
      }}
      tone={{ pass: GREEN_TONE, fail: RED_TONE }}
      detail={{
        url: (rbm, status) => {
          const params = new URLSearchParams({
            course: "ec",
            status: status === "pass" ? "pass" : "notpass",
          });
          if (rbm) params.set("rbm", rbm);
          return `/api/chart/course-detail?${params.toString()}`;
        },
        valueKey: "course_ec",
        valueHeader: "Course EC",
        isPass: (v) => String(v).toLowerCase() === "pass",
        passText: "ผ่านอบรม",
        failText: "ไม่ผ่านอบรม",
        filePrefix: "course_ec",
      }}
    />
  );
}

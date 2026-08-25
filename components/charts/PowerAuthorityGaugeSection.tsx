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

export default function PowerAuthorityGaugeSection({
  chartData,
  chartSummary,
  chartLoading,
}: Props) {
  const rows = chartData.map((d) => ({
    rbm: d.RBM,
    pass: d.Yes || 0,
    fail: d.No || 0,
  }));

  return (
    <StatusGaugeSection
      rows={rows}
      totalPass={chartSummary?.totalYes}
      totalFail={chartSummary?.totalNo}
      loading={chartLoading}
      title="Status by Power Authority"
      titleIcon="⚡"
      titleIconBg="linear-gradient(160deg, #fef9c3 0%, #fde68a 100%)"
      titleIconShadow="0 1px 0 rgba(255,255,255,0.8) inset, 0 2px 5px rgba(180,131,10,0.28)"
      tableTitle="RBM Status by Power"
      tableIcon="📊"
      tableIconBg="linear-gradient(160deg, #e0f2fe 0%, #bae6fd 100%)"
      tableIconShadow="0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 5px rgba(2,132,199,0.25)"
      labels={{
        passTile: "✅ ผ่านการอบรม",
        failTile: "❌ ยังไม่ผ่าน",
        colPass: "✅ มีบัตร",
        colFail: "❌ ไม่มีบัตร",
        colPct: "% มีบัตร",
        passHint: "ที่มีบัตรการไฟฟ้า",
        failHint: "ที่ไม่มีบัตรการไฟฟ้า",
        modalPass: "✅ มีบัตรการไฟฟ้า",
        modalFail: "❌ ไม่มีบัตรการไฟฟ้า",
      }}
      tone={{ pass: GREEN_TONE, fail: RED_TONE }}
      detail={{
        url: (rbm, status) => {
          const params = new URLSearchParams({
            power_authority: status === "pass" ? "Yes" : "No",
          });
          if (rbm) params.set("rbm", rbm);
          return `/api/chart/power-authority-detail?${params.toString()}`;
        },
        valueKey: "power_authority",
        valueHeader: "Power Authority",
        isPass: (v) => String(v) === "Yes",
        passText: "มี",
        failText: "ไม่มี",
        filePrefix: "power_authority",
      }}
    />
  );
}

"use client";

import React from "react";
import { AREA_PROVIDERS, WORK_TYPES, WORK_TYPE_LABEL, type AreaPivot } from "@/lib/workTypes";

type Props = { data: AreaPivot; caption: string };

const headerStyle: React.CSSProperties = {
  backgroundColor: "#4472C4",
  color: "white",
  padding: "4px 2px",
  textAlign: "center",
  border: "1px solid #2c5aa0",
  fontWeight: "bold",
  fontSize: "10px",
  lineHeight: "1.2",
};

const cellStyle: React.CSSProperties = {
  padding: "2px 3px",
  border: "1px solid var(--border-strong)",
  textAlign: "right",
  fontSize: "10px",
  lineHeight: "1.2",
};

const rbmCellStyle: React.CSSProperties = {
  ...cellStyle,
  textAlign: "left",
  backgroundColor: "var(--surface-2)",
  fontWeight: 500,
};

const totalCellStyle: React.CSSProperties = {
  ...cellStyle,
  backgroundColor: "color-mix(in srgb, #e3f2fd var(--tint), var(--surface))",
  fontWeight: "bold",
};

const fmt = (n: number) => (n > 0 ? n.toLocaleString() : "");

/** RBM × provider × work type pivot. Every total is summed from the cells, so rows and columns always add up. */
export default function AreaCountTable({ data, caption }: Props) {
  const rbms = Object.keys(data).sort();
  const cell = (rbm: string, provider: string, workType: string) => data[rbm]?.[`${provider}_${workType}`] || 0;
  const providerSum = (rbm: string, provider: string) => WORK_TYPES.reduce((s, w) => s + cell(rbm, provider, w), 0);
  const rbmSum = (rbm: string) => AREA_PROVIDERS.reduce((s, p) => s + providerSum(rbm, p), 0);
  const columnSum = (provider: string, workType?: string) =>
    rbms.reduce((s, rbm) => s + (workType ? cell(rbm, provider, workType) : providerSum(rbm, provider)), 0);
  const grandTotal = rbms.reduce((s, rbm) => s + rbmSum(rbm), 0);

  return (
    <div style={{ overflowX: "auto" }}>
      <table aria-label={caption} style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
        <thead>
          <tr>
            <th scope="col" style={headerStyle} rowSpan={2}>RBM</th>
            <th scope="col" style={headerStyle} rowSpan={2}>รวม</th>
            {AREA_PROVIDERS.map((provider) => (
              <React.Fragment key={provider}>
                <th scope="col" style={headerStyle} rowSpan={2}>{provider}<br />รวม</th>
                <th scope="colgroup" style={headerStyle} colSpan={WORK_TYPES.length}>{provider}</th>
              </React.Fragment>
            ))}
          </tr>
          <tr>
            {AREA_PROVIDERS.map((provider) =>
              WORK_TYPES.map((workType) => (
                <th key={`${provider}_${workType}`} scope="col" style={{ ...headerStyle, whiteSpace: "nowrap", padding: "4px 5px" }} title={`work_type = ${workType}`}>
                  {WORK_TYPE_LABEL[workType]}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          <tr style={{ backgroundColor: "var(--surface-2)" }}>
            <th scope="row" style={{ ...rbmCellStyle, fontWeight: "bold" }}>Grand Total</th>
            <td style={totalCellStyle}>{fmt(grandTotal)}</td>
            {AREA_PROVIDERS.map((provider) => (
              <React.Fragment key={provider}>
                <td style={totalCellStyle}>{fmt(columnSum(provider))}</td>
                {WORK_TYPES.map((workType) => (
                  <td key={workType} style={totalCellStyle}>{fmt(columnSum(provider, workType))}</td>
                ))}
              </React.Fragment>
            ))}
          </tr>

          {rbms.map((rbm) => (
            <tr key={rbm}>
              <th scope="row" style={rbmCellStyle}>{rbm}</th>
              <td style={totalCellStyle}>{fmt(rbmSum(rbm))}</td>
              {AREA_PROVIDERS.map((provider) => (
                <React.Fragment key={provider}>
                  <td style={totalCellStyle}>{fmt(providerSum(rbm, provider))}</td>
                  {WORK_TYPES.map((workType) => (
                    <td key={workType} style={cellStyle}>{fmt(cell(rbm, provider, workType))}</td>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";
import React from "react";

type Row = {
  national_id: string;
  tech_first_name: string;
  tech_last_name: string;
  birth_date: string;
  power_card_start_date: string;
  power_card_expire_date: string;
};

export default function TechTable({ rows }: { rows: Row[] }) {
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Technicians (first 20)</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 900, fontSize: 14 }}>
          <thead>
            <tr>
              {["national_id","tech_first_name","tech_last_name","birth_date","power_card_start_date","power_card_expire_date"].map(h => (
                <th key={h} style={{ border: "1px solid #ddd", padding: "6px 8px", textAlign: "left", background: "#f7f7f7" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.national_id}>
                <td style={{ border: "1px solid #ddd", padding: "6px 8px", fontFamily: "ui-monospace, SFMono-Regular, Menlo" }}>{r.national_id}</td>
                <td style={{ border: "1px solid #ddd", padding: "6px 8px" }}>{r.tech_first_name}</td>
                <td style={{ border: "1px solid #ddd", padding: "6px 8px" }}>{r.tech_last_name}</td>
                <td style={{ border: "1px solid #ddd", padding: "6px 8px" }}>{r.birth_date}</td>
                <td style={{ border: "1px solid #ddd", padding: "6px 8px" }}>{r.power_card_start_date}</td>
                <td style={{ border: "1px solid #ddd", padding: "6px 8px" }}>{r.power_card_expire_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        Data loaded server-side via Supabase service role (never exposed to the browser).
      </p>
    </div>
  );
}

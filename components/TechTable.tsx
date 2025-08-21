"use client";
import React from "react";
import { getFieldLabel } from "../lib/fieldLabels";

/** แถวข้อมูลจาก Supabase (ยืดหยุ่น: รับทุกฟิลด์) */
type Row = Record<string, any>;

/** คอลัมน์ที่ "ตาราง" จะแสดง (เลือกเฉพาะที่ต้องการ) */
const COLS = [
  "national_id",
  "tech_id",
  "full_name",
  "gender",
  "age",
  "degree",
  "doc_tech_card_url",
  "phone",
  "email",
  "workgroup_status",
  "work_type",
  "provider",
  "area",
  "rsm",
  "ctm",
  "depot_code",
  "depot_name",
  "province",
] as const;

/** proxy รูปเพื่อย่อ/ป้องกัน CORS */
function proxyImg(u: string, thumb = false) {
  if (!u) return "";
  return `/api/img?${thumb ? "thumb=1&" : ""}u=${encodeURIComponent(u)}`;
}



export default function TechTable({ rows }: { rows: Row[] }) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [detailPopup, setDetailPopup] = React.useState<Row | null>(null);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
        Technicians ({rows?.length ?? 0} rows)
      </h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 1200, fontSize: 14 }}>
          <thead>
            <tr>
              {COLS.map((h) => (
                <th
                  key={h}
                  style={{
                    border: "1px solid #ddd",
                    padding: "6px 8px",
                    textAlign: "left",
                    background: "#f7f7f7",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getFieldLabel(h)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {(rows || []).map((r, i) => (
              <tr key={`${r.national_id ?? r.tech_id ?? i}`}>
                {COLS.map((c) => {
                  const val = r[c as string];

                  if (c === "doc_tech_card_url") {
                    const original = val || r.tech_card_url || "";
                    if (!original) {
                      return (
                        <td key={c} style={tdStyle}>
                          {/* ค่าว่าง */}
                        </td>
                      );
                    }
                    const imgThumb = proxyImg(original, true);
                    const imgFull = proxyImg(original, false);
                    return (
                      <td key={c} style={tdStyle}>
                        <img
                          src={imgThumb}
                          alt="tech card"
                          loading="lazy"
                          style={{
                            width: 56,
                            height: 56,
                            objectFit: "cover",
                            borderRadius: 6,
                            cursor: "zoom-in",
                            boxShadow: "0 0 0 1px #ddd inset",
                          }}
                          onClick={() => setPreview(imgFull)}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                          }}
                        />
                      </td>
                    );
                  }

                  if (c === "national_id" || c === "tech_id") {
                    return (
                      <td key={c} style={tdStyle}>
                        <span
                          style={{
                            color: "#2563eb",
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontWeight: 500,
                          }}
                          title="คลิกเพื่อดูข้อมูลทั้งหมด"
                          onClick={() => setDetailPopup(r)}
                        >
                          {val ?? ""}
                        </span>
                      </td>
                    );
                  }

                  return (
                    <td key={c} style={tdStyle}>
                      {val ?? ""}
                    </td>
                  );
                })}
              </tr>
            ))}

            {(!rows || rows.length === 0) && (
              <tr>
                <td colSpan={COLS.length} style={{ padding: 12, textAlign: "center", color: "#777" }}>
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Lightbox รูป */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <img
            src={preview}
            alt="preview"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPreview(null)}
            style={{
              position: "fixed",
              top: 16,
              right: 16,
              fontSize: 24,
              color: "#fff",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

      {/* Popup รายละเอียด — แสดงทุกฟิลด์ที่มีใน row */}
      {detailPopup && (
        <div
          onClick={() => setDetailPopup(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 12,
              padding: 24,
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,.3)",
              minWidth: 520,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1f2937" }}>
                  ข้อมูลช่าง: {detailPopup.full_name || detailPopup.tech_id || detailPopup.national_id}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#6b7280" }}>
                  แสดงข้อมูลทั้งหมด {Object.keys(detailPopup).length} ฟิลด์จาก Supabase
                </p>
              </div>
              <button
                onClick={() => setDetailPopup(null)}
                style={{ background: "transparent", border: "none", fontSize: 24, cursor: "pointer", color: "#6b7280" }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {Object.entries(detailPopup).map(([key, value]) => {
                const hasValue = value !== null && value !== undefined && value !== "";

                return (
                  <div
                    key={key}
                    style={{
                      padding: 12,
                      background: hasValue ? "#f9fafb" : "#f3f4f6",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      opacity: hasValue ? 1 : 0.7,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: hasValue ? "#6b7280" : "#9ca3af",
                        marginBottom: 4,
                        fontWeight: 500,
                        textTransform: "uppercase",
                      }}
                    >
                      {labelTH(key)}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        color: hasValue ? "#1f2937" : "#6b7280",
                        wordBreak: "break-word",
                        fontStyle: hasValue ? "normal" : "italic",
                      }}
                    >
                      {key === "doc_tech_card_url" || key === "tech_card_url" ? (
                        value ? (
                          <img
                            src={proxyImg(String(value), false)}
                            alt="tech card"
                            style={{ maxWidth: "100%", height: "auto", borderRadius: 6, border: "1px solid #e5e7eb" }}
                          />
                        ) : (
                          "ไม่มีรูป"
                        )
                      ) : key === "created_at" || key === "updated_at" || key === "__imported_at" ? (
                        value ? new Date(String(value)).toLocaleString("th-TH") : "ไม่ระบุ"
                      ) : hasValue ? (
                        String(value)
                      ) : (
                        "ไม่มีข้อมูล"
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  border: "1px solid #eee",
  padding: "6px 8px",
  whiteSpace: "nowrap",
};

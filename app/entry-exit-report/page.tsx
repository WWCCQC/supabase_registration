"use client";
import React from "react";
import SidebarLayout from "@/components/common/SidebarLayout";
import ProtectedRoute from "@/components/common/ProtectedRoute";

export default function EntryExitReportPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'manager']}>
      <SidebarLayout>
      <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
        
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px 20px"
        }}>
          {/* Header */}
          <div style={{
            background: "white",
            borderRadius: "12px",
            padding: "40px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            border: "1px solid #e5e7eb",
            textAlign: "center"
          }}>
            <div style={{
              fontSize: "72px",
              marginBottom: "20px"
            }}>
              📋
            </div>
            
            <h1 style={{
              fontSize: "32px",
              fontWeight: "700",
              color: "#1f2937",
              marginBottom: "16px"
            }}>
              Technician (Entry & Exit Report)
            </h1>
            
            <div style={{
              display: "inline-block",
              backgroundColor: "#fef3c7",
              border: "2px solid #fbbf24",
              borderRadius: "8px",
              padding: "16px 32px",
              marginTop: "24px"
            }}>
              <div style={{
                fontSize: "20px",
                fontWeight: "600",
                color: "#92400e",
                marginBottom: "8px"
              }}>
                🚧 อยู่ระหว่างการจัดทำข้อมูล
              </div>
              <div style={{
                fontSize: "16px",
                color: "#78350f"
              }}>
                ระบบกำลังอยู่ในขั้นตอนการพัฒนา
              </div>
            </div>
            
            <div style={{
              marginTop: "40px",
              padding: "24px",
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
              textAlign: "left"
            }}>
              <h2 style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "16px"
              }}>
                📝 ฟีเจอร์ที่จะมีในอนาคต:
              </h2>
              <ul style={{
                listStyle: "none",
                padding: 0,
                margin: 0
              }}>
                <li style={{
                  padding: "12px 16px",
                  marginBottom: "8px",
                  backgroundColor: "white",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "15px",
                  color: "#4b5563"
                }}>
                  ✓ รายงานการเข้า-ออกงานของช่าง
                </li>
                <li style={{
                  padding: "12px 16px",
                  marginBottom: "8px",
                  backgroundColor: "white",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "15px",
                  color: "#4b5563"
                }}>
                  ✓ สถิติการทำงานรายวัน/รายเดือน
                </li>
                <li style={{
                  padding: "12px 16px",
                  marginBottom: "8px",
                  backgroundColor: "white",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "15px",
                  color: "#4b5563"
                }}>
                  ✓ ติดตามเวลาเข้า-ออกของช่างแต่ละคน
                </li>
                <li style={{
                  padding: "12px 16px",
                  backgroundColor: "white",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "15px",
                  color: "#4b5563"
                }}>
                  ✓ Export รายงานเป็น Excel
                </li>
              </ul>
            </div>
            
            <div style={{
              marginTop: "32px"
            }}>
              <button
                onClick={() => window.history.back()}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#2563eb"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#3b82f6"}
              >
                ← กลับหน้าหลัก
              </button>
            </div>
          </div>
        </div>
      </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}

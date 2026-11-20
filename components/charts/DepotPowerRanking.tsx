"use client";
import React from "react";

type RankingItem = {
  depot_name: string;
  total_technicians: number;
  with_power_authority: number;
  percentage: string;
};

export default function DepotPowerRanking() {
  const [rankings, setRankings] = React.useState<RankingItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function fetchRankings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chart/depot-power-authority", { cache: "no-store" });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json?.error || "Failed to fetch depot power authority rankings");
      
      setRankings(json.rankings || []);
    } catch (e: any) {
      console.error("Depot Power Authority Ranking fetch error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchRankings();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 16, color: "var(--text-muted)" }}>กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 16, color: "color-mix(in srgb, #ef4444 var(--ink), #fff)" }}>เกิดข้อผิดพลาด: {error}</div>
      </div>
    );
  }

  if (rankings.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 16, color: "#999" }}>ไม่มีข้อมูล</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with refresh button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '500' }}>
          Top 10 Depot - บัตรการไฟฟ้าสูงสุด
        </div>
        <button
          onClick={fetchRankings}
          disabled={loading}
          style={{
            padding: '4px 10px',
            backgroundColor: loading ? 'var(--surface-3)' : '#3b82f6',
            color: loading ? '#9ca3af' : 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: '500'
          }}
        >
          🔄 รีเฟรช
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '13px'
        }}>
          <thead style={{ 
            position: 'sticky', 
            top: 0, 
            backgroundColor: 'var(--surface-2)',
            borderBottom: '2px solid var(--border)'
          }}>
            <tr>
              <th style={{ 
                padding: '10px 8px', 
                textAlign: 'center',
                fontWeight: '600',
                color: 'var(--text-2)',
                width: '50px'
              }}>
                อันดับ
              </th>
              <th style={{ 
                padding: '10px 8px', 
                textAlign: 'left',
                fontWeight: '600',
                color: 'var(--text-2)'
              }}>
                ชื่อ Depot
              </th>
              <th style={{ 
                padding: '10px 8px', 
                textAlign: 'center',
                fontWeight: '600',
                color: 'var(--text-2)',
                width: '80px'
              }}>
                จำนวนช่าง
              </th>
              <th style={{ 
                padding: '10px 8px', 
                textAlign: 'center',
                fontWeight: '600',
                color: 'var(--text-2)',
                width: '100px'
              }}>
                มีบัตรไฟฟ้า
              </th>
              <th style={{ 
                padding: '10px 8px', 
                textAlign: 'center',
                fontWeight: '600',
                color: 'var(--text-2)',
                width: '80px'
              }}>
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((item, index) => (
              <tr 
                key={item.depot_name}
                style={{ 
                  backgroundColor: index % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)',
                  borderBottom: '1px solid var(--border)'
                }}
              >
                <td style={{ 
                  padding: '10px 8px', 
                  textAlign: 'center',
                  fontWeight: '600',
                  color: index < 3 ? '#f59e0b' : 'var(--text-muted)'
                }}>
                  {index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}`}
                </td>
                <td style={{ 
                  padding: '10px 8px', 
                  fontWeight: '500',
                  color: 'var(--text)'
                }}>
                  {item.depot_name}
                </td>
                <td style={{ 
                  padding: '10px 8px', 
                  textAlign: 'center',
                  color: 'var(--text-2)'
                }}>
                  {item.total_technicians.toLocaleString()}
                </td>
                <td style={{ 
                  padding: '10px 8px', 
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#0EAD69'
                }}>
                  {item.with_power_authority.toLocaleString()}
                </td>
                <td style={{ 
                  padding: '10px 8px', 
                  textAlign: 'center',
                  fontWeight: '500',
                  color: 'var(--text-muted)'
                }}>
                  {item.percentage}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{
        marginTop: '12px',
        padding: '8px 12px',
        backgroundColor: 'var(--surface-2)',
        borderRadius: '6px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        แสดงผล 10 อันดับแรก จากทั้งหมด
      </div>
    </div>
  );
}

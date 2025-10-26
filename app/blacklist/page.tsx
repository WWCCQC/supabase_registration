"use client";

import { useState, useEffect, useMemo } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import * as XLSX from 'xlsx';

interface BlacklistItem {
  id: number;
  tech_id?: string;
  name?: string;
  reason?: string;
  created_at?: string;
  [key: string]: any;
}

function BlacklistContent() {
  const [data, setData] = useState<BlacklistItem[]>([]);
  const [allData, setAllData] = useState<BlacklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 50;

  // Advanced search filters
  const [searchCompany, setSearchCompany] = useState('');
  const [searchId, setSearchId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchSurename, setSearchSurename] = useState('');

  useEffect(() => {
    fetchBlacklist();
  }, [currentPage]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchBlacklist = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Fetching Blacklist via API...', { page: currentPage, limit: itemsPerPage });

      const response = await fetch(`/api/blacklist?page=${currentPage}&limit=${itemsPerPage}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.error || 'Failed to fetch blacklist data');
      }

      const result = await response.json();
      
      console.log('✅ API Response:', {
        dataLength: result.data?.length,
        totalCount: result.totalCount,
        page: result.page,
        totalPages: result.totalPages
      });

      setData(result.data || []);
      setTotalCount(result.totalCount || 0);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล');
      console.error('❌ Error fetching blacklist:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    try {
      const response = await fetch(`/api/blacklist?page=1&limit=10000`);
      if (response.ok) {
        const result = await response.json();
        setAllData(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching all data:', err);
    }
  };

  const filteredData = useMemo(() => {
    let filtered = data;
    
    // Apply advanced filters
    if (searchCompany) {
      const searchLower = searchCompany.toLowerCase();
      filtered = filtered.filter(row => 
        row.Company?.toString().toLowerCase().includes(searchLower)
      );
    }
    
    if (searchId) {
      const searchLower = searchId.toLowerCase();
      filtered = filtered.filter(row => 
        row.ID?.toString().toLowerCase().includes(searchLower)
      );
    }
    
    if (searchName) {
      const searchLower = searchName.toLowerCase();
      filtered = filtered.filter(row => 
        row.Name?.toString().toLowerCase().includes(searchLower)
      );
    }
    
    if (searchSurename) {
      const searchLower = searchSurename.toLowerCase();
      filtered = filtered.filter(row => 
        row.Surename?.toString().toLowerCase().includes(searchLower)
      );
    }
    
    // Apply general search if no advanced filters
    if (!searchCompany && !searchId && !searchName && !searchSurename && searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((row) => {
        return Object.values(row).some((value) => 
          value?.toString().toLowerCase().includes(searchLower)
        );
      });
    }
    
    return filtered;
  }, [data, searchTerm, searchCompany, searchId, searchName, searchSurename]);

  const exportToExcel = () => {
    try {
      const dataToExport = searchTerm ? filteredData : allData;
      const columns = dataToExport.length > 0 
        ? Object.keys(dataToExport[0]).filter(col => col !== 'วันที่ Update') 
        : [];

      const exportData = dataToExport.map(row => {
        const newRow: any = {};
        columns.forEach(col => {
          newRow[col] = row[col];
        });
        return newRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Blacklist');
      
      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Blacklist_${date}.xlsx`);
      
      console.log('✅ Exported', exportData.length, 'records to Excel');
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert('เกิดข้อผิดพลาดในการ export ไฟล์');
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const columns = data.length > 0 
    ? Object.keys(data[0]).filter(col => col !== 'วันที่ Update') 
    : [];

  if (loading) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#6b7280' }}>กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#dc2626' }}>เกิดข้อผิดพลาด: {error}</p>
        <button 
          onClick={fetchBlacklist}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '16px'
        }}>
          รายชื่อช่างที่ถูก Blacklist : update ทุกวันเวลา 8.00 น
        </h1>
        
        {/* Advanced Search Filters */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            color: 'white',
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🔍 ค้นหาขั้นสูง
          </div>

          {/* Row 1: Company Search */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              color: 'white',
              fontSize: '13px',
              fontWeight: '500',
              marginBottom: '6px',
              opacity: 0.95
            }}>
              Depot / ชื่อร้าน / ชื่อบริษัท
            </label>
            <input
              type="text"
              placeholder="ค้นหาตามชื่อบริษัท..."
              value={searchCompany}
              onChange={(e) => setSearchCompany(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                outline: 'none',
                backgroundColor: 'rgba(255,255,255,0.95)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'white';
                e.target.style.backgroundColor = 'white';
                e.target.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.3)';
                e.target.style.backgroundColor = 'rgba(255,255,255,0.95)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Row 2: ID, Name, Surname Search */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <label style={{
                display: 'block',
                color: 'white',
                fontSize: '13px',
                fontWeight: '500',
                marginBottom: '6px',
                opacity: 0.95
              }}>
                รหัสพนักงาน
              </label>
              <input
                type="text"
                placeholder="ค้นหารหัส..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderRadius: '8px',
                  outline: 'none',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'white';
                  e.target.style.backgroundColor = 'white';
                  e.target.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.3)';
                  e.target.style.backgroundColor = 'rgba(255,255,255,0.95)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                color: 'white',
                fontSize: '13px',
                fontWeight: '500',
                marginBottom: '6px',
                opacity: 0.95
              }}>
                ชื่อ
              </label>
              <input
                type="text"
                placeholder="ค้นหาชื่อ..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderRadius: '8px',
                  outline: 'none',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'white';
                  e.target.style.backgroundColor = 'white';
                  e.target.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.3)';
                  e.target.style.backgroundColor = 'rgba(255,255,255,0.95)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                color: 'white',
                fontSize: '13px',
                fontWeight: '500',
                marginBottom: '6px',
                opacity: 0.95
              }}>
                นามสกุล
              </label>
              <input
                type="text"
                placeholder="ค้นหานามสกุล..."
                value={searchSurename}
                onChange={(e) => setSearchSurename(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderRadius: '8px',
                  outline: 'none',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'white';
                  e.target.style.backgroundColor = 'white';
                  e.target.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.3)';
                  e.target.style.backgroundColor = 'rgba(255,255,255,0.95)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Clear All Filters Button */}
          {(searchCompany || searchId || searchName || searchSurename) && (
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                onClick={() => {
                  setSearchCompany('');
                  setSearchId('');
                  setSearchName('');
                  setSearchSurename('');
                }}
                style={{
                  padding: '8px 20px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: '2px solid white',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.color = '#667eea';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.color = 'white';
                }}
              >
                ✕ ล้างการค้นหา
              </button>
            </div>
          )}
        </div>
        
        {/* General Search and Export Bar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            placeholder="ค้นหาทั่วไป... (ทุกคอลัมน์)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: '1',
              minWidth: '300px',
              padding: '10px 16px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
          
          <button
            onClick={exportToExcel}
            style={{
              padding: '10px 20px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
          >
            📥 Export Excel
          </button>
        </div>
        
        {(searchTerm || searchCompany || searchId || searchName || searchSurename) && (
          <div style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
            พบ {filteredData.length} รายการจากการค้นหา
          </div>
        )}
      </div>

      {filteredData.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <p style={{ fontSize: '16px', color: '#6b7280' }}>
            {(searchTerm || searchCompany || searchId || searchName || searchSurename) 
              ? 'ไม่พบข้อมูลที่ค้นหา' 
              : 'ไม่พบข้อมูลในตาราง Blacklist'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ 
            overflowX: 'auto',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  {columns.map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#374151',
                        borderBottom: '2px solid #e5e7eb',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, index) => (
                  <tr
                    key={row.id || index}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb'
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        style={{
                          padding: '12px 16px',
                          color: '#6b7280'
                        }}
                      >
                        {row[col] !== null && row[col] !== undefined
                          ? String(row[col])
                          : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              แสดง {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} จาก {totalCount} รายการ
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  backgroundColor: currentPage === 1 ? '#e5e7eb' : '#3b82f6',
                  color: currentPage === 1 ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                แรกสุด
              </button>
              
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  backgroundColor: currentPage === 1 ? '#e5e7eb' : '#3b82f6',
                  color: currentPage === 1 ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                ก่อนหน้า
              </button>
              
              <span style={{ color: '#374151', fontSize: '14px', padding: '0 8px' }}>
                หน้า {currentPage} / {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 12px',
                  backgroundColor: currentPage === totalPages ? '#e5e7eb' : '#3b82f6',
                  color: currentPage === totalPages ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                ถัดไป
              </button>
              
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 12px',
                  backgroundColor: currentPage === totalPages ? '#e5e7eb' : '#3b82f6',
                  color: currentPage === totalPages ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                ท้ายสุด
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function BlacklistPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'manager']}>
      <Navbar />
      <BlacklistContent />
    </ProtectedRoute>
  );
}

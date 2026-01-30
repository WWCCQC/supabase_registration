// components/PivotTable.tsx
"use client";

import React from 'react';

interface PivotData {
  RBM: string;
  provider: string;
  work_type: string;
  count: number;
}

interface PivotTableProps {
  data: PivotData[];
  workgroupData?: Record<string, Record<string, number>>;
  workgroupGrandTotal?: number;
  technicianData?: Record<string, Record<string, number>>;
  loading?: boolean;
}

export default function PivotTable({ data, workgroupData = {}, workgroupGrandTotal = 0, technicianData = {}, loading = false }: PivotTableProps) {
  if (loading) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center',
        background: '#f9fafb',
        borderRadius: 8,
        border: '1px solid #e5e7eb'
      }}>
        กำลังโหลดตาราง Pivot...
      </div>
    );
  }

  // Helper function to format count with workgroup count
  const formatCountWithWorkgroup = (pivotCount: number, rsm: string, key: string) => {
    if (pivotCount === 0) return '';
    
    const workgroupCount = workgroupData[rsm]?.[key] || 0;
    // Use pivotCount (from actual data) instead of technicianData
    const countStr = pivotCount.toLocaleString();
    
    if (workgroupCount > 0) {
      return (
        <span>
          {countStr}
          <span style={{ color: 'red' }}>({workgroupCount.toLocaleString()})</span>
        </span>
      );
    }
    
    return countStr;
  };

  // Get unique RBMs and sort them
  const rsms = Array.from(new Set(data.map(d => d.RBM))).sort();
  
  // Get unique providers
  const providers = ['True Tech', 'WW-Provider', 'เถ้าแก่เทค'];
  const workTypes = ['Installation', 'Repair'];

  // Create pivot structure
  const pivotData: {[rsm: string]: {[key: string]: number}} = {};
  
  // Initialize structure
  rsms.forEach(rsm => {
    pivotData[rsm] = {};
    providers.forEach(provider => {
      workTypes.forEach(workType => {
        const key = `${provider}_${workType}`;
        pivotData[rsm][key] = 0;
      });
    });
  });

  // Fill data
  data.forEach(item => {
    const key = `${item.provider}_${item.work_type}`;
    if (pivotData[item.RBM] && pivotData[item.RBM][key] !== undefined) {
      pivotData[item.RBM][key] = item.count;
    }
  });

  // Calculate totals
  const rsmTotals: {[rsm: string]: {[provider: string]: number}} = {};
  const providerTotals: {[provider: string]: {[workType: string]: number}} = {};
  let grandTotal = 0;

  rsms.forEach(rsm => {
    rsmTotals[rsm] = {};
    providers.forEach(provider => {
      const installCount = pivotData[rsm][`${provider}_Installation`] || 0;
      const repairCount = pivotData[rsm][`${provider}_Repair`] || 0;
      rsmTotals[rsm][provider] = installCount + repairCount;
    });
  });

  providers.forEach(provider => {
    providerTotals[provider] = { Installation: 0, Repair: 0 };
    workTypes.forEach(workType => {
      rsms.forEach(rsm => {
        providerTotals[provider][workType] += pivotData[rsm][`${provider}_${workType}`] || 0;
      });
    });
  });

  // Calculate grand total
  Object.values(providerTotals).forEach(providerData => {
    Object.values(providerData).forEach(count => {
      grandTotal += count;
    });
  });

  // Calculate technician totals
  const technicianProviderTotals: {[provider: string]: {[workType: string]: number}} = {};
  const technicianRsmTotals: {[rsm: string]: {[provider: string]: number}} = {};
  let technicianGrandTotal = 0;

  providers.forEach(provider => {
    technicianProviderTotals[provider] = { Installation: 0, Repair: 0 };
    workTypes.forEach(workType => {
      rsms.forEach(rsm => {
        const technicianCount = technicianData[rsm]?.[`${provider}_${workType}`] || 0;
        technicianProviderTotals[provider][workType] += technicianCount;
      });
    });
  });

  rsms.forEach(rsm => {
    technicianRsmTotals[rsm] = {};
    providers.forEach(provider => {
      const installCount = technicianData[rsm]?.[`${provider}_Installation`] || 0;
      const repairCount = technicianData[rsm]?.[`${provider}_Repair`] || 0;
      technicianRsmTotals[rsm][provider] = installCount + repairCount;
    });
  });

  // Calculate technician grand total
  Object.values(technicianProviderTotals).forEach(providerData => {
    Object.values(providerData).forEach(count => {
      technicianGrandTotal += count;
    });
  });

  // Calculate workgroup grand totals (for provider/worktype breakdown only, use prop for actual grand total)
  const workgroupProviderTotals: {[provider: string]: {[workType: string]: number}} = {};
  const workgroupRsmTotals: {[rsm: string]: {[provider: string]: number}} = {};

  providers.forEach(provider => {
    workgroupProviderTotals[provider] = { Installation: 0, Repair: 0 };
    workTypes.forEach(workType => {
      rsms.forEach(rsm => {
        const workgroupCount = workgroupData[rsm]?.[`${provider}_${workType}`] || 0;
        workgroupProviderTotals[provider][workType] += workgroupCount;
      });
    });
  });

  rsms.forEach(rsm => {
    workgroupRsmTotals[rsm] = {};
    providers.forEach(provider => {
      const installCount = workgroupData[rsm]?.[`${provider}_Installation`] || 0;
      const repairCount = workgroupData[rsm]?.[`${provider}_Repair`] || 0;
      workgroupRsmTotals[rsm][provider] = installCount + repairCount;
    });
  });

  // Helper function for Grand Total row formatting
  const formatGrandTotalWithWorkgroup = (pivotCount: number, provider: string, workType?: string) => {
    if (pivotCount === 0) return '';
    
    let workgroupCount = 0;
    
    if (workType) {
      workgroupCount = workgroupProviderTotals[provider]?.[workType] || 0;
    } else {
      // Provider total
      workgroupCount = (workgroupProviderTotals[provider]?.Installation || 0) + 
                      (workgroupProviderTotals[provider]?.Repair || 0);
    }
    
    // Use pivotCount (from actual data) instead of technicianData
    const countStr = pivotCount.toLocaleString();
    
    if (workgroupCount > 0) {
      return (
        <span>
          {countStr}
          <span style={{ color: 'red' }}>({workgroupCount.toLocaleString()})</span>
        </span>
      );
    }
    
    return countStr;
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '10px',
    fontFamily: 'Arial, sans-serif',
    marginTop: '2px'
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#4472C4',
    color: 'white',
    padding: '4px 2px',
    textAlign: 'center',
    border: '1px solid #2c5aa0',
    fontWeight: 'bold',
    fontSize: '10px',
    width: '50px',
    minWidth: '50px',
    maxWidth: '50px',
    lineHeight: '1.2'
  };

  const cellStyle: React.CSSProperties = {
    padding: '2px 3px',
    border: '1px solid #d1d5db',
    textAlign: 'right',
    width: '50px',
    minWidth: '50px',
    maxWidth: '50px',
    fontSize: '10px',
    lineHeight: '1.2'
  };

  const rsmCellStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    fontWeight: '500',
    width: '80px',
    minWidth: '80px',
    maxWidth: '80px',
    fontSize: '10px'
  };

  const totalCellStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: '#e3f2fd',
    fontWeight: 'bold',
    width: '50px',
    minWidth: '50px',
    maxWidth: '50px',
    fontSize: '10px'
  };

  return (
    <div style={{ 
      overflowX: 'auto', 
      marginBottom: '2px',
      flex: '1',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <table style={{
        ...tableStyle,
        height: '100%'
      }}>
        <thead>
          <tr>
            <th style={headerStyle} rowSpan={2}>RSM</th>
            <th style={headerStyle} rowSpan={2}>Grand Total</th>
            {/* WW-Provider - Total first, then data */}
            <th style={headerStyle} rowSpan={2}>WW-Provider Total</th>
            <th style={headerStyle} colSpan={2}>WW-Provider</th>
            {/* True Tech - Total first, then data */}
            <th style={headerStyle} rowSpan={2}>True Tech Total</th>
            <th style={headerStyle} colSpan={2}>True Tech</th>
            {/* เถ้าแก่เทค - Total first, then data */}
            <th style={headerStyle} rowSpan={2}>เถ้าแก่เทค Total</th>
            <th style={headerStyle} colSpan={2}>เถ้าแก่เทค</th>
          </tr>
          <tr>
            {/* WW-Provider sub-headers */}
            <th style={headerStyle}>Installation</th>
            <th style={headerStyle}>Repair</th>
            {/* True Tech sub-headers */}
            <th style={headerStyle}>Installation</th>
            <th style={headerStyle}>Repair</th>
            {/* เถ้าแก่เทค sub-headers */}
            <th style={headerStyle}>Installation</th>
            <th style={headerStyle}>Repair</th>
          </tr>
        </thead>
        <tbody>
          {/* Grand Total Row - First row */}
          <tr style={{ backgroundColor: '#f3f4f6' }}>
            <td style={{...rsmCellStyle, fontWeight: 'bold'}}>Grand Total</td>
            
            {/* Grand Total */}
            <td style={{...totalCellStyle, fontSize: '10px'}}>
              {grandTotal > 0 ? (
                <span>
                  {grandTotal.toLocaleString()}
                  {workgroupGrandTotal > 0 && <span style={{ color: 'red' }}>({workgroupGrandTotal.toLocaleString()})</span>}
                </span>
              ) : ''}
            </td>
            
            {/* WW-Provider - Total first, then data */}
            <td style={totalCellStyle}>
              {formatGrandTotalWithWorkgroup((providerTotals['WW-Provider']?.Installation || 0) + (providerTotals['WW-Provider']?.Repair || 0), 'WW-Provider')}
            </td>
            <td style={totalCellStyle}>
              {formatGrandTotalWithWorkgroup(providerTotals['WW-Provider']?.Installation || 0, 'WW-Provider', 'Installation')}
            </td>
            <td style={totalCellStyle}>
              {formatGrandTotalWithWorkgroup(providerTotals['WW-Provider']?.Repair || 0, 'WW-Provider', 'Repair')}
            </td>
            
            {/* True Tech - Total first, then data */}
            <td style={totalCellStyle}>
              {formatGrandTotalWithWorkgroup((providerTotals['True Tech']?.Installation || 0) + (providerTotals['True Tech']?.Repair || 0), 'True Tech')}
            </td>
            <td style={totalCellStyle}>
              {formatGrandTotalWithWorkgroup(providerTotals['True Tech']?.Installation || 0, 'True Tech', 'Installation')}
            </td>
            <td style={totalCellStyle}>
              {formatGrandTotalWithWorkgroup(providerTotals['True Tech']?.Repair || 0, 'True Tech', 'Repair')}
            </td>
            
            {/* เถ้าแก่เทค - Total first, then data */}
            <td style={totalCellStyle}>
              {formatGrandTotalWithWorkgroup((providerTotals['เถ้าแก่เทค']?.Installation || 0) + (providerTotals['เถ้าแก่เทค']?.Repair || 0), 'เถ้าแก่เทค')}
            </td>
            <td style={totalCellStyle}>
              {formatGrandTotalWithWorkgroup(providerTotals['เถ้าแก่เทค']?.Installation || 0, 'เถ้าแก่เทค', 'Installation')}
            </td>
            <td style={totalCellStyle}>
              {formatGrandTotalWithWorkgroup(providerTotals['เถ้าแก่เทค']?.Repair || 0, 'เถ้าแก่เทค', 'Repair')}
            </td>
          </tr>

          {/* RSM Data Rows */}
          {rsms.map(rsm => {
            const rsmGrandTotal = Object.values(rsmTotals[rsm]).reduce((sum, val) => sum + val, 0);
            const rsmWorkgroupTotal = Object.values(workgroupRsmTotals[rsm] || {}).reduce((sum, val) => sum + val, 0);
            
            return (
              <tr key={rsm}>
                <td style={rsmCellStyle}>{rsm}</td>
                
                {/* Grand Total first */}
                <td style={totalCellStyle}>
                  {rsmGrandTotal > 0 ? (
                    <span>
                      {rsmGrandTotal.toLocaleString()}
                      {rsmWorkgroupTotal > 0 && <span style={{ color: 'red' }}>({rsmWorkgroupTotal.toLocaleString()})</span>}
                    </span>
                  ) : ''}
                </td>
                
                {/* WW-Provider - Total first, then data */}
                <td style={totalCellStyle}>
                  {rsmTotals[rsm]['WW-Provider'] > 0 ? (
                    <span>
                      {rsmTotals[rsm]['WW-Provider'].toLocaleString()}
                      {workgroupRsmTotals[rsm]?.['WW-Provider'] > 0 && (
                        <span style={{ color: 'red' }}>({workgroupRsmTotals[rsm]['WW-Provider'].toLocaleString()})</span>
                      )}
                    </span>
                  ) : ''}
                </td>
                <td style={cellStyle}>
                  {formatCountWithWorkgroup(pivotData[rsm]['WW-Provider_Installation'] || 0, rsm, 'WW-Provider_Installation')}
                </td>
                <td style={cellStyle}>
                  {formatCountWithWorkgroup(pivotData[rsm]['WW-Provider_Repair'] || 0, rsm, 'WW-Provider_Repair')}
                </td>
                
                {/* True Tech - Total first, then data */}
                <td style={totalCellStyle}>
                  {rsmTotals[rsm]['True Tech'] > 0 ? (
                    <span>
                      {rsmTotals[rsm]['True Tech'].toLocaleString()}
                      {workgroupRsmTotals[rsm]?.['True Tech'] > 0 && (
                        <span style={{ color: 'red' }}>({workgroupRsmTotals[rsm]['True Tech'].toLocaleString()})</span>
                      )}
                    </span>
                  ) : ''}
                </td>
                <td style={cellStyle}>
                  {formatCountWithWorkgroup(pivotData[rsm]['True Tech_Installation'] || 0, rsm, 'True Tech_Installation')}
                </td>
                <td style={cellStyle}>
                  {formatCountWithWorkgroup(pivotData[rsm]['True Tech_Repair'] || 0, rsm, 'True Tech_Repair')}
                </td>
                
                {/* เถ้าแก่เทค - Total first, then data */}
                <td style={totalCellStyle}>
                  {rsmTotals[rsm]['เถ้าแก่เทค'] > 0 ? (
                    <span>
                      {rsmTotals[rsm]['เถ้าแก่เทค'].toLocaleString()}
                      {workgroupRsmTotals[rsm]?.['เถ้าแก่เทค'] > 0 && (
                        <span style={{ color: 'red' }}>({workgroupRsmTotals[rsm]['เถ้าแก่เทค'].toLocaleString()})</span>
                      )}
                    </span>
                  ) : ''}
                </td>
                <td style={cellStyle}>
                  {formatCountWithWorkgroup(pivotData[rsm]['เถ้าแก่เทค_Installation'] || 0, rsm, 'เถ้าแก่เทค_Installation')}
                </td>
                <td style={cellStyle}>
                  {formatCountWithWorkgroup(pivotData[rsm]['เถ้าแก่เทค_Repair'] || 0, rsm, 'เถ้าแก่เทค_Repair')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* หมายเหตุใต้ตาราง */}
      <div style={{
        marginTop: '12px',
        padding: '8px',
        fontSize: '12px',
        color: '#6b7280',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ fontWeight: '500', marginBottom: '4px' }}>หมายเหตุ:</div>
        <div>
          <span style={{ color: '#000000' }}>จำนวนตัวเลขสีดำ = จำนวนคน</span>
          <span style={{ margin: '0 8px', color: '#d1d5db' }}>|</span>
          <span style={{ color: 'red' }}>จำนวนตัวเลขสีแดงใน ( ) = จำนวนกองงาน</span>
        </div>
      </div>
    </div>
  );
}
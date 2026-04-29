// components/tables/WorkgroupCountTable.tsx
"use client";

import React from 'react';

interface WorkgroupCountTableProps {
  workgroupData: Record<string, Record<string, number>>;
  workgroupGrandTotal?: number;
  loading?: boolean;
}

export default function WorkgroupCountTable({ workgroupData, workgroupGrandTotal = 0, loading = false }: WorkgroupCountTableProps) {
  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        กำลังโหลดตาราง...
      </div>
    );
  }

  const rsms = Object.keys(workgroupData).sort();
  const providers = ['WW-Provider', 'True Tech', 'เถ้าแก่เทค'];
  const workTypes = ['Installation', 'Repair'];

  // RSM totals per provider
  const rsmTotals: { [rsm: string]: { [provider: string]: number } } = {};
  rsms.forEach(rsm => {
    rsmTotals[rsm] = {};
    providers.forEach(provider => {
      rsmTotals[rsm][provider] =
        (workgroupData[rsm]?.[`${provider}_Installation`] || 0) +
        (workgroupData[rsm]?.[`${provider}_Repair`] || 0);
    });
  });

  // Provider totals
  const providerTotals: { [provider: string]: { [workType: string]: number } } = {};
  providers.forEach(provider => {
    providerTotals[provider] = { Installation: 0, Repair: 0 };
    workTypes.forEach(workType => {
      rsms.forEach(rsm => {
        providerTotals[provider][workType] += workgroupData[rsm]?.[`${provider}_${workType}`] || 0;
      });
    });
  });

  let grandTotal = 0;
  Object.values(providerTotals).forEach(p => {
    grandTotal += (p.Installation || 0) + (p.Repair || 0);
  });

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#4472C4',
    color: 'white',
    padding: '4px 2px',
    textAlign: 'center',
    border: '1px solid #2c5aa0',
    fontWeight: 'bold',
    fontSize: '10px',
    lineHeight: '1.2',
  };

  const cellStyle: React.CSSProperties = {
    padding: '2px 3px',
    border: '1px solid #d1d5db',
    textAlign: 'right',
    fontSize: '10px',
    lineHeight: '1.2',
  };

  const rsmCellStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    fontWeight: '500',
  };

  const totalCellStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: '#e3f2fd',
    fontWeight: 'bold',
  };

  const fmt = (n: number) => (n > 0 ? n.toLocaleString() : '');

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'Arial, sans-serif' }}>
        <thead>
          <tr>
            <th style={headerStyle} rowSpan={2}>RBM</th>
            <th style={headerStyle} rowSpan={2}>รวม</th>
            <th style={headerStyle} rowSpan={2}>WW-Provider<br/>รวม</th>
            <th style={headerStyle} colSpan={2}>WW-Provider</th>
            <th style={headerStyle} rowSpan={2}>True Tech<br/>รวม</th>
            <th style={headerStyle} colSpan={2}>True Tech</th>
            <th style={headerStyle} rowSpan={2}>เถ้าแก่เทค<br/>รวม</th>
            <th style={headerStyle} colSpan={2}>เถ้าแก่เทค</th>
          </tr>
          <tr>
            <th style={headerStyle}>Installation</th>
            <th style={headerStyle}>Repair</th>
            <th style={headerStyle}>Installation</th>
            <th style={headerStyle}>Repair</th>
            <th style={headerStyle}>Installation</th>
            <th style={headerStyle}>Repair</th>
          </tr>
        </thead>
        <tbody>
          {/* Grand Total Row */}
          <tr style={{ backgroundColor: '#f3f4f6' }}>
            <td style={{ ...rsmCellStyle, fontWeight: 'bold' }}>Grand Total</td>
            <td style={totalCellStyle}>{fmt(workgroupGrandTotal || grandTotal)}</td>
            {providers.map(provider => {
              const provTotal = (providerTotals[provider]?.Installation || 0) + (providerTotals[provider]?.Repair || 0);
              return (
                <React.Fragment key={provider}>
                  <td style={totalCellStyle}>{fmt(provTotal)}</td>
                  <td style={totalCellStyle}>{fmt(providerTotals[provider]?.Installation || 0)}</td>
                  <td style={totalCellStyle}>{fmt(providerTotals[provider]?.Repair || 0)}</td>
                </React.Fragment>
              );
            })}
          </tr>

          {/* RSM Rows */}
          {rsms.map(rsm => {
            const rsmGrandTotal = Object.values(rsmTotals[rsm]).reduce((sum, val) => sum + val, 0);
            return (
              <tr key={rsm}>
                <td style={rsmCellStyle}>{rsm}</td>
                <td style={totalCellStyle}>{fmt(rsmGrandTotal)}</td>
                {providers.map(provider => (
                  <React.Fragment key={provider}>
                    <td style={totalCellStyle}>{fmt(rsmTotals[rsm][provider])}</td>
                    <td style={cellStyle}>{fmt(workgroupData[rsm]?.[`${provider}_Installation`] || 0)}</td>
                    <td style={cellStyle}>{fmt(workgroupData[rsm]?.[`${provider}_Repair`] || 0)}</td>
                  </React.Fragment>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Debug Workgroup Count - ตรวจสอบการนับที่ละเอียด
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugWorkgroupCount() {
  console.log('🔍 เริ่มตรวจสอบการนับ Workgroup แบบละเอียด...\n');

  // 1. ดึงข้อมูลทั้งหมด
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('technicians')
      .select('rsm, provider, work_type, workgroup_status, national_id, full_name')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error || !data || data.length === 0) break;
    
    allData = [...allData, ...data];
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`📊 Total records: ${allData.length}\n`);

  // 2. ดู workgroup_status ทั้งหมด
  const uniqueStatuses = [...new Set(allData.map(r => r.workgroup_status).filter(Boolean))];
  console.log('📊 Unique workgroup_status values found:');
  uniqueStatuses.forEach(status => {
    const count = allData.filter(r => r.workgroup_status === status).length;
    console.log(`   - "${status}": ${count} rows`);
  });
  console.log('');

  // 3. Filter หัวหน้า (รองรับหลายรูปแบบ)
  const headsOnly = allData.filter((row) => {
    const status = row.workgroup_status || "";
    return status === "หัวหน้า" || status === "หัวหน้" || status.startsWith("หัวหน");
  });

  console.log(`📊 Total heads after filtering: ${headsOnly.length}\n`);

  // 4. นับแบบ API ปัจจุบัน (Count ROWS)
  const apiResult = {};
  
  headsOnly.forEach((row) => {
    const rsm = row.rsm || "Unknown";
    const provider = row.provider || "Unknown";
    const workType = row.work_type || "Unknown";

    if (!apiResult[rsm]) {
      apiResult[rsm] = {};
    }

    // Count by provider_worktype
    if (workType === "Installation") {
      const key = `${provider}_Installation`;
      apiResult[rsm][key] = (apiResult[rsm][key] || 0) + 1;
    } else if (workType === "Repair") {
      const key = `${provider}_Repair`;
      apiResult[rsm][key] = (apiResult[rsm][key] || 0) + 1;
    }

    // Count by provider total
    apiResult[rsm][provider] = (apiResult[rsm][provider] || 0) + 1;
  });

  // 5. แสดงผลเปรียบเทียบ
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                    📊 API COUNTING METHOD (Current)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const rsmOrder = [
    'RSM1_BMA-West',
    'RSM2_BMA-East', 
    'RSM3_UPC-East',
    'RSM4_UPC-NOR',
    'RSM5_UPC-NOE1',
    'RSM6_UPC-NOE2',
    'RSM7_UPC-CEW',
    'RSM8_UPC-SOU'
  ];

  console.log('RSM              | TT_Inst | TT_Rep | TT_Tot | WW_Inst | WW_Rep | WW_Tot | เถ้า_Inst | เถ้า_Tot | Total');
  console.log('─────────────────┼─────────┼────────┼────────┼─────────┼────────┼────────┼───────────┼──────────┼──────');

  let grandTotal = 0;
  const providerGrandTotals = { 'True Tech': { Installation: 0, Repair: 0, Total: 0 }, 'WW-Provider': { Installation: 0, Repair: 0, Total: 0 }, 'เถ้าแก่เทค': { Installation: 0, Repair: 0, Total: 0 } };

  rsmOrder.forEach(rsm => {
    if (!apiResult[rsm]) return;
    
    const tt = {
      Installation: apiResult[rsm]['True Tech_Installation'] || 0,
      Repair: apiResult[rsm]['True Tech_Repair'] || 0,
      Total: apiResult[rsm]['True Tech'] || 0
    };
    
    const ww = {
      Installation: apiResult[rsm]['WW-Provider_Installation'] || 0,
      Repair: apiResult[rsm]['WW-Provider_Repair'] || 0,
      Total: apiResult[rsm]['WW-Provider'] || 0
    };
    
    const tao = {
      Installation: apiResult[rsm]['เถ้าแก่เทค_Installation'] || 0,
      Repair: apiResult[rsm]['เถ้าแก่เทค_Repair'] || 0,
      Total: apiResult[rsm]['เถ้าแก่เทค'] || 0
    };

    const rsmTotal = tt.Total + ww.Total + tao.Total;
    grandTotal += rsmTotal;

    // Accumulate provider totals
    providerGrandTotals['True Tech'].Installation += tt.Installation;
    providerGrandTotals['True Tech'].Repair += tt.Repair;
    providerGrandTotals['True Tech'].Total += tt.Total;
    providerGrandTotals['WW-Provider'].Installation += ww.Installation;
    providerGrandTotals['WW-Provider'].Repair += ww.Repair;
    providerGrandTotals['WW-Provider'].Total += ww.Total;
    providerGrandTotals['เถ้าแก่เทค'].Installation += tao.Installation;
    providerGrandTotals['เถ้าแก่เทค'].Repair += tao.Repair;
    providerGrandTotals['เถ้าแก่เทค'].Total += tao.Total;

    // Check if Total = Installation + Repair
    const ttCalculated = tt.Installation + tt.Repair;
    const wwCalculated = ww.Installation + ww.Repair;
    const taoCalculated = tao.Installation + tao.Repair;

    const ttMatch = tt.Total === ttCalculated ? '✅' : '❌';
    const wwMatch = ww.Total === wwCalculated ? '✅' : '❌';
    const taoMatch = tao.Total === taoCalculated ? '✅' : '❌';

    console.log(
      `${rsm.padEnd(16)} | ${String(tt.Installation).padStart(7)} | ${String(tt.Repair).padStart(6)} | ${String(tt.Total).padStart(6)} ${ttMatch} | ` +
      `${String(ww.Installation).padStart(7)} | ${String(ww.Repair).padStart(6)} | ${String(ww.Total).padStart(6)} ${wwMatch} | ` +
      `${String(tao.Installation).padStart(9)} | ${String(tao.Total).padStart(8)} ${taoMatch} | ${String(rsmTotal).padStart(5)}`
    );

    // Show detail if mismatch
    if (tt.Total !== ttCalculated) {
      console.log(`   ⚠️  True Tech: API=${tt.Total}, Calculated=${ttCalculated}, Diff=${tt.Total - ttCalculated}`);
    }
    if (ww.Total !== wwCalculated) {
      console.log(`   ⚠️  WW-Provider: API=${ww.Total}, Calculated=${wwCalculated}, Diff=${ww.Total - wwCalculated}`);
    }
    if (tao.Total !== taoCalculated) {
      console.log(`   ⚠️  เถ้าแก่เทค: API=${tao.Total}, Calculated=${taoCalculated}, Diff=${tao.Total - taoCalculated}`);
    }
  });

  console.log('─────────────────┼─────────┼────────┼────────┼─────────┼────────┼────────┼───────────┼──────────┼──────');
  console.log(
    `Grand Total      | ${String(providerGrandTotals['True Tech'].Installation).padStart(7)} | ${String(providerGrandTotals['True Tech'].Repair).padStart(6)} | ${String(providerGrandTotals['True Tech'].Total).padStart(6)} | ` +
    `${String(providerGrandTotals['WW-Provider'].Installation).padStart(7)} | ${String(providerGrandTotals['WW-Provider'].Repair).padStart(6)} | ${String(providerGrandTotals['WW-Provider'].Total).padStart(6)} | ` +
    `${String(providerGrandTotals['เถ้าแก่เทค'].Installation).padStart(9)} | ${String(providerGrandTotals['เถ้าแก่เทค'].Total).padStart(8)} | ${String(grandTotal).padStart(5)}`
  );

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('                    🔍 DETAILED ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Check if people have duplicate entries
  const nationalIdCounts = {};
  headsOnly.forEach(row => {
    const id = row.national_id;
    if (!id) return;
    
    if (!nationalIdCounts[id]) {
      nationalIdCounts[id] = { count: 0, rows: [] };
    }
    nationalIdCounts[id].count++;
    nationalIdCounts[id].rows.push({
      rsm: row.rsm,
      provider: row.provider,
      work_type: row.work_type,
      name: row.full_name
    });
  });

  const duplicates = Object.entries(nationalIdCounts).filter(([id, data]) => data.count > 1);
  
  if (duplicates.length > 0) {
    console.log(`⚠️  Found ${duplicates.length} people with multiple workgroup head entries:\n`);
    duplicates.slice(0, 10).forEach(([id, data]) => {
      console.log(`National ID: ${id} (${data.rows[0].name})`);
      data.rows.forEach(row => {
        console.log(`   - ${row.rsm} | ${row.provider} | ${row.work_type}`);
      });
      console.log('');
    });

    if (duplicates.length > 10) {
      console.log(`... and ${duplicates.length - 10} more\n`);
    }
  } else {
    console.log('✅ No duplicates found - each person is head of only one workgroup\n');
  }

  console.log('✅ เสร็จสิ้น!\n');
}

debugWorkgroupCount();

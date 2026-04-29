/**
 * สคริปต์เปรียบเทียบข้อมูลระหว่าง API กับ Database จริง
 * เพื่อหาสาเหตุที่ข้อมูลไม่ตรงกัน
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
// Use built-in fetch in Node.js 18+

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const API_BASE = 'http://localhost:3000';

async function compareData() {
  console.log('🔍 เปรียบเทียบข้อมูลระหว่าง API กับ Database จริง...\n');

  try {
    // 1. เปรียบเทียบ Total Count
    console.log('📊 === เปรียบเทียบจำนวนรวม ===');
    
    const { count: dbTotal } = await supabase
      .from('technicians')
      .select('*', { count: 'exact', head: true });
    console.log(`Database: ${dbTotal} รายการ`);

    try {
      const kpiRes = await fetch(`${API_BASE}/api/kpis`);
      const kpiData = await kpiRes.json();
      console.log(`API /api/kpis: ${kpiData.total} รายการ`);
      
      if (dbTotal !== kpiData.total) {
        console.log(`❌ ไม่ตรงกัน! ต่างกัน ${Math.abs(dbTotal - kpiData.total)} รายการ`);
      } else {
        console.log(`✅ ตรงกัน!`);
      }
    } catch (e) {
      console.log(`⚠️  ไม่สามารถเรียก API ได้: ${e.message}`);
      console.log('   โปรดตรวจสอบว่า dev server รันอยู่ที่ http://localhost:3000');
    }
    console.log('');

    // 2. เปรียบเทียบการกระจายตาม Work Type
    console.log('📊 === เปรียบเทียบ Work Type ===');
    
    const { data: dbWorkType } = await supabase
      .from('technicians')
      .select('work_type');
    
    const dbWorkTypeCount = {};
    dbWorkType.forEach(row => {
      const type = row.work_type || 'ไม่ระบุ';
      dbWorkTypeCount[type] = (dbWorkTypeCount[type] || 0) + 1;
    });
    
    console.log('Database:');
    Object.entries(dbWorkTypeCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    
    try {
      const kpiRes = await fetch(`${API_BASE}/api/kpis`);
      const kpiData = await kpiRes.json();
      
      console.log('\nAPI /api/kpis:');
      kpiData.by_work_type.forEach(item => {
        console.log(`  ${item.key}: ${item.count}`);
      });

      // เปรียบเทียบ
      console.log('\n🔍 การเปรียบเทียบ:');
      const apiWorkTypes = {};
      kpiData.by_work_type.forEach(item => {
        apiWorkTypes[item.key] = item.count;
      });

      const allTypes = new Set([
        ...Object.keys(dbWorkTypeCount),
        ...Object.keys(apiWorkTypes)
      ]);

      let hasDiscrepancy = false;
      allTypes.forEach(type => {
        const dbCount = dbWorkTypeCount[type] || 0;
        const apiCount = apiWorkTypes[type] || 0;
        
        if (dbCount !== apiCount) {
          console.log(`  ❌ ${type}: DB=${dbCount}, API=${apiCount} (ต่าง ${Math.abs(dbCount - apiCount)})`);
          hasDiscrepancy = true;
        } else {
          console.log(`  ✅ ${type}: ${dbCount} (ตรงกัน)`);
        }
      });

      if (!hasDiscrepancy) {
        console.log('  ✅ ข้อมูล Work Type ตรงกันทั้งหมด');
      }
    } catch (e) {
      console.log(`\n⚠️  ไม่สามารถเรียก API ได้: ${e.message}`);
    }
    console.log('');

    // 3. เปรียบเทียบการกระจายตาม Provider
    console.log('📊 === เปรียบเทียบ Provider ===');
    
    const { data: dbProvider } = await supabase
      .from('technicians')
      .select('provider');
    
    const dbProviderCount = {};
    dbProvider.forEach(row => {
      const provider = row.provider || 'ไม่ระบุ';
      dbProviderCount[provider] = (dbProviderCount[provider] || 0) + 1;
    });
    
    console.log('Database:');
    Object.entries(dbProviderCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([provider, count]) => {
        console.log(`  ${provider}: ${count}`);
      });
    
    try {
      const kpiRes = await fetch(`${API_BASE}/api/kpis`);
      const kpiData = await kpiRes.json();
      
      console.log('\nAPI /api/kpis:');
      kpiData.by_provider.forEach(item => {
        console.log(`  ${item.key}: ${item.count}`);
      });

      // เปรียบเทียบ
      console.log('\n🔍 การเปรียบเทียบ:');
      const apiProviders = {};
      kpiData.by_provider.forEach(item => {
        apiProviders[item.key] = item.count;
      });

      const allProviders = new Set([
        ...Object.keys(dbProviderCount),
        ...Object.keys(apiProviders)
      ]);

      let hasDiscrepancy = false;
      allProviders.forEach(provider => {
        const dbCount = dbProviderCount[provider] || 0;
        const apiCount = apiProviders[provider] || 0;
        
        if (dbCount !== apiCount) {
          console.log(`  ❌ ${provider}: DB=${dbCount}, API=${apiCount} (ต่าง ${Math.abs(dbCount - apiCount)})`);
          hasDiscrepancy = true;
        } else {
          console.log(`  ✅ ${provider}: ${dbCount} (ตรงกัน)`);
        }
      });

      if (!hasDiscrepancy) {
        console.log('  ✅ ข้อมูล Provider ตรงกันทั้งหมด');
      }
    } catch (e) {
      console.log(`\n⚠️  ไม่สามารถเรียก API ได้: ${e.message}`);
    }
    console.log('');

    // 4. เปรียบเทียบข้อมูล RSM
    console.log('📊 === เปรียบเทียบ RSM (Top 5) ===');
    
    const { data: dbRsm } = await supabase
      .from('technicians')
      .select('rsm');
    
    const dbRsmCount = {};
    dbRsm.forEach(row => {
      const rsm = row.rsm || 'ไม่ระบุ';
      dbRsmCount[rsm] = (dbRsmCount[rsm] || 0) + 1;
    });
    
    console.log('Database (Top 5):');
    Object.entries(dbRsmCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([rsm, count]) => {
        console.log(`  ${rsm}: ${count}`);
      });
    console.log('');

    // 5. ตรวจสอบข้อมูลจากตาราง Technicians โดยตรง (10 รายการแรก)
    console.log('📊 === ตรวจสอบข้อมูลจากตาราง (10 รายการแรก) ===');
    const { data: dbSample } = await supabase
      .from('technicians')
      .select('*')
      .order('tech_id', { ascending: true })
      .limit(10);
    
    console.log('Database:');
    dbSample.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.tech_id} - ${row.full_name}`);
      console.log(`   Work: ${row.work_type}, Provider: ${row.provider}`);
      console.log(`   RSM: ${row.rsm}, Status: ${row.workgroup_status}`);
    });
    console.log('');

    try {
      console.log('API /api/technicians (10 รายการแรก):');
      const techRes = await fetch(`${API_BASE}/api/technicians?page=1&pageSize=10`);
      const techData = await techRes.json();
      
      techData.rows.forEach((row, idx) => {
        console.log(`${idx + 1}. ${row.tech_id} - ${row.full_name}`);
        console.log(`   Work: ${row.work_type}, Provider: ${row.provider}`);
        console.log(`   RSM: ${row.rsm}, Status: ${row.workgroup_status}`);
      });

      // เปรียบเทียบว่าข้อมูลตรงกันหรือไม่
      console.log('\n🔍 การเปรียบเทียบ:');
      let mismatch = false;
      for (let i = 0; i < Math.min(dbSample.length, techData.rows.length); i++) {
        const dbRow = dbSample[i];
        const apiRow = techData.rows[i];
        
        if (dbRow.tech_id !== apiRow.tech_id) {
          console.log(`  ❌ รายการที่ ${i + 1}: tech_id ไม่ตรงกัน (DB: ${dbRow.tech_id}, API: ${apiRow.tech_id})`);
          mismatch = true;
        }
        if (dbRow.work_type !== apiRow.work_type) {
          console.log(`  ❌ รายการที่ ${i + 1}: work_type ไม่ตรงกัน (DB: ${dbRow.work_type}, API: ${apiRow.work_type})`);
          mismatch = true;
        }
      }
      
      if (!mismatch) {
        console.log('  ✅ ข้อมูล 10 รายการแรกตรงกันทั้งหมด');
      }
    } catch (e) {
      console.log(`\n⚠️  ไม่สามารถเรียก API ได้: ${e.message}`);
    }
    console.log('');

    console.log('✅ การเปรียบเทียบเสร็จสมบูรณ์');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    if (error.details) console.error('   รายละเอียด:', error.details);
  }
}

// เรียกใช้ฟังก์ชัน
compareData();

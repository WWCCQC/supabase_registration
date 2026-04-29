# 🔧 แก้ไขปัญหา CTM Provider และ RSM Provider กราฟแสดงค่าไม่ตรงกัน

## 🔍 ปัญหาที่พบ

### CTM Provider Distribution Chart
- **Summary (ตัวเลขด้านบน)**: แสดง WW-Provider = **2,096**
- **กราฟ (แท่งกราฟ)**: แสดง WW-Provider = **2,095**
- **ความแตกต่าง**: 1 record

### RSM Provider Distribution Chart
- มีปัญหาเดียวกัน (summary และกราฟใช้วิธีนับต่างกัน)

## 🎯 สาเหตุ

API ใช้วิธีนับ 2 แบบ:

### วิธีที่ 1: การนับโดยตรงจาก Database (เดิมใช้สำหรับ Summary)
```typescript
const { count, error } = await supabase
  .from("technicians")
  .select("*", { count: "exact", head: true })
  .eq("provider", provider);
```
- นับ **ทุก record** ที่ provider = "WW-Provider"
- รวมทั้ง records ที่ **ไม่มี national_id** หรือ **national_id ซ้ำ**
- ผลลัพธ์: **2,096 records**

### วิธีที่ 2: นับ unique national_id (เดิมใช้สำหรับกราฟ)
```typescript
// Skip if national_id is missing
if (!nationalId) return;

// Add national_id to Set (automatically handles duplicates)
groupedData[ctm][provider].add(nationalId);
```
- นับเฉพาะ **unique national_id**
- กรอง records ที่ **ไม่มี national_id** ออก
- กรอง **national_id ซ้ำ** ออก
- ผลลัพธ์: **2,095 unique IDs**

### ความแตกต่าง
มี **1 record** ของ WW-Provider ที่:
- ไม่มี national_id (null/undefined)
- หรือ national_id ซ้ำกับ record อื่น

จึงถูกกรองออกจากกราฟ แต่ยังนับอยู่ใน summary

## ✅ การแก้ไข

### 1. แก้ไข CTM Provider API
**ไฟล์**: `app/api/chart/ctm-provider/route.ts`

เปลี่ยนจาก:
```typescript
// Calculate summary using exact counts from database
const totalFromExactCounts = Object.values(providerExactCounts).reduce(...);

const summary = {
  totalTechnicians: totalFromExactCounts,  // ❌ ใช้การนับโดยตรง
  providerBreakdown: mainProviders.map((provider) => {
    const count = providerExactCounts[provider] || 0;  // ❌ ค่าไม่ตรงกับกราฟ
    ...
  })
};
```

เป็น:
```typescript
// Calculate summary from grouped data (unique national_id counts - same as chart)
const providerCountsFromGroupedData = {};
mainProviders.forEach(provider => {
  let totalForProvider = 0;
  Object.keys(groupedData).forEach(ctm => {
    totalForProvider += groupedData[ctm][provider]?.size || 0;
  });
  providerCountsFromGroupedData[provider] = totalForProvider;
});

const totalFromGroupedData = Object.values(providerCountsFromGroupedData).reduce(...);

const summary = {
  totalTechnicians: totalFromGroupedData,  // ✅ ใช้ unique national_id
  providerBreakdown: mainProviders.map((provider) => {
    const count = providerCountsFromGroupedData[provider] || 0;  // ✅ ตรงกับกราฟ
    ...
  })
};
```

### 2. แก้ไข RSM Provider API
**ไฟล์**: `app/api/chart/rsm-provider/route.ts`

เปลี่ยนจาก:
```typescript
const summary = {
  providerBreakdown: providers.map((provider) => {
    const count = providerExactCounts[provider] || 0;  // ❌ ค่าไม่ตรงกับกราฟ
    ...
  }),
  providers: providerExactCounts  // ❌ ใช้การนับโดยตรง
};
```

เป็น:
```typescript
const summary = {
  providerBreakdown: providers.map((provider) => {
    const count = (providerSetCounts as any)[provider] || 0;  // ✅ ตรงกับกราฟ
    ...
  }),
  providers: providerSetCounts  // ✅ ใช้ unique national_id
};
```

### 3. เพิ่ม Debug Logs
เพิ่มการแสดงความแตกต่างระหว่าง 2 วิธีนับ:

**CTM Provider**:
```typescript
console.log('Difference (records without national_id or duplicates):', {
  'WW-Provider': (providerExactCounts['WW-Provider'] || 0) - (providerCountsFromGroupedData['WW-Provider'] || 0),
  'True Tech': (providerExactCounts['True Tech'] || 0) - (providerCountsFromGroupedData['True Tech'] || 0),
  'เถ้าแก่เทค': (providerExactCounts['เถ้าแก่เทค'] || 0) - (providerCountsFromGroupedData['เถ้าแก่เทค'] || 0),
});
```

**RSM Provider**:
```typescript
console.log("Difference (direct DB count vs unique national_id):");
console.log(`   WW-Provider: ${(providerExactCounts['WW-Provider'] || 0) - (providerSetCounts['WW-Provider'] || 0)}`);
console.log(`   True Tech: ${(providerExactCounts['True Tech'] || 0) - (providerSetCounts['True Tech'] || 0)}`);
console.log(`   เถ้าแก่เทค: ${(providerExactCounts['เถ้าแก่เทค'] || 0) - (providerSetCounts['เถ้าแก่เทค'] || 0)}`);
```

## 🎯 ผลลัพธ์

### ก่อนแก้ไข
| Provider | Summary | กราฟ | ตรงกัน |
|----------|---------|------|--------|
| WW-Provider | 2,096 | 2,095 | ❌ |
| True Tech | 814 | ? | ❌ |
| เถ้าแก่เทค | 52 | ? | ❌ |

### หลังแก้ไข
| Provider | Summary | กราฟ | ตรงกัน |
|----------|---------|------|--------|
| WW-Provider | 2,095 | 2,095 | ✅ |
| True Tech | xxx | xxx | ✅ |
| เถ้าแก่เทค | xxx | xxx | ✅ |

## 💡 ข้อดีของการแก้ไข

1. **ความสอดคล้อง**: Summary และกราฟแสดงค่าเดียวกัน
2. **ความถูกต้อง**: นับเฉพาะคนที่มี national_id ที่ถูกต้อง (unique)
3. **Debug ง่าย**: มี log แสดงความแตกต่างระหว่าง 2 วิธีนับ
4. **ไม่กระทบระบบ**: ยังคง providerExactCounts ไว้สำหรับ debug

## 📝 หมายเหตุ

- การนับ unique national_id ถูกต้องกว่าเพราะ:
  - กรอง records ที่ไม่มี national_id (ข้อมูลไม่สมบูรณ์)
  - กรอง national_id ซ้ำ (ไม่นับคนซ้ำ)
- ตัวเลขจริงที่แสดงคือ **2,095** ไม่ใช่ 2,096
- ส่วนต่าง 1 record คือ record ที่ไม่มี national_id หรือซ้ำ

## 🧪 การทดสอบ

1. รัน Next.js server: `npm run dev`
2. เปิดหน้าแดชบอร์ด
3. ตรวจสอบกราฟ CTM Provider Distribution
4. ตัวเลข Summary และกราฟควรแสดงค่าเดียวกัน (2,095)

## 🔍 การตรวจสอบเพิ่มเติม

หากต้องการตรวจสอบว่า record ไหนที่ไม่มี national_id:
```sql
SELECT * FROM technicians 
WHERE provider = 'WW-Provider' 
AND (national_id IS NULL OR national_id = '');
```

หากต้องการตรวจสอบ national_id ซ้ำ:
```sql
SELECT national_id, COUNT(*) as count
FROM technicians 
WHERE provider = 'WW-Provider'
GROUP BY national_id 
HAVING COUNT(*) > 1;
```

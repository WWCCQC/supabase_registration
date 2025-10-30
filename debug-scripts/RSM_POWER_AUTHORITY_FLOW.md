# 📊 RSM Power Authority Status - ระบบการดึงข้อมูลและประมวลผล

## 🔄 Flow ทั้งระบบ

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend Browser                             │
│  User เข้าหน้า Dashboard / Refresh หน้า                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │ 1️⃣ Mount Component
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│            RsmWorkgroupChart.tsx (Component)                    │
│                                                                  │
│  - State: chartData, summary, loading, error                   │
│  - Effect: fetchChartData() เมื่อ mount                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │ 2️⃣ HTTP Request (Fetch API)
                       │ cache: "no-store" ✨ (No Cache)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│     /api/chart/rsm-workgroup/route.ts (Backend API)            │
│                                                                  │
│  export const dynamic = "force-dynamic";                        │
│  → ทำให้ยิ่งแน่ใจว่ามันเป็น dynamic ทุกครั้ง                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
            ▼                     ▼
    ╔═══════════════╗      ╔═══════════════╗
    ║  Step 1: Get  ║      ║  Step 2: Get  ║
    ║  Total Count  ║      ║  All Data     ║
    ║  from DB      ║      ║  with Loop    ║
    ╚═══════════════╝      ╚═══════════════╝
            │                     │
            ▼                     ▼
```

---

## 📥 **STEP 1: ดึงจำนวนรายการทั้งหมด**

```typescript
// ⏱️ เวลา: 100-500ms (ขึ้นกับ DB Server)

const { count: totalCount, error: countError } = await supabase
  .from("technicians")
  .select("*", { count: "exact", head: true });

// ผลลัพธ์: totalCount = 2,905 (เช่น)
```

**ทำไมต้องทำ?**
- 🎯 รู้ว่ามีข้อมูลกี่แถวในตัวแปร `totalCount`
- 🛡️ ไว้สำหรับ error handling เมื่อเกิดปัญหา

---

## 📥 **STEP 2: ดึงข้อมูลทั้งหมด (Pagination Loop)**

```typescript
// ⏱️ เวลา: 2-5 วินาที (ขึ้นกับจำนวนข้อมูล)

let allData: any[] = [];
let from = 0;
const pageSize = 1000;
let hasMore = true;

while (hasMore) {
  const { data, error } = await supabase
    .from("technicians")
    .select("rsm, provider, power_authority, national_id")  ← เลือกเฉพาะคอลัมน์ที่ต้อง
    .order("tech_id", { ascending: true })                  ← เรียงลำดับ
    .range(from, from + pageSize - 1);                      ← Pagination
  
  if (data && data.length > 0) {
    allData = [...allData, ...data];
    from += pageSize;
    hasMore = data.length === pageSize;
  } else {
    hasMore = false;
  }
}
```

**ตัวอย่างการดึงข้อมูล:**

| Loop | From | To | Records | Total |
|------|------|-----|---------|-------|
| 1 | 0 | 999 | 1000 | 1000 |
| 2 | 1000 | 1999 | 1000 | 2000 |
| 3 | 2000 | 2999 | 905 | 2905 |
| 4 | 3000 | 3999 | 0 | ❌ Stop |

**ผลลัพธ์:**
```javascript
allData = [
  { rsm: "RSM2_BMA-East", power_authority: "Yes", national_id: "3750100546976", provider: "... },
  { rsm: "RSM7_UPC-CEW", power_authority: "No", national_id: "1759900398701", provider: "... },
  { rsm: "RSM6_UPC-NOE2", power_authority: "Yes", national_id: "3601100964206", provider: "... },
  ...
  // Total: 2,905 records
]
```

---

## 🔄 **STEP 3: ประมวลผล (Data Processing)**

### 🎯 **3.1 - สร้างตัวแปรเก็บข้อมูลสำหรับนับ**

```typescript
// ⏱️ เวลา: 50-200ms

const groupedData: Record<string, { Yes: Set<string>; No: Set<string> }> = {};

const allNationalIds = new Set<string>();
const nationalIdsWithRsm = new Set<string>();
const nationalIdsWithoutRsm = new Set<string>();
const nationalIdsWithAuthority = new Set<string>();
const nationalIdsWithoutAuthority = new Set<string>();
```

**โครงสร้างข้อมูล:**

```javascript
groupedData = {
  "RSM2_BMA-East": {
    Yes: Set { "1234567890123", "1234567890124", ... },    // 50 คน
    No: Set { "3201234567890", "3201234567891", ... }      // 325 คน
  },
  "RSM7_UPC-CEW": {
    Yes: Set { "1111111111111", ... },                      // 90 คน
    No: Set { "2222222222222", ... }                        // 232 คน
  },
  ...
}
```

### 🎯 **3.2 - Loop ผ่านข้อมูลและจัดกลุ่ม**

```typescript
// ⏱️ เวลา: 500ms - 2 วินาที (2,905 records)

allData.forEach((row: any) => {
  // ขั้นที่ 1: สกัดข้อมูลจากแต่ละแถว
  const rsm = String(row.rsm || "").trim();
  const powerAuthority = String(row.power_authority || "").trim();
  const nationalId = String(row.national_id || "").trim();
  
  // ขั้นที่ 2: Skip ถ้า national_id ว่าง
  if (!nationalId || nationalId === "null" || nationalId === "undefined") return;
  
  // ขั้นที่ 3: เพิ่มเข้า Set (ใช้ Set เพื่อไม่ให้นับซ้ำ)
  allNationalIds.add(nationalId);
  
  // ขั้นที่ 4: นับ RSM
  if (rsm && rsm !== "null" && rsm !== "undefined") {
    nationalIdsWithRsm.add(nationalId);
  } else {
    nationalIdsWithoutRsm.add(nationalId);
  }
  
  // ขั้นที่ 5: นับ Power Authority
  if (powerAuthority && powerAuthority !== "null" && powerAuthority !== "undefined") {
    nationalIdsWithAuthority.add(nationalId);
  } else {
    nationalIdsWithoutAuthority.add(nationalId);
  }
  
  // ขั้นที่ 6: Skip ถ้าไม่มี RSM (สำหรับการจัดกลุ่ม)
  if (!rsm || rsm === "null" || rsm === "undefined") return;
  
  // ขั้นที่ 7: สร้าง object สำหรับ RSM นี้ (ถ้ายังไม่มี)
  if (!groupedData[rsm]) {
    groupedData[rsm] = { Yes: new Set<string>(), No: new Set<string>() };
  }
  
  // ขั้นที่ 8: แยก Power Authority เป็น Yes/No และเพิ่มเข้า Set
  const cleanAuthority = powerAuthority.toLowerCase();
  
  if (cleanAuthority === "yes" || cleanAuthority === "y") {
    groupedData[rsm].Yes.add(nationalId);
  } else if (cleanAuthority === "no" || cleanAuthority === "n") {
    groupedData[rsm].No.add(nationalId);
  }
});
```

**ผลลัพธ์หลังจบ Loop:**

| เมตริก | ค่า | หมายเหตุ |
|--------|-----|----------|
| `allNationalIds.size` | 2,905 | ช่างทั้งหมด (unique) |
| `nationalIdsWithRsm.size` | 2,109 | ช่างที่มี RSM (unique) |
| `nationalIdsWithoutRsm.size` | 796 | ช่างที่ไม่มี RSM |
| `nationalIdsWithAuthority.size` | 2,109 | ช่างที่มี Power Authority |
| `nationalIdsWithoutAuthority.size` | 796 | ช่างที่ไม่มี Power Authority |
| `Object.keys(groupedData).length` | 8 | RSM ทั้งหมด |

---

## 📊 **STEP 4: แปลงเป็นรูปแบบ Recharts**

```typescript
// ⏱️ เวลา: 50-100ms

const chartData = Object.entries(groupedData)
  .map(([rsm, counts]) => ({
    rsm,
    Yes: counts.Yes.size,        // นับจำนวนใน Set
    No: counts.No.size,          // นับจำนวนใน Set
    total: counts.Yes.size + counts.No.size
  }))
  .sort((a, b) => b.total - a.total)  // เรียงจากมากไปน้อย
  .slice(0, 20);                      // เอาแค่ top 20 RSM
```

**ผลลัพธ์:**

```javascript
chartData = [
  { rsm: "RSM2_BMA-East", Yes: 50, No: 325, total: 375 },
  { rsm: "RSM7_UPC-CEW", Yes: 90, No: 232, total: 322 },
  { rsm: "RSM3_UPC-East", Yes: 73, No: 194, total: 267 },
  { rsm: "RSM1_BMA-West", Yes: 55, No: 200, total: 255 },
  { rsm: "RSM4_UPC-NOR", Yes: 30, No: 220, total: 250 },
  { rsm: "RSM8_UPC-SOU", Yes: 7, No: 166, total: 173 },
  { rsm: "RSM5_UPC-NOE1", Yes: 12, No: 103, total: 115 },
  { rsm: "RSM6_UPC-NOE2", Yes: 19, No: 88, total: 107 }
]

// Top 20 แสดง 8 RSM เพราะมีแค่ 8 RSM
```

---

## 📈 **STEP 5: คำนวณ Summary**

```typescript
// ⏱️ เวลา: 50ms

const allTotals = Object.values(groupedData);

const totalYes = allTotals.reduce((sum, item) => sum + item.Yes.size, 0);
const totalNo = allTotals.reduce((sum, item) => sum + item.No.size, 0);
const totalTechniciansWithRsm = totalYes + totalNo;
```

**ผลลัพธ์:**

```javascript
summary = {
  totalRsm: 8,                           // RSM ทั้งหมด
  totalTechnicians: 2905,                // ช่างทั้งหมด (unique national_id)
  totalTechniciansWithRsm: 2109,         // ช่างที่มี RSM
  totalYes: 389,                         // ช่างที่มี Power Authority = Yes
  totalNo: 1720,                         // ช่างที่มี Power Authority = No
  recordsWithoutRsm: 796,                // ช่างที่ไม่มี RSM
  recordsWithoutAuthority: 796           // ช่างที่ไม่มี Power Authority
}
```

---

## 📤 **STEP 6: ส่งกลับไปให้ Frontend**

```typescript
// ⏱️ เวลา: 10ms (serialization)

return NextResponse.json(
  { 
    chartData,      // Array ของ RSM พร้อม Yes/No count
    summary         // Summary statistics
  },
  {
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "expires": "0",
    },
  }
);
```

**Response ที่ส่งกลับ:**

```json
{
  "chartData": [
    { "rsm": "RSM2_BMA-East", "Yes": 50, "No": 325, "total": 375 },
    { "rsm": "RSM7_UPC-CEW", "Yes": 90, "No": 232, "total": 322 },
    ...
  ],
  "summary": {
    "totalRsm": 8,
    "totalTechnicians": 2905,
    "totalTechniciansWithRsm": 2109,
    "totalYes": 389,
    "totalNo": 1720,
    "recordsWithoutRsm": 796,
    "recordsWithoutAuthority": 796
  }
}
```

---

## 🎨 **STEP 7: Frontend แสดงผล**

```typescript
// ⏱️ เวลา: 300-500ms (rendering)

// 1. เก็บข้อมูล
setChartData(json.chartData);
setSummary(json.summary);
setLoading(false);

// 2. แสดง Summary Cards
<Card>
  Power Authority: Yes
  {summary.totalYes.toLocaleString()}
</Card>

<Card>
  Power Authority: No
  {summary.totalNo.toLocaleString()}
</Card>

// 3. วาดกราฟ Stacked Bar Chart
<ResponsiveContainer width="100%" height={500}>
  <BarChart data={chartData}>
    <Bar dataKey="Yes" stackId="a" fill="#10b981" name="Yes" />
    <Bar dataKey="No" stackId="a" fill="#f59e0b" name="No" />
  </BarChart>
</ResponsiveContainer>
```

---

## ⏱️ **Timeline รวม**

```
┌─────────────────────────────────────────────────────┐
│ Total Time: 3-8 วินาที (ข้อมูลปกติ 2,905 records)    │
└─────────────────────────────────────────────────────┘

0ms     ├─ Component Mount
        │  └─ fetchChartData()
        │
100ms   ├─ GET /api/chart/rsm-workgroup
        │
150ms   ├─ Get total count (100-500ms)
        │
700ms   ├─ Get all data with loop (2-5s)
        │  ├─ Loop 1: 0-999 (1000 records)
        │  ├─ Loop 2: 1000-1999 (1000 records)
        │  └─ Loop 3: 2000-2904 (905 records)
        │
2700ms  ├─ Process data (500ms-2s)
        │  └─ Loop through 2,905 records
        │  └─ Group by RSM
        │  └─ Count Yes/No
        │
4200ms  ├─ Transform to chart format (50-100ms)
        │  └─ Map to Recharts format
        │  └─ Sort and slice top 20
        │
4300ms  ├─ Calculate summary (50ms)
        │
4350ms  ├─ Send JSON response (10ms)
        │
4360ms  ├─ Frontend receives data
        │  └─ setState (setChartData, setSummary)
        │
4500ms  ├─ Browser renders (300-500ms)
        │  ├─ Summary Cards
        │  ├─ Chart
        │  └─ Info panels
        │
4800ms  └─✅ เห็นกราฟเสร็จ
```

---

## 🔑 **Key Points**

### ✅ **ความพิเศษของระบบ:**

1. **Unique Counting (ไม่นับซ้ำ)**
   - ใช้ `Set` สำหรับเก็บ `national_id`
   - ผลลัพธ์: นับได้ถูกต้อง ไม่ติด duplicate

2. **Pagination Loop**
   - ดึงข้อมูลทีละ 1,000 records
   - ขึ้นกับจำนวน DB บอก
   - เหมาะกับ DB ที่มี connection limit

3. **No Cache**
   - `cache: "no-store"` ใน Frontend
   - `export const dynamic = "force-dynamic"` ใน Backend
   - Realtime data เสมอ

4. **Data Validation**
   - Check `national_id` ให้ไม่ว่าง
   - Check RSM ให้ไม่ว่าง
   - Trim whitespace

5. **Top 20 RSM**
   - `.slice(0, 20)` ป้องกัน overcrowding
   - `.sort((a,b) => b.total - a.total)` เรียงจากมากไปน้อย

### ⚠️ **Performance ที่จะช้า:**

1. 🌐 Network slow
2. 🖥️ Supabase server ไกล
3. 📊 ข้อมูลมากกว่า 10,000 records
4. 💻 Client device weak

---

## 📋 **กรณีศึกษา**

### ตัวอย่าง: 1 Record ผ่าน Process

```
Input:
{
  rsm: "RSM2_BMA-East",
  power_authority: "Yes",
  national_id: "3750100546976",
  provider: "True"
}

Process:
1. Extract: rsm="RSM2_BMA-East", pa="Yes", nid="3750100546976"
2. Check: nid valid? ✅
3. Add to Set: allNationalIds.add("3750100546976")
4. Has RSM? ✅ → nationalIdsWithRsm.add("3750100546976")
5. Create group if not exist: groupedData["RSM2_BMA-East"] = { Yes: Set, No: Set }
6. Clean authority: "yes"
7. Match "yes"? ✅
8. Add to Yes: groupedData["RSM2_BMA-East"].Yes.add("3750100546976")

Output:
groupedData["RSM2_BMA-East"].Yes.size += 1
```

---

## 🎯 **สรุป**

| ขั้นตอน | ทำไม | ผลลัพธ์ | เวลา |
|--------|-----|--------|------|
| Get Count | รู้ว่ามีกี่แถว | totalCount | 100-500ms |
| Get All Data | ดึงข้อมูลทั้งหมด | allData array | 2-5s |
| Create Sets | เตรียมตัวแปรเก็บผล | empty Sets | 50-200ms |
| Process Data | จัดกลุ่ม + นับ | groupedData | 500ms-2s |
| Transform | เตรียมสำหรับ Chart | chartData array | 50-100ms |
| Calculate | นับรวม | summary object | 50ms |
| Response | ส่ง JSON | JSON response | 10ms |
| Render | วาดกราฟ | Visible Chart | 300-500ms |

**Total: 3-8 วินาที** ✨

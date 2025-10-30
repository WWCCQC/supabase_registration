# 🔍 RSM Power Authority Chart - Data Flow Debug

## 📋 คอลัมน์ที่ดึงจาก Supabase

```sql
SELECT rsm, provider, power_authority, national_id
FROM technicians
ORDER BY tech_id ASC
```

**4 คอลัมน์:**
1. ✅ `rsm` - ใช้จัดกลุ่ม
2. ❌ `provider` - ดึงมาแต่ไม่ใช้
3. ✅ `power_authority` - ใช้แยก Yes/No
4. ✅ `national_id` - ใช้นับ unique (ป้องกันนับซ้ำ)

---

## 🔄 ขั้นตอนการประมวลผล

### **Step 1: Fetch Data (Pagination)**
```typescript
.select("rsm, provider, power_authority, national_id")
.range(0, 999)   // หน้า 1
.range(1000, 1999) // หน้า 2
// ... ต่อไปเรื่อย ๆ จนครบทุก record
```

**ผลลัพธ์:** `allData[]` มีข้อมูลทั้งหมด

---

### **Step 2: Loop Through Data**
```typescript
allData.forEach((row) => {
  const rsm = String(row.rsm || "").trim();
  const powerAuthority = String(row.power_authority || "").trim();
  const nationalId = String(row.national_id || "").trim();
  
  // ... ประมวลผลต่อ
})
```

---

### **Step 3: Filter & Validate**
```typescript
// ข้าม record ถ้า:
if (!nationalId || nationalId === "null" || nationalId === "undefined") return; // ❌ ไม่มี ID
if (!rsm || rsm === "null" || rsm === "undefined") return; // ❌ ไม่มี RSM (สำหรับ grouping)
```

**เหตุผล:** ใช้ `national_id` เป็นตัวกำหนดว่านับหรือไม่ (unique key)

---

### **Step 4: Group by RSM**
```typescript
groupedData[rsm] = { Yes: Set<string>(), No: Set<string>() };

// ตัวอย่าง:
groupedData = {
  "RSM2_BMA-East": {
    Yes: Set { "3750100546976", "3601100964206", ... }, // 50 unique IDs
    No: Set { "1759900398701", "1101601458990", ... }   // 325 unique IDs
  },
  "RSM7_UPC-CEW": {
    Yes: Set { "3499900014309", ... }, // 90 unique IDs
    No: Set { "1499900225036", ... }   // 232 unique IDs
  },
  ...
}
```

**Key Point:** ใช้ `Set<string>` ป้องกันนับ national_id ซ้ำ

---

### **Step 5: Categorize Yes/No**
```typescript
const cleanAuthority = powerAuthority.toLowerCase();

if (cleanAuthority === "yes" || cleanAuthority === "y") {
  groupedData[rsm].Yes.add(nationalId); // เพิ่ม ID เข้า Set (ไม่ซ้ำ)
} else if (cleanAuthority === "no" || cleanAuthority === "n") {
  groupedData[rsm].No.add(nationalId);
}
```

**ตัวอย่าง:**
```
Record 1: { rsm: "RSM2_BMA-East", power_authority: "Yes", national_id: "3750100546976" }
         → groupedData["RSM2_BMA-East"].Yes.add("3750100546976") ✅

Record 2: { rsm: "RSM2_BMA-East", power_authority: "Yes", national_id: "3750100546976" }
         → groupedData["RSM2_BMA-East"].Yes.add("3750100546976") ✅ (ไม่ซ้ำเพราะใช้ Set)

Record 3: { rsm: "RSM2_BMA-East", power_authority: "No", national_id: "1759900398701" }
         → groupedData["RSM2_BMA-East"].No.add("1759900398701") ✅
```

---

### **Step 6: Convert to Chart Data**
```typescript
const chartData = Object.entries(groupedData)
  .map(([rsm, counts]) => ({
    rsm: rsm,
    Yes: counts.Yes.size,    // ← นับจำนวน unique IDs ใน Set
    No: counts.No.size,      // ← นับจำนวน unique IDs ใน Set
    total: counts.Yes.size + counts.No.size
  }))
  .sort((a, b) => b.total - a.total) // เรียงจากมากไปน้อย
  .slice(0, 20); // เอาแค่ Top 20
```

**ผลลัพธ์:**
```json
[
  { "rsm": "RSM2_BMA-East", "Yes": 50, "No": 325, "total": 375 },
  { "rsm": "RSM7_UPC-CEW", "Yes": 90, "No": 232, "total": 322 },
  { "rsm": "RSM3_UPC-East", "Yes": 73, "No": 194, "total": 267 },
  ...
]
```

---

### **Step 7: Calculate Summary (ทั้งหมด ไม่ใช่แค่ Top 20)**
```typescript
const allTotals = Object.values(groupedData); // ← ใช้ทุก RSM (ไม่ใช่แค่ Top 20)
const totalYes = allTotals.reduce((sum, item) => sum + item.Yes.size, 0);
const totalNo = allTotals.reduce((sum, item) => sum + item.No.size, 0);
```

**ตัวอย่าง:**
```
groupedData มี 8 RSM:
RSM2: Yes=50, No=325
RSM7: Yes=90, No=232
RSM3: Yes=73, No=194
RSM1: Yes=55, No=200
RSM4: Yes=30, No=220
RSM5: Yes=28, No=189
RSM6: Yes=51, No=166
RSM8: Yes=12, No=194

totalYes = 50+90+73+55+30+28+51+12 = 389 ✅
totalNo  = 325+232+194+200+220+189+166+194 = 1720 ✅
```

---

## ⚠️ ปัญหาที่อาจเกิด

### **ปัญหา 1: Legend แสดงยอดรวมผิด**

**เดิม (ใน TechBrowser.tsx):**
```typescript
// ❌ ใช้ chartSummary.totalYes/totalNo (ยอดรวมทั้งหมด 8 RSM)
formatter={(value: string) => {
  if (value === "Yes" && chartSummary?.totalYes) {
    return `${value} (${chartSummary.totalYes.toLocaleString()})`; // 389
  }
  if (value === "No" && chartSummary?.totalNo) {
    return `${value} (${chartSummary.totalNo.toLocaleString()})`; // 1,720
  }
}}
```

**ใหม่ (แก้แล้ว):**
```typescript
// ✅ คำนวณจาก chartData ที่แสดงจริง (Top 8 หรือ Top 20)
formatter={(value: string) => {
  const displayedYes = chartData.reduce((sum, item) => sum + (item.Yes || 0), 0);
  const displayedNo = chartData.reduce((sum, item) => sum + (item.No || 0), 0);
  
  if (value === "Yes") return `${value} (${displayedYes.toLocaleString()})`;
  if (value === "No") return `${value} (${displayedNo.toLocaleString()})`;
}}
```

**ผลลัพธ์:**
```
แสดงแค่ Top 8:
Legend: Yes (389), No (1,720) ← จากทั้งหมด 8 RSM
กราฟ: แสดง 8 แท่ง แต่ตัวเลขรวมกันได้ 389 + 1720 ✅
```

---

### **ปัญหา 2: ตัวเลขในแท่งไม่ตรง**

**สาเหตุที่เป็นไปได้:**

#### **2.1 Data Mismatch (ข้อมูลไม่ตรงกัน)**
```
Database มีข้อมูลใหม่:
- เพิ่ม/ลบ technician
- เปลี่ยน power_authority
- เปลี่ยน RSM

→ ต้อง Refresh กราฟ
```

#### **2.2 Duplicate National IDs**
```typescript
// ถ้ามี duplicate:
Record 1: { national_id: "3750100546976", power_authority: "Yes" }
Record 2: { national_id: "3750100546976", power_authority: "Yes" } ← ซ้ำ
Record 3: { national_id: "3750100546976", power_authority: "No" }  ← ซ้ำ + ขัดแย้ง

// ปัจจุบันระบบจะ:
Set.add("3750100546976") → เก็บแค่ครั้งเดียว
แต่ถ้า record มี power_authority ต่างกัน → อาจนับ Yes หรือ No (ขึ้นกับ record สุดท้าย)
```

#### **2.3 Null/Empty Values**
```typescript
// ข้าม record ถ้า:
if (!nationalId) return; // ❌
if (!rsm) return; // ❌
if (!powerAuthority) { } // ไม่นับใน Yes/No
```

---

## 🔧 วิธีตรวจสอบ

### **1. ตรวจสอบจำนวน Records ที่ดึงมา**
```bash
# ดูใน Console Log:
📊 Chart API: Fetched 2905 records from database
```

### **2. ตรวจสอบการจัดกลุ่ม**
```bash
# ดูใน Console Log:
📊 Chart Summary: Total RSM: 8, Total Technicians with RSM: 2109, Yes: 389, No: 1720
```

### **3. ตรวจสอบข้อมูลใน Database**
```sql
-- ตรวจสอบจำนวน technicians แต่ละ RSM
SELECT 
  rsm,
  power_authority,
  COUNT(DISTINCT national_id) as unique_count
FROM technicians
WHERE rsm IS NOT NULL 
  AND national_id IS NOT NULL
GROUP BY rsm, power_authority
ORDER BY rsm, power_authority;
```

**ผลลัพธ์ที่คาดหวัง:**
```
rsm              | power_authority | unique_count
-----------------+-----------------+-------------
RSM1_BMA-West    | No              | 200
RSM1_BMA-West    | Yes             | 55
RSM2_BMA-East    | No              | 325
RSM2_BMA-East    | Yes             | 50
RSM3_UPC-East    | No              | 194
RSM3_UPC-East    | Yes             | 73
...
```

### **4. ตรวจสอบ Duplicate National IDs**
```sql
-- หา national_id ที่มีมากกว่า 1 record
SELECT 
  national_id,
  COUNT(*) as record_count,
  STRING_AGG(DISTINCT power_authority::TEXT, ', ') as authorities,
  STRING_AGG(DISTINCT rsm::TEXT, ', ') as rsms
FROM technicians
WHERE national_id IS NOT NULL
GROUP BY national_id
HAVING COUNT(*) > 1
ORDER BY record_count DESC
LIMIT 10;
```

---

## 📊 ตัวอย่างข้อมูลจริง

### **Database (Raw Data):**
```
national_id      | rsm            | power_authority
-----------------+----------------+----------------
3750100546976    | RSM2_BMA-East  | Yes
1759900398701    | RSM2_BMA-East  | No
3601100964206    | RSM2_BMA-East  | Yes
3499900014309    | RSM7_UPC-CEW   | Yes
1499900225036    | RSM7_UPC-CEW   | No
... (รวม 2,905 records)
```

### **Grouped Data:**
```json
{
  "RSM2_BMA-East": {
    "Yes": ["3750100546976", "3601100964206", ...], // 50 unique IDs
    "No": ["1759900398701", ...] // 325 unique IDs
  },
  "RSM7_UPC-CEW": {
    "Yes": ["3499900014309", ...], // 90 unique IDs
    "No": ["1499900225036", ...] // 232 unique IDs
  }
}
```

### **Chart Data (Top 20):**
```json
[
  { "rsm": "RSM2_BMA-East", "Yes": 50, "No": 325, "total": 375 },
  { "rsm": "RSM7_UPC-CEW", "Yes": 90, "No": 232, "total": 322 },
  { "rsm": "RSM3_UPC-East", "Yes": 73, "No": 194, "total": 267 }
]
```

### **Summary (ทั้งหมด 8 RSM):**
```json
{
  "totalRsm": 8,
  "totalTechnicians": 2905,
  "totalTechniciansWithRsm": 2109,
  "totalYes": 389,
  "totalNo": 1720,
  "recordsWithoutRsm": 796,
  "recordsWithoutAuthority": 796
}
```

---

## ✅ สรุป

**คอลัมน์ที่ใช้:**
- ✅ `rsm` → จัดกลุ่ม, X-axis label
- ✅ `power_authority` → แยก Yes/No
- ✅ `national_id` → นับ unique (ป้องกันซ้ำ)
- ❌ `provider` → ไม่ใช้

**การนับ:**
- ใช้ `Set<string>` เก็บ `national_id` → ป้องกันนับซ้ำ
- `.size` = จำนวน unique IDs

**สูตร:**
```
Yes Count = groupedData[rsm].Yes.size
No Count  = groupedData[rsm].No.size
Total     = Yes + No
```

**ถ้าจำนวนไม่ตรง ให้ตรวจสอบ:**
1. ข้อมูลใน Database เปลี่ยนไหม?
2. มี duplicate national_id ไหม?
3. มี null values เยอะไหม?
4. Legend แสดงยอดรวมจาก chartData หรือ chartSummary?

# 📋 RSM Power Authority Status - การดึงและใช้คอลัมน์

## 🎯 คอลัมน์ที่ดึงมาจาก Supabase

```typescript
.select("rsm, provider, power_authority, national_id")
         ↑        ↑              ↑            ↑
         1️⃣      2️⃣            3️⃣           4️⃣
```

### **คอลัมน์ที่ดึง (4 คอลัมน์):**

| # | คอลัมน์ | ชนิด | ตัวอย่าง | ใช้ในการคำนวน |
|---|---------|------|---------|--------------|
| 1️⃣ | **rsm** | String | "RSM2_BMA-East" | ✅ จัดกลุ่ม + นับ |
| 2️⃣ | **provider** | String | "True", "AIS" | ❌ ไม่ใช้ |
| 3️⃣ | **power_authority** | String | "Yes", "No" | ✅ แยก Yes/No + นับ |
| 4️⃣ | **national_id** | String | "3750100546976" | ✅ Unique counting |

---

## 📊 รายละเอียดการใช้แต่ละคอลัมน์

### 1️⃣ **rsm** - ชื่อ RSM (Regional Sales Manager)

**ดึงมา:**
```typescript
const rsm = String(row.rsm || "").trim();
```

**ใช้ในไหน:**

| ขั้นตอน | งาน | รายละเอียด |
|--------|-----|-----------|
| **Validation** | ตรวจสอบว่ามีค่า | `if (rsm && rsm !== "null")` → ข้ามถ้าว่าง |
| **Grouping** | จัดกลุ่มข้อมูล | `groupedData[rsm] = { Yes, No }` |
| **Counting RSM** | นับจำนวน RSM ที่ไม่ซ้ำ | `Object.keys(groupedData).length` |
| **Chart Label** | แสดงชื่อใน Chart | X-axis: RSM names |
| **Summary** | คำนวณ totalRsm | `Object.keys(groupedData).length` |

**ตัวอย่างผลลัพธ์:**

```javascript
groupedData = {
  "RSM2_BMA-East": { Yes: Set(50), No: Set(325) },
  "RSM7_UPC-CEW": { Yes: Set(90), No: Set(232) },
  "RSM3_UPC-East": { Yes: Set(73), No: Set(194) },
  // ... รวม 8 RSM ทั้งหมด
}

// นับจำนวน RSM
Object.keys(groupedData).length = 8
```

---

### 2️⃣ **provider** - ผู้ให้บริการ

**ดึงมา:**
```typescript
// ดึงแต่ไม่ได้ใช้ (เหมือนการเรียก API แล้วไม่ใช้ข้อมูล)
```

**ใช้ในไหน:**

| ขั้นตอน | ใช้? | หมายเหตุ |
|--------|-----|---------|
| **Validation** | ❌ | ไม่มีการตรวจสอบ |
| **Grouping** | ❌ | ไม่มีการจัดกลุ่ม |
| **Counting** | ❌ | ไม่มีการนับ |
| **Chart** | ❌ | ไม่แสดง |
| **Summary** | ❌ | ไม่ใช้ |

**ทำไมดึงแต่ไม่ใช้?**
- 🤔 อาจเป็นข้อมูลเสริม สำหรับ future feature
- 🤔 ดึงมาเพื่อ optimization (ลดจำนวน queries)
- 🤔 เหลือไว้จากการ refactor

---

### 3️⃣ **power_authority** - อำนาจ Yes/No ⭐ สำคัญ

**ดึงมา:**
```typescript
const powerAuthority = String(row.power_authority || "").trim();
```

**ใช้ในไหน:**

| ขั้นตอน | งาน | รายละเอียด |
|--------|-----|-----------|
| **Validation** | ตรวจสอบว่ามีค่า | `if (powerAuthority !== "null")` |
| **Existence Check** | นับมี/ไม่มี Authority | `nationalIdsWithAuthority.add(nationalId)` |
| **Categorization** | แยก Yes/No | `cleanAuthority === "yes"` → Yes Set |
| | | `cleanAuthority === "no"` → No Set |
| **Grouping** | เพิ่มเข้า Group | `groupedData[rsm].Yes/No.add(nationalId)` |
| **Summary** | นับ totalYes/No | `item.Yes.size` + `item.No.size` |
| **Chart Data** | แสดงค่า | `Yes: counts.Yes.size, No: counts.No.size` |

**ตัวอย่างการประมวลผล:**

```javascript
// ข้อมูลดิบ
power_authority = "Yes"   // หรือ "NO", "yes", "NO", "n", "Y"

// Step 1: Clean (แปลงเป็นตัวพิมพ์เล็ก)
cleanAuthority = "yes"

// Step 2: Match
if (cleanAuthority === "yes" || cleanAuthority === "y") {
  groupedData["RSM2_BMA-East"].Yes.add("3750100546976")
  nationalIdsWithAuthority.add("3750100546976")
} else if (cleanAuthority === "no" || cleanAuthority === "n") {
  groupedData["RSM2_BMA-East"].No.add("3750100546976")
  nationalIdsWithAuthority.add("3750100546976")
}
```

**ตัวอย่างผลลัพธ์:**

```javascript
// สำหรับ RSM2_BMA-East
groupedData["RSM2_BMA-East"] = {
  Yes: Set { "3750100546976", "1759900398701", ... },  // 50 คน
  No: Set { "3601100964206", "3499900014309", ... }    // 325 คน
}

// Chart data
{
  rsm: "RSM2_BMA-East",
  Yes: 50,
  No: 325,
  total: 375
}

// Summary
totalYes: 389
totalNo: 1720
```

**ค่าที่ยอมรับ:**
```javascript
// Yes values
"Yes", "yes", "YES", "y", "Y"

// No values
"No", "no", "NO", "n", "N"

// Other values
ถูก skip (ไม่นับเป็น Yes หรือ No)
```

---

### 4️⃣ **national_id** - เลขประจำตัวประชาชน ⭐ สำคัญ

**ดึงมา:**
```typescript
const nationalId = String(row.national_id || "").trim();
```

**ใช้ในไหน:**

| ขั้นตอน | งาน | รายละเอียด |
|--------|-----|-----------|
| **Validation** | ตรวจสอบว่ามีค่า | `if (!nationalId) return;` → ข้ามถ้าว่าง |
| **Unique Counting** | นับไม่ซ้ำ | `allNationalIds.add(nationalId)` |
| **RSM Existence** | นับรอบ RSM | `nationalIdsWithRsm.add(nationalId)` |
| **Authority Count** | นับรอบ Authority | `nationalIdsWithAuthority.add(nationalId)` |
| **Grouping** | บันทึกใน Group | `groupedData[rsm].Yes/No.add(nationalId)` |
| **Size Count** | นับจำนวนใน Set | `.size` (e.g., `counts.Yes.size`) |

**ทำไมต้องใช้ national_id?**

✅ **ไม่นับซ้ำ (Unique):**
```javascript
// Without national_id (ถ้านับแค่ records)
1,000 records → 1,000
แต่ถ้า 1 คน มีหลาย records → นับเยอะกว่า ❌

// With national_id (ใช้ Set)
1,000 records → 950 unique people
ตัวตนตรง + ไม่นับซ้ำ ✅
```

**ตัวอย่างผลลัพธ์:**

```javascript
// All national IDs
allNationalIds = Set { 
  "3750100546976",
  "1759900398701",
  "3601100964206",
  ... 
}
allNationalIds.size = 2,905  // ช่างทั้งหมด (unique)

// National IDs with RSM
nationalIdsWithRsm = Set {
  "3750100546976",
  "1759900398701",
  ...
}
nationalIdsWithRsm.size = 2,109  // ช่างที่มี RSM

// National IDs with Authority
nationalIdsWithAuthority = Set {
  "3750100546976",
  "1759900398701",
  ...
}
nationalIdsWithAuthority.size = 2,109  // ช่างที่มี Power Authority

// Grouped data
groupedData["RSM2_BMA-East"].Yes = Set {
  "3750100546976",  // ← บันทึก ID เพื่อนับ .size
  "1111111111111",
  ...
}
groupedData["RSM2_BMA-East"].Yes.size = 50
```

---

## 🔄 **Flow การใช้คอลัมน์ทั้งหมด**

```
┌─────────────────────────────────────────────────────────┐
│ SELECT: rsm, provider, power_authority, national_id    │
│         ↓        ↓              ↓            ↓          │
│         ✅      ❌             ✅            ✅         │
│         ใช้     ไม่ใช้         ใช้           ใช้        │
└─────────────────────────────────────────────────────────┘
                         ↓
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
    ┌─────────────────┐            ┌──────────────────┐
    │ Validate Row    │            │ Check Values     │
    │                 │            │                  │
    │ • national_id ✅│            │ • national_id ✅  │
    │   (not empty)   │            │   (not null)     │
    │                 │            │ • rsm ✅         │
    │                 │            │   (not null)     │
    │                 │            │ • power_auth ✅  │
    │                 │            │   (not null)     │
    └────────┬────────┘            └────────┬─────────┘
             │ SKIP if invalid             │ proceed
             │                             │
             ▼                             ▼
        ┌────────────────────────────────────────────────┐
        │ Add to Sets (For Unique Counting)              │
        │                                                │
        │ 1. allNationalIds.add(national_id)            │
        │    ↳ ตั้งนับจำนวนช่างทั้งหมด                  │
        │                                                │
        │ 2. if (rsm has value)                         │
        │    nationalIdsWithRsm.add(national_id)        │
        │    ↳ นับช่างที่มี RSM                          │
        │                                                │
        │ 3. if (power_authority has value)             │
        │    nationalIdsWithAuthority.add(national_id)  │
        │    ↳ นับช่างที่มี Power Authority             │
        └─────────────┬──────────────────────────────────┘
                      │
        ┌─────────────┴───────────────┐
        │ Create Group if Not Exist   │
        │                             │
        │ if (rsm has value) {        │
        │   if (!groupedData[rsm]) {  │
        │     groupedData[rsm] = {    │
        │       Yes: new Set(),       │
        │       No: new Set()         │
        │     }                       │
        │   }                         │
        └─────────────┬───────────────┘
                      │
        ┌─────────────┴──────────────────────────────────┐
        │ Categorize Power Authority into Yes/No         │
        │                                                │
        │ clean = power_authority.toLowerCase()         │
        │                                                │
        │ if (clean === "yes" || clean === "y") {       │
        │   groupedData[rsm].Yes.add(national_id)       │
        │   ↳ เพิ่มเข้า Yes group                        │
        │ } else if (clean === "no" || clean === "n") { │
        │   groupedData[rsm].No.add(national_id)        │
        │   ↳ เพิ่มเข้า No group                         │
        │ }                                              │
        └─────────────┬──────────────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────────────────────────┐
        │ Result: groupedData Structure                │
        │                                              │
        │ {                                            │
        │   "RSM2_BMA-East": {                        │
        │     Yes: Set(50),    ← 50 unique people    │
        │     No: Set(325)     ← 325 unique people   │
        │   },                                         │
        │   "RSM7_UPC-CEW": {                         │
        │     Yes: Set(90),                          │
        │     No: Set(232)                           │
        │   }                                          │
        │   ...                                        │
        │ }                                            │
        └──────────────────────────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────────────────────────┐
        │ Transform & Calculate Summary                │
        │                                              │
        │ • Count Yes.size for each RSM               │
        │ • Count No.size for each RSM                │
        │ • Sum all Yes → totalYes = 389             │
        │ • Sum all No → totalNo = 1,720             │
        │ • Count RSMs → totalRsm = 8                │
        │ • Total people → totalTechnicians = 2,905  │
        └──────────────────────────────────────────────┘
```

---

## 📈 **ตัวอย่าง: 1 Record ผ่าน Full Process**

```
Input Record from Supabase:
{
  "rsm": "RSM2_BMA-East",
  "provider": "True",
  "power_authority": "Yes",
  "national_id": "3750100546976"
}

Step 1: Extract
┌─────────────────────────────────────────┐
│ rsm = "RSM2_BMA-East"                   │
│ provider = "True"        ← ไม่ได้ใช้    │
│ powerAuthority = "Yes"                  │
│ nationalId = "3750100546976"            │
└─────────────────────────────────────────┘

Step 2: Validate
┌─────────────────────────────────────────┐
│ nationalId ? ✅ "3750100546976" exists  │
│ → Continue                              │
└─────────────────────────────────────────┘

Step 3: Add to Global Sets
┌─────────────────────────────────────────┐
│ allNationalIds.add("3750100546976")     │
│ → allNationalIds.size += 1              │
│                                         │
│ nationalIdsWithRsm.add("3750100546976") │
│ → nationalIdsWithRsm.size += 1          │
│                                         │
│ nationalIdsWithAuthority.add(...)       │
│ → nationalIdsWithAuthority.size += 1    │
└─────────────────────────────────────────┘

Step 4: Check if RSM Exists
┌─────────────────────────────────────────┐
│ rsm = "RSM2_BMA-East" ? ✅ Yes          │
│ → Continue to Step 5                    │
└─────────────────────────────────────────┘

Step 5: Create Group if Not Exist
┌─────────────────────────────────────────┐
│ groupedData["RSM2_BMA-East"] exists ?   │
│ No → Create                             │
│                                         │
│ groupedData["RSM2_BMA-East"] = {        │
│   Yes: new Set(),                       │
│   No: new Set()                         │
│ }                                       │
└─────────────────────────────────────────┘

Step 6: Clean Power Authority
┌─────────────────────────────────────────┐
│ powerAuthority = "Yes"                  │
│ cleanAuthority = "yes"                  │
│ (toLowerCase())                         │
└─────────────────────────────────────────┘

Step 7: Match and Add to Group
┌─────────────────────────────────────────┐
│ cleanAuthority === "yes" ? ✅ Yes       │
│                                         │
│ groupedData["RSM2_BMA-East"].Yes.add(   │
│   "3750100546976"                       │
│ )                                       │
│ → Yes.size += 1                         │
└─────────────────────────────────────────┘

Final State:
┌──────────────────────────────────────────────┐
│ groupedData["RSM2_BMA-East"] = {             │
│   Yes: Set { "3750100546976", ... },        │
│   No: Set { ... }                           │
│ }                                           │
│                                             │
│ allNationalIds.size = (previous + 1)       │
│ nationalIdsWithRsm.size = (previous + 1)   │
│ nationalIdsWithAuthority.size = (prev + 1) │
└──────────────────────────────────────────────┘
```

---

## 🎯 **สรุปการใช้คอลัมน์**

```
┌─────────────────────────────────────────────────────────────┐
│ คอลัมน์         │ ใช้? │ งาน                                │
├──────────────┼─────┼─────────────────────────────────────┤
│ rsm          │ ✅  │ • Grouping หลัก                     │
│              │     │ • Chart X-axis labels              │
│              │     │ • นับจำนวน RSM                      │
│              │     │ • Validation (Skip ถ้าว่าง)       │
├──────────────┼─────┼─────────────────────────────────────┤
│ provider     │ ❌  │ ไม่ได้ใช้ในการคำนวนเลย             │
│              │     │ (ดึงแต่ไม่ใช้)                      │
├──────────────┼─────┼─────────────────────────────────────┤
│ power_       │ ✅  │ • แยก Yes/No categories            │
│ authority    │     │ • Chart stacked bars               │
│              │     │ • นับ totalYes/totalNo             │
│              │     │ • Validation (Skip ถ้าว่าง)       │
│              │     │ • Check record has authority       │
├──────────────┼─────┼─────────────────────────────────────┤
│ national_id  │ ✅  │ • PRIMARY: Unique counting         │
│              │     │ • เก็บใน Sets (ไม่นับซ้ำ)          │
│              │     │ • Validation (Skip ถ้าว่าง)       │
│              │     │ • นับทุกตัวแปร (RSM, Auth, etc)   │
│              │     │ • Key สำหรับ Set เก็บข้อมูล       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 **ตัวอย่างข้อมูลทั้งหมด (2,905 Records)**

### ดึงมาจาก Supabase:

```javascript
[
  {
    "rsm": "RSM2_BMA-East",
    "provider": "True",
    "power_authority": "Yes",
    "national_id": "3750100546976"
  },
  {
    "rsm": "RSM7_UPC-CEW",
    "provider": "AIS",
    "power_authority": "No",
    "national_id": "1759900398701"
  },
  {
    "rsm": "RSM6_UPC-NOE2",
    "provider": "TOT",
    "power_authority": "Yes",
    "national_id": "3601100964206"
  },
  // ... รวม 2,905 records
]
```

### ผลลัพธ์หลังประมวลผล:

```javascript
// groupedData
{
  "RSM2_BMA-East": {
    Yes: Set { "3750100546976", ... },  // 50 people
    No: Set { "1759900398701", ... }    // 325 people
  },
  "RSM7_UPC-CEW": {
    Yes: Set { "3601100964206", ... },  // 90 people
    No: Set { ... }                      // 232 people
  },
  // ... รวม 8 RSMs
}

// chartData (Top 20)
[
  { rsm: "RSM2_BMA-East", Yes: 50, No: 325, total: 375 },
  { rsm: "RSM7_UPC-CEW", Yes: 90, No: 232, total: 322 },
  { rsm: "RSM3_UPC-East", Yes: 73, No: 194, total: 267 },
  // ... 5 more RSMs (only 8 total)
]

// summary
{
  totalRsm: 8,
  totalTechnicians: 2905,           // ← unique national_ids
  totalTechniciansWithRsm: 2109,    // ← national_ids that have rsm
  totalYes: 389,                    // ← sum of all Yes
  totalNo: 1720,                    // ← sum of all No
  recordsWithoutRsm: 796,           // ← don't have rsm
  recordsWithoutAuthority: 796      // ← don't have power_authority
}
```

---

## 🔑 **Key Points**

### ✅ **คอลัมน์ที่ใช้อย่างแน่นอน:**
1. **rsm** - จัดกลุ่ม + ป้ายกำกับ
2. **power_authority** - แยก Yes/No
3. **national_id** - นับ unique values (สำคัญที่สุด!)

### ❌ **คอลัมน์ที่ดึงแต่ไม่ใช้:**
1. **provider** - ไม่มีการใช้ในการคำนวน

### ⭐ **Most Important Column:**
- **national_id** - ใช้ทุกที่เพื่อ unique counting
  - ถ้าไม่มี → ข้ามข้อมูลนั้น
  - ถ้ามี → บันทึกใน Sets เพื่อนับไม่ซ้ำ

---

## 🚀 **สรุป**

| คอลัมน์ | ดึง? | ใช้? | งาน |
|--------|------|------|-----|
| rsm | ✅ | ✅ | ✅ Grouping, X-axis, Count RSMs |
| provider | ✅ | ❌ | ❌ ไม่ได้ใช้ |
| power_authority | ✅ | ✅ | ✅ Yes/No categorization, Chart bars |
| national_id | ✅ | ✅ | ✅ PRIMARY: Unique counting everywhere |

**ส่วนใหญ่ใช้ national_id เพื่อนับไม่ให้ซ้ำ!** ✨

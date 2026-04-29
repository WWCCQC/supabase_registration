# 📊 RSM Power Authority - การใช้คอลัมน์ (Visual Guide)

## 🎯 ตารางสรุป - Quick Reference

```
SELECT: rsm, provider, power_authority, national_id
        ↓        ↓              ↓            ↓
       ✅      ❌             ✅            ✅
      ใช้     ไม่ใช้          ใช้            ใช้
      บ่อย    เลย            บ่อย           ทุกที่
```

---

## 📋 ตารางการใช้แต่ละคอลัมน์

### 🏢 **คอลัมน์ 1: rsm**

| ลำดับ | ขั้นตอน | ใช้ | รายละเอียด |
|------|--------|-----|-----------|
| 1 | Validation | ✅ | ตรวจว่า `rsm !== null` → ข้ามถ้าว่าง |
| 2 | Grouping | ✅ | `groupedData[rsm]` ← หลักในการจัดกลุ่ม |
| 3 | Chart Label | ✅ | X-axis: "RSM2_BMA-East", "RSM7_UPC-CEW", ... |
| 4 | Count RSM | ✅ | `Object.keys(groupedData).length` = 8 |
| 5 | Summary | ✅ | `totalRsm: 8` |

**ผลลัพธ์:**
```javascript
groupedData = {
  "RSM2_BMA-East": {...},
  "RSM7_UPC-CEW": {...},
  "RSM3_UPC-East": {...},
  ...
}

totalRsm = 8
```

---

### 📦 **คอลัมน์ 2: provider**

| ลำดับ | ขั้นตอน | ใช้ | รายละเอียด |
|------|--------|-----|-----------|
| 1 | Validation | ❌ | ไม่มีการตรวจสอบ |
| 2 | Grouping | ❌ | ไม่ใช้ |
| 3 | Filtering | ❌ | ไม่ใช้ |
| 4 | Counting | ❌ | ไม่ใช้ |
| 5 | Chart | ❌ | ไม่แสดง |
| 6 | Summary | ❌ | ไม่ใช้ |

**ทำไมดึงแต่ไม่ใช้?**
- อาจเป็นข้อมูลสำรอง
- เหลือจากการ refactor ก่อนหน้า
- ไว้สำหรับ optimization ในอนาคต

---

### ✅❌ **คอลัมน์ 3: power_authority**

| ลำดับ | ขั้นตอน | ใช้ | รายละเอียด |
|------|--------|-----|-----------|
| 1 | Validation | ✅ | ตรวจว่า `power_authority !== null` → ข้ามถ้าว่าง |
| 2 | Existence Count | ✅ | `nationalIdsWithAuthority.add(id)` |
| 3 | Clean/Normalize | ✅ | `toLowerCase()` → "yes", "no" |
| 4 | Categorize | ✅ | Match "yes"/"y" → Yes Set |
| | | | Match "no"/"n" → No Set |
| 5 | Grouping | ✅ | `groupedData[rsm].Yes/No.add(id)` |
| 6 | Count | ✅ | `.Yes.size` + `.No.size` |
| 7 | Chart Bar | ✅ | Stacked bar: Yes (สีเขียว) + No (สีเหลือง) |
| 8 | Summary | ✅ | `totalYes: 389`, `totalNo: 1720` |

**ค่าที่ยอมรับ:**
```
Yes values: "Yes", "yes", "YES", "y", "Y"
No values: "No", "no", "NO", "n", "N"
```

**ผลลัพธ์:**
```javascript
// Chart data
{ rsm: "RSM2_BMA-East", Yes: 50, No: 325, total: 375 }

// Summary
totalYes: 389
totalNo: 1720
```

---

### 🔑 **คอลัมน์ 4: national_id ⭐ สำคัญที่สุด**

| ลำดับ | ขั้นตอน | ใช้ | รายละเอียด |
|------|--------|-----|-----------|
| 1 | **Validation** | ✅ | `if (!national_id) return;` ← ข้ามถ้าว่าง |
| 2 | **Global Unique Count** | ✅ | `allNationalIds.add(national_id)` → `totalTechnicians: 2905` |
| 3 | **RSM Existence Check** | ✅ | `nationalIdsWithRsm.add(national_id)` → นับช่างที่มี RSM |
| 4 | **Authority Count** | ✅ | `nationalIdsWithAuthority.add(national_id)` |
| 5 | **Grouping Yes** | ✅ | `groupedData[rsm].Yes.add(national_id)` |
| 6 | **Grouping No** | ✅ | `groupedData[rsm].No.add(national_id)` |
| 7 | **Summary Count** | ✅ | `.size` → นับจำนวนใน Set |
| 8 | **Chart Display** | ✅ | `Yes: counts.Yes.size`, `No: counts.No.size` |

**ทำไมใช้ national_id?**

```
❌ ถ้าไม่ใช้ national_id (นับแค่ records):
   2,905 records ≠ 2,905 คน
   ถ้า 1 คนมี 2 records → นับเป็น 2 ❌

✅ ถ้าใช้ national_id (เก็บใน Set):
   Set { "1234567890123", "1111111111111", ... }
   2,905 records = 2,905 unique IDs
   ไม่นับซ้ำ ✅
```

**ผลลัพธ์:**
```javascript
// Global counts
allNationalIds.size = 2905
nationalIdsWithRsm.size = 2109
nationalIdsWithAuthority.size = 2109

// Grouped counts
groupedData["RSM2_BMA-East"].Yes = Set { "3750100546976", ... }
groupedData["RSM2_BMA-East"].Yes.size = 50

// Summary
totalTechnicians: 2905
totalTechniciansWithRsm: 2109
```

---

## 🔄 **Data Flow - ข้อมูลไหลผ่านแต่ละคอลัมน์**

```
┌─────────────────────────────────────────────────────────────┐
│ 1 Record from Database:                                     │
│ {                                                           │
│   "rsm": "RSM2_BMA-East",       ← ✅ ใช้                     │
│   "provider": "True",           ← ❌ ไม่ใช้                 │
│   "power_authority": "Yes",     ← ✅ ใช้                     │
│   "national_id": "3750100546976"← ✅ ใช้                     │
│ }                                                           │
└──────────────────┬───────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
    ┌──────────────┐    ┌──────────────────────────┐
    │ rsm Check    │    │ national_id Check        │
    ├──────────────┤    ├──────────────────────────┤
    │ "RSM2_..." ✅│    │ "3750..." ✅ exists      │
    │ (not null)   │    │ → Continue              │
    │ → Continue   │    │                          │
    └──────────────┘    └──────────────────────────┘
        │                     │
        ▼                     ▼
    ┌──────────────────────────────────────────────┐
    │ Create/Get Group:                            │
    │ groupedData["RSM2_BMA-East"] = {             │
    │   Yes: Set(...),                            │
    │   No: Set(...)                              │
    │ }                                            │
    └──────────────────┬───────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
    ┌─────────────────────┐    ┌────────────────────┐
    │ power_authority     │    │ national_id Add    │
    │ Process             │    │                    │
    │                     │    │ • allNationalIds   │
    │ "Yes" → lowercase   │    │   .add(id)        │
    │ clean = "yes"       │    │ → count += 1       │
    │                     │    │                    │
    │ if clean="yes":     │    │ • nationalIdsWithRsm
    │   Group.Yes.add(id) │    │   .add(id)        │
    │   → Yes.size += 1   │    │ → count += 1       │
    └─────────────────────┘    └────────────────────┘
            │                          │
            └──────────────┬───────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │ Final State:                     │
        │                                  │
        │ groupedData["RSM2_"].Yes.size++  │
        │ allNationalIds.size++            │
        │ nationalIdsWithRsm.size++        │
        │ nationalIdsWithAuthority.size++  │
        └──────────────────────────────────┘
```

---

## 📊 **Matrix: ใครใช้คอลัมน์ไหน**

```
                    rsm  provider  power_auth  national_id
┌──────────────────────────────────────────────────────────┐
│ Validation       │ ✅      ❌        ✅          ✅        │
├──────────────────────────────────────────────────────────┤
│ Grouping         │ ✅      ❌        ❌          ❌        │
├──────────────────────────────────────────────────────────┤
│ Categorize Yes/No│ ❌      ❌        ✅          ❌        │
├──────────────────────────────────────────────────────────┤
│ Add to Set       │ ❌      ❌        ❌          ✅        │
├──────────────────────────────────────────────────────────┤
│ Count/Size       │ ✅      ❌        ❌          ✅        │
├──────────────────────────────────────────────────────────┤
│ Chart Label      │ ✅      ❌        ❌          ❌        │
├──────────────────────────────────────────────────────────┤
│ Chart Data       │ ✅      ❌        ✅          ✅        │
├──────────────────────────────────────────────────────────┤
│ Summary          │ ✅      ❌        ✅          ✅        │
├──────────────────────────────────────────────────────────┤
│ Total Usage      │  6      0         4           6        │
└──────────────────────────────────────────────────────────┘
```

---

## 🧮 **Calculation Flow**

### **ใช้ rsm:**
```
1. Validation: rsm !== null?
2. Grouping: groupedData[rsm] = {...}
3. Count RSM: Object.keys(groupedData).length = 8
4. Label: Chart X-axis
5. Summary: totalRsm = 8
```

### **ไม่ใช้ provider:**
```
❌ ข้ามทั้งหมด
```

### **ใช้ power_authority:**
```
1. Validation: power_authority !== null?
2. Clean: toLowerCase()
3. Match: if (clean === "yes") or (clean === "no")
4. Add: groupedData[rsm].Yes/No.add(national_id)
5. Count: .size
6. Summary: totalYes, totalNo
```

### **ใช้ national_id (ทั้งหมด):**
```
1. Validation: national_id !== null?
2. Global: allNationalIds.add(national_id)
3. RSM Check: nationalIdsWithRsm.add(national_id)
4. Authority: nationalIdsWithAuthority.add(national_id)
5. Yes Group: groupedData[rsm].Yes.add(national_id)
6. No Group: groupedData[rsm].No.add(national_id)
7. Count: .size → 50, 325, 90, 232, ...
8. Summary: totalTechnicians = 2905
```

---

## 📈 **ตัวอย่างผลลัพธ์ - 3 RSM**

```
Input (From Supabase):
┌────────────┬──────────┬────────────┬──────────────────┐
│ rsm        │ provider │ power_auth │ national_id      │
├────────────┼──────────┼────────────┼──────────────────┤
│ RSM2_...   │ True     │ Yes        │ 3750100546976 ✅│
│ RSM2_...   │ True     │ No         │ 1759900398701 ✅│
│ RSM2_...   │ True     │ Yes        │ 3601100964206 ✅│
│ ...        │ ...      │ ...        │ ... (ทั้งหมด 50)│
│ RSM7_...   │ AIS      │ Yes        │ 3499900014309 ✅│
│ RSM7_...   │ AIS      │ No         │ 1499900225036 ✅│
│ ...        │ ...      │ ...        │ ... (ทั้งหมด 90)│
│ RSM3_...   │ TOT      │ Yes        │ 1499900224919 ✅│
│ ...        │ ...      │ ...        │ ... (ทั้งหมด 73)│
└────────────┴──────────┴────────────┴──────────────────┘
    ↓          ↓          ↓           ↓
   ✅         ❌         ✅          ✅
  ใช้       ไม่ใช้      ใช้         ใช้

Processing:
┌──────────────────────────────────────┐
│ groupedData = {                      │
│   "RSM2_BMA-East": {                │
│     Yes: Set(50),    ← 50 IDs       │
│     No: Set(325)     ← 325 IDs      │
│   },                                 │
│   "RSM7_UPC-CEW": {                 │
│     Yes: Set(90),    ← 90 IDs       │
│     No: Set(232)     ← 232 IDs      │
│   },                                 │
│   "RSM3_UPC-East": {                │
│     Yes: Set(73),    ← 73 IDs       │
│     No: Set(194)     ← 194 IDs      │
│   }                                  │
│ }                                    │
└──────────────────────────────────────┘

Chart Output:
┌─────────────────────────────────────────┐
│ [                                       │
│   {                                     │
│     rsm: "RSM2_BMA-East",              │
│     Yes: 50,      ← power_authority+ID │
│     No: 325,      ← power_authority+ID │
│     total: 375                          │
│   },                                    │
│   {                                     │
│     rsm: "RSM7_UPC-CEW",               │
│     Yes: 90,                           │
│     No: 232,                           │
│     total: 322                         │
│   },                                    │
│   {                                     │
│     rsm: "RSM3_UPC-East",              │
│     Yes: 73,                           │
│     No: 194,                           │
│     total: 267                         │
│   }                                     │
│ ]                                       │
└─────────────────────────────────────────┘

Summary:
┌─────────────────────────────────────────┐
│ totalRsm: 8                 ← rsm count │
│ totalTechnicians: 2905      ← ID count  │
│ totalYes: 389               ← power_auth│
│ totalNo: 1720               ← power_auth│
│ recordsWithoutRsm: 796      ← rsm+ID   │
│ recordsWithoutAuthority: 796← power_auth│
└─────────────────────────────────────────┘
```

---

## 🎯 **สรุป - ใครใช้อะไรมากที่สุด**

```
Column Usage Ranking:
1. 🏆 national_id    ← ใช้ 6 ครั้ง (ทุกที่เกือบ)
2. 🥈 rsm            ← ใช้ 6 ครั้ง (grouping + labeling)
3. 🥉 power_authority← ใช้ 4 ครั้ง (categorization)
4. ❌ provider       ← ใช้ 0 ครั้ง (ไม่ใช้เลย)
```

**Bottom Line:**
- **national_id** = ใจกลางของระบบ (unique counting)
- **rsm** = กำหนดโครงสร้าง (grouping)
- **power_authority** = สร้าง categories (Yes/No)
- **provider** = ไม่มีประโยชน์ในกราฟนี้

---

## ✨ **Key Insights**

### 🔑 **เหตุผลการใช้ national_id:**
```
→ Prevents double-counting (ไม่นับซ้ำ)
→ Represents unique people (เป็นตัวแทนคนเดียว)
→ Used in all counting operations
→ Stored in Sets for efficiency
```

### 🔑 **เหตุผลการใช้ rsm:**
```
→ Main grouping key (จัดกลุ่ม)
→ Creates chart structure (สร้างโครงสร้าง)
→ Defines X-axis labels
→ Counts unique RSM values
```

### 🔑 **เหตุผลการใช้ power_authority:**
```
→ Categorizes into Yes/No (แยกประเภท)
→ Creates stacked bar chart
→ Calculates totals
```

### 🔑 **เหตุผลไม่ใช้ provider:**
```
→ No business logic requires it
→ Not used in calculations
→ Not displayed in chart
→ Not included in summary
```

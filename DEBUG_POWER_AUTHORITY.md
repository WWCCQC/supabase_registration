# ปัญหา: RSM Power Authority Status Graph แสดงจำนวนไม่ถูกต้อง

## สรุปปัญหา
- User รายงานว่า Graph แสดง Yes/No ไม่ถูกต้อง
- ฐานข้อมูล Supabase จริง: **Yes=390, No=2,545**
- API log แสดง: **Yes=400, No=2,545**
- มีความไม่ตรงกัน 10 records สำหรับ Yes

## การตรวจสอบ

### 1. Verified Supabase Data
```bash
node verify-power-authority.js
```
ผลลัพธ์:
- Yes: 390
- No: 2,545  
- Null: 1
- Total: 2,936

### 2. API Log Output
จาก server log เห็นว่า:
```
📊 Power Authority counts from DB (exact): Yes=400, No=2545, Total=2945
📊 Chart Summary: Total Yes (DB): 400, Total No (DB): 2545
⚠️  Warning: Power Authority counts mismatch!
   DB: Yes=400, No=2545
   Fetched: Yes=390, No=2525
```

## Root Cause (สมมติฐาน)
1. **ไม่ใช่ cache** - API มี `export const dynamic = "force-dynamic"`
2. **ไม่ใช่ column name** - ใช้ `power_authority` ถูกต้อง
3. **อาจเป็น Connection Pool** - Service Role Key อาจใช้ connection ที่มี stale data
4. **อาจเป็น Supabase Cache** - Supabase เองอาจมี cache ที่ count query

## ขั้นต่อไป
1. Restart Dev Server
2. เช็คว่า API ส่งค่าอะไรจริงหลัง restart
3. ถ้ายังผิดอยู่ ให้ทำ hard refresh หรือ deploy ใหม่

## Files Involved
- `/app/api/chart/rsm-workgroup/route.ts` - API ที่ส่งข้อมูล
- `/components/TechBrowser.tsx` - Component ที่แสดง Graph
- Lines 1670-1690: ใช้ `chartSummary.totalYes` และ `chartSummary.totalNo`

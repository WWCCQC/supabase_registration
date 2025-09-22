// CTM Code to Thai Name Mapping
export const CTM_MAPPING: { [key: string]: string } = {
  // Bangkok Metro Areas
  "B015": "เมืองนนทบุรี_ปากเกร็ด",
  "B016": "บางบัวทอง_ไทรน้อย_บางกรวย_บางใหญ่", 
  "B024": "บางเขน_หลักสี่_ดอนเมือง_สายไหม",
  "B025": "บางซื่อ_จตุจักร_พญาไท_ดินแดง_ห้วยขวาง",
  "B035": "ลำลูกกา_ธัญบุรี_หนองเสือ",
  "B036": "คลองหลวง_เมืองปทุมธานี_ลาดหลุมแก้ว_สามโคก",
  "B044": "บางกะปิ_สะพานสูง_ลาดพร้าว_วังทองหลาง",
  "B045": "ประเวศ_บางนา_สวนหลวง",
  "B055": "มีนบุรี_คันนายาว_บึงกุ่ม",
  "B056": "ลาดกระบัง_หนองจอก_คลองสามวา",
  "B067": "เมืองสมุทรปราการ1_เมืองสมุทรปราการ2_พระประแดง_พระสมุทรเจดีย์",
  "B068": "บางพลี_บางบ่อ_บางเสาธง",
  "B075": "บางขุนเทียน_จอมทอง_บางบอน_ธนบุรี_คลองสาน_ราษฎร์บูรณะ_ทุ่งครุ",
  "B084": "หนองแขม_บางแค_ตลิ่งชัน_ภาษีเจริญ_ทวีวัฒนา_บางกอกใหญ่_บางกอกน้อย_บางพลัด",
  "B114": "พระโขนง_คลองเตย_วัฒนา",
  "B115": "บางรัก_สาทร_ยานนาวา_บางคอแหลม_ป้อมปราบศัตรูพ่าย_สัมพันธวงศ์_พระนคร_ดุสิต_ปทุมวัน_ราชเทวี"
};

/**
 * แปลงรหัส CTM เป็นชื่อภาษาไทย
 * @param ctmCode รหัส CTM (เช่น B015-NTB-เมืองนนทบุรี_ปากเกร็ด หรือ B015)
 * @returns ชื่อ CTM ภาษาไทย หรือชื่อเดิมถ้าไม่ใช่รหัส B-code
 */
export function mapCtmToThaiName(ctmCode: string): string {
  if (!ctmCode || typeof ctmCode !== 'string') {
    return ctmCode || '';
  }

  const trimmed = ctmCode.trim();
  
  // ตรวจสอบว่าเป็นรูปแบบ B + 3 หลัก หรือไม่
  const bCodeMatch = trimmed.match(/^B(\d{3})/);
  
  if (bCodeMatch) {
    const bCode = `B${bCodeMatch[1]}`;
    const mappedName = CTM_MAPPING[bCode];
    
    if (mappedName) {
      return mappedName;
    }
  }
  
  // ถ้าไม่ใช่ B-code หรือไม่มีใน mapping ให้คืนค่าเดิม
  return trimmed;
}

/**
 * แปลง array ของ CTM codes เป็นชื่อภาษาไทย
 */
export function mapCtmArrayToThaiNames(ctmCodes: string[]): string[] {
  return ctmCodes.map(mapCtmToThaiName);
}

// Export สำหรับ debugging
export function getAllMappings() {
  return CTM_MAPPING;
}

// ตรวจสอบว่าเป็น B-code หรือไม่
export function isBCode(ctmCode: string): boolean {
  if (!ctmCode || typeof ctmCode !== 'string') return false;
  return /^B\d{3}/.test(ctmCode.trim());
}
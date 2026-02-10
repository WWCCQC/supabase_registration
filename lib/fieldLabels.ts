/**
 * ชื่อฟิลด์ภาษาไทยสำหรับแสดงผลในหน้าเว็บ
 * แก้ไขที่นี่เพื่อเปลี่ยนชื่อฟิลด์ทั้งหมดในระบบ
 */

export const FIELD_LABELS: Record<string, string> = {
  // ข้อมูลพื้นฐาน
  national_id: "เลขที่บัตรประชาชน",
  tech_id: "รหัสช่าง",
  full_name: "ชื่อ นามสกุล",
  tech_first_name: "ชื่อ",
  tech_last_name: "นามสกุล",
  gender: "เพศ",
  age: "อายุ",
  birth_date: "วันเกิด",
  degree: "วุฒิการศึกษา",
  phone: "เบอร์โทรศัพท์",
  tel: "เบอร์โทรศัพท์",
  email: "อีเมล",
  card_register_date: "วันที่ลงทะเบียน",
  work_experience: "ประสบการณ์การทำงาน",

  // สถานะและประเภทงาน
  workgroup_status: "workgroup_status",
  status: "status",
  work_type: "work_type",
  team_type: "team_type",
  provider: "provider",

  // พื้นที่และตำแหน่ง
  area: "พื้นที่",
  rsm: "RBM",
  ctm: "CBM",
  depot_code: "depot_code",
  depot_name: "depot_name",
  province: "จังหวัด",
  ctm_province: "ctm_province",

  // เอกสาร
  doc_tech_card_url: "บัตรช่าง",
  tech_card_url: "บัตรช่าง",
  doc_id_card_url: "บัตรประชาชน",
  doc_driver_license_url: "ใบขับขี่",
  doc_education_certificate_url: "วุฒิการศึกษา",
  doc_criminal_record_url: "ประวัติอาชญากรรม",
  doc_medical_certificate_url: "ใบรับรองแพทย์",
  doc_power_authority_card_url: "บัตรการไฟฟ้า",
  doc_safety_officer_executive_url: "doc_safety_officer_executive_url",
  doc_safety_officer_supervisor_url: "doc_safety_officer_supervisor_url",
  doc_safety_officer_technical_url: "doc_safety_officer_technical_url",

  // บริการ
  svc_install: "svc_install",
  svc_repair: "svc_repair",
  svc_ojt: "ผ่านการอบรม OJT",
  svc_safety: "ผ่านการอบรม Safety",
  svc_softskill: "ผ่านการอบรม Softskill",
  svc_5p: "ผ่านการอบรม 5P",
  svc_nonstandard: "ผ่านการอบรม Nonstandard",
  svc_corporate: "ผ่านการอบรม Corporate",
  svc_solar: "ผ่านการอบรม Solar",
  svc_fttr: "ผ่านการอบรม FTTR",
  svc_2g: "ผ่านการอบรม 2G",
  svc_cctv: "ผ่านการอบรม CCTV",
  svc_cyod: "ผ่านการอบรม CYOD",
  svc_dongle: "ผ่านการอบรม Dongle",
  svc_iot: "ผ่านการอบรม IoT",
  svc_gigatex: "ผ่านการอบรม Gigatex",
  svc_wifi: "ผ่านการอบรม wifi",
  svc_smarthome: "ผ่านการอบรม Smarthome",
  svc_catv_settop: "ผ่านการอบรม Catv Settop",
  svc_true_id: "ผ่านการอบรม True ID",
  svc_true_inno: "ผ่านการอบรม True Inno",
  svc_l3: "ผ่านการอบรม L3",
  course_g: "ผ่านการอบรม Course G",
  course_ec: "ผ่านการอบรม Course EC",
  course_h: "ผ่านการอบรม Course H",

  // อำนาจและความปลอดภัย
  power_authority: "บัตรการไฟฟ้า",
  power_card_start_date: "บัตรการไฟฟ้า(วันออกบัตร)",
  power_card_expire_date: "บัตรการไฟฟ้า(วันหมดอายุ)",
  sso_number: "ประกันสังคม",
  safety_officer_executive: "safety_officer_executive",
  safety_officer_supervisor: "safety_officer_supervisor",
  safety_officer_technical: "safety_officer_technical",

  // ข้อมูลรถยนต์
  car_brand_code: "ยี่ห้อรถ",
  car_model: "รุ่นรถ",
  car_color: "สีรถ",
  car_license_plate: "ทะเบียนรถ",
  car_reg_province: "จังหวัดที่จดทะเบียน",
  car_type: "ประเภทรถ",
  equip_carryboy: "equip_carryboy",

  // ข้อมูลระบบ
  created_at: "created_at",
  updated_at: "updated_at",
  __imported_at: "__imported_at",
  id: "id",
  uuid: "uuid",
  card_expire_date: "บัตรช่างหมดอายุ",
};

/**
 * ฟังก์ชันสำหรับแปลงชื่อฟิลด์เป็นภาษาไทย
 */
export function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * ชื่อส่วนต่างๆ ในหน้า detail
 */
export const SECTION_LABELS = {
  basic_info: "ข้อมูลพื้นฐาน",
  area_service: "พื้นที่รับงาน",
  services: "ข้อมูลการอบรม",
  authority_safety: "ข้อมูลความปลอดภัย",
  vehicle_info: "ข้อมูลรถยนต์",
  documents: "ข้อมูลเอกสาร",
};

/**
 * ชื่อส่วนต่างๆ ในหน้า KPI
 */
export const KPI_LABELS = {
  total: "ช่างทั้งหมด",
  installation: "ติดตั้ง",
  repair: "ซ่อม",
  ww_provider: "WW-Provider",
  true_tech: "True Tech",
  thao_kao_tech: "เถ้าแก่เทค",
};

export const TECHNICIAN_SEARCHABLE_COLUMNS = [
  "area",
  "provider",
  "HRBM",
  "CBM",
  "RBM",
  "provider_group_type",
  "work_type",
  "job_accept_type",
  "group_name",
  "province",
  "depot_name",
  "depot_code",
  "wma",
  "team_name",
  "team_type",
  "workgroup_status",
  "tech_first_name",
  "tech_last_name",
  "tech_first_name_en",
  "tech_last_name_en",
  "tech_id",
  "card_register_date",
  "card_expire_date",
  "card_expire_date_alt",
  "card_days_to_expire",
  "training_round",
  "phone",
  "email",
  "status",
  "gender",
  "full_name",
  "national_id",
  "birth_date",
  "age",
  "degree",
  "car_brand_code",
  "car_model",
  "car_color",
  "car_license_plate",
  "car_reg_province",
  "car_type",
  "equip_carryboy",
  "power_authority",
  "power_card_start_date",
  "power_card_expire_date",
  "sso_number",
  "safety_officer_executive",
  "safety_officer_supervisor",
  "safety_officer_technical",
  "is_blacklisted",
  "svc_install",
  "svc_repair",
  "svc_ojt",
  "svc_safety",
  "svc_softskill",
  "svc_5p",
  "svc_nonstandard",
  "svc_corporate",
  "svc_solar",
  "svc_fttr",
  "svc_2g",
  "svc_cctv",
  "svc_cyod",
  "svc_dongle",
  "svc_iot",
  "svc_gigatex",
  "svc_wifi",
  "svc_smarthome",
  "svc_catv_settop_box",
  "svc_true_id",
  "svc_true_inno",
  "svc_l3",
  "doc_tech_card_url",
  "doc_id_card_url",
  "doc_driver_license_url",
  "doc_education_certificate_url",
  "doc_criminal_record_url",
  "doc_medical_certificate_url",
  "doc_power_authority_card_url",
  "doc_safety_officer_executive_url",
  "doc_safety_officer_supervisor_url",
  "doc_safety_officer_technical_url",
  "address",
  "current_address",
  "course_g",
  "course_ec",
  "course_h",
] as const;

const QUALIFICATION_COLUMNS = [
  "svc_install",
  "svc_repair",
  "svc_ojt",
  "svc_safety",
  "svc_softskill",
  "svc_5p",
  "svc_nonstandard",
  "svc_corporate",
  "svc_solar",
  "svc_fttr",
  "svc_2g",
  "svc_cctv",
  "svc_cyod",
  "svc_dongle",
  "svc_iot",
  "svc_gigatex",
  "svc_wifi",
  "svc_smarthome",
  "svc_catv_settop_box",
  "svc_true_id",
  "svc_true_inno",
  "svc_l3",
  "course_g",
  "course_ec",
  "course_h",
] as const;

type OrQuery<T> = {
  or(expression: string): T;
};

function quotePostgrestValue(value: string) {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"*${escaped}*"`;
}

function getQualificationColumn(term: string) {
  const normalized = term.toLowerCase().replace(/[\s-]+/g, "_");
  return QUALIFICATION_COLUMNS.find((column) => {
    const withoutServicePrefix = column.replace(/^svc_/, "");
    return normalized === column || normalized === withoutServicePrefix;
  });
}

function getUpdatedAtCondition(term: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(term)) return null;

  const start = new Date(`${term}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== term) {
    return null;
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return `and(updated_at.gte.${start.toISOString()},updated_at.lt.${end.toISOString()})`;
}

export function buildTechnicianSearchExpression(
  rawTerm: string | null | undefined,
) {
  const term = rawTerm?.trim();
  if (!term) return null;

  const pattern = quotePostgrestValue(term);
  const conditions = TECHNICIAN_SEARCHABLE_COLUMNS.map(
    (column) => `${column}.ilike.${pattern}`,
  );

  const qualificationColumn = getQualificationColumn(term);
  if (qualificationColumn) {
    conditions.push(`${qualificationColumn}.eq.Pass`);
  }

  const updatedAtCondition = getUpdatedAtCondition(term);
  if (updatedAtCondition) {
    conditions.push(updatedAtCondition);
  }

  return conditions.join(",");
}

export function applyTechnicianGeneralSearch<T extends OrQuery<T>>(
  query: T,
  rawTerm: string | null | undefined,
) {
  const expression = buildTechnicianSearchExpression(rawTerm);
  return expression ? query.or(expression) : query;
}

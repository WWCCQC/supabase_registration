export const TECHNICIAN_TEXT_SEARCH_COLUMNS = [
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

export const TECHNICIAN_DATE_SEARCH_COLUMNS = [
  "birth_date",
  "power_card_start_date",
  "power_card_expire_date",
] as const;

export const TECHNICIAN_SEARCHABLE_COLUMNS = [
  ...TECHNICIAN_TEXT_SEARCH_COLUMNS,
  ...TECHNICIAN_DATE_SEARCH_COLUMNS,
  "updated_at",
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

type DateRange = {
  start: Date;
  end: Date;
  exactDate: string | null;
};

function getDateRange(term: string): DateRange | null {
  const match = term.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : 1;
  const day = match[3] ? Number(match[3]) : 1;
  const start = new Date(Date.UTC(year, month - 1, day));

  if (
    start.getUTCFullYear() !== year ||
    start.getUTCMonth() !== month - 1 ||
    start.getUTCDate() !== day
  ) {
    return null;
  }

  const end = new Date(start);
  if (match[3]) {
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (match[2]) {
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  }

  return {
    start,
    end,
    exactDate: match[3] ? term : null,
  };
}

export function buildTechnicianSearchExpression(
  rawTerm: string | null | undefined,
) {
  const term = rawTerm?.trim();
  if (!term) return null;

  const qualificationColumn = getQualificationColumn(term);
  if (qualificationColumn) {
    return `${qualificationColumn}.eq.Pass`;
  }

  const pattern = quotePostgrestValue(term);
  const conditions: string[] = TECHNICIAN_TEXT_SEARCH_COLUMNS.map(
    (column) => `${column}.ilike.${pattern}`,
  );

  const dateRange = getDateRange(term);
  if (dateRange) {
    for (const column of TECHNICIAN_DATE_SEARCH_COLUMNS) {
      conditions.push(
        dateRange.exactDate
          ? `${column}.eq.${dateRange.exactDate}`
          : `and(${column}.gte.${dateRange.start.toISOString().slice(0, 10)},${column}.lt.${dateRange.end.toISOString().slice(0, 10)})`,
      );
    }
    conditions.push(
      `and(updated_at.gte.${dateRange.start.toISOString()},updated_at.lt.${dateRange.end.toISOString()})`,
    );
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

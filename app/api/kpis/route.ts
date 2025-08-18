function applyFilters(query: any, params: URLSearchParams) {
  const get = (k: string) => sanitize(params.get(k));

  const filters: Record<string, string> = {
    provider: get("provider"),
    area: get("area"),
    rsm: get("rsm"),
    ctm: get("ctm"),
    depot_code: get("depot_code"),
    work_type: get("work_type"),
    workgroup_status: get("workgroup_status"),
    gender: get("gender"),
    degree: get("degree"),
  };

  // ใช้ .ilike ตรง ๆ (อย่าใช้ .filter)
  for (const [k, v] of Object.entries(filters)) {
    if (v) query = (query as any).ilike(k, `%${v}%`);
  }

  const fNat = get("f_national_id");
  const fTech = get("f_tech_id");
  const fRsm = get("f_rsm");
  const fDepot = get("f_depot_code");

  if (fNat)   query = (query as any).ilike("national_id", `%${fNat}%`);
  if (fTech)  query = (query as any).ilike("tech_id", `%${fTech}%`);
  if (fRsm)   query = (query as any).ilike("rsm", `%${fRsm}%`);
  if (fDepot) query = (query as any).ilike("depot_code", `%${fDepot}%`);

  const q = get("q");
  if (q) {
    const cols = [
      "national_id","tech_id","full_name","gender","degree","phone","email",
      "workgroup_status","work_type","provider","area","rsm","ctm",
      "depot_code","depot_name","province",
    ];
    const pat = `%${q}%`;
    query = (query as any).or(cols.map(c => `${c}.ilike.${pat}`).join(","));
  }
  return query;
}

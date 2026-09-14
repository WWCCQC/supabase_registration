type PowerAuthorityTechnician = {
  area?: string | null;
  workgroup_status?: string | null;
  province?: string | null;
  depot_code?: string | null;
};

/** Shared eligibility for Power Authority counts and detail/export rows. */
export function isPowerAuthorityEligible(row: PowerAuthorityTechnician): boolean {
  const depot = String(row.depot_code ?? "").trim();
  if (depot === "WW-BM-0093" || depot === "WW-BM-0029") return false;

  const area = String(row.area ?? "").trim();
  const status = String(row.workgroup_status ?? "").trim();
  const province = String(row.province ?? "").trim();
  if (area === "UPC" || (area === "BMA" && province === "ปทุมธานี")) {
    return status === "หัวหน้า";
  }
  if (area === "BMA") return status === "หัวหน้า" || status === "ลูกน้อง";

  // Other areas retain their existing behavior.
  return true;
}

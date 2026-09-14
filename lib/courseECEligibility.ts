/** Shared depot exclusion for Course EC counts and detail/export rows. */
export function isCourseECEligible(row: { depot_code?: string | null }): boolean {
  const depot = String(row.depot_code ?? "").trim();
  return depot !== "WW-BM-0093" && depot !== "WW-BM-0029";
}

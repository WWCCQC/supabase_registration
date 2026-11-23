// Values stored in technicians.work_type and how the UI names them.
export const WORK_TYPES = ["Installation", "Repair"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  Installation: "รับงานติดตั้ง",
  Repair: "รับงานซ่อม",
};

export const AREA_PROVIDERS = ["WW-Provider", "True Tech", "เถ้าแก่เทค"] as const;
export type AreaProvider = (typeof AREA_PROVIDERS)[number];

/** RBM -> `${provider}_${workType}` -> count */
export type AreaPivot = Record<string, Record<string, number>>;

/** Workgroup heads by work type, plus distinct depot_code count, for one RBM or province. */
export type AreaMapStat = { installation: number; repair: number; depots: number };

export type AreaCounts = {
  /** every technician (one row = one person) */
  technicians: AreaPivot;
  /** workgroup heads only (one head = one workgroup) */
  workgroups: AreaPivot;
  /** map data: per RBM, and per province with its technician count in each RBM (a province can span RBMs, e.g. Bangkok) */
  map: {
    rbms: Record<string, AreaMapStat>;
    provinces: Record<string, AreaMapStat & { technicians: Record<string, number> }>;
  };
};

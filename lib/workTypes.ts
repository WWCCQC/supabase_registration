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

export type AreaCounts = {
  /** every technician (one row = one person) */
  technicians: AreaPivot;
  /** workgroup heads only (one head = one workgroup) */
  workgroups: AreaPivot;
};

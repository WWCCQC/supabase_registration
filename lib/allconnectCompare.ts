export const WORK_STATUSES = ['all', 'without_work', 'with_work', 'pending'] as const;
export type WorkStatusFilter = typeof WORK_STATUSES[number];
export type WorkStatus = Exclude<WorkStatusFilter, 'all'>;

export interface CompareSummary {
  total: number;
  withWork: number;
  withoutWork: number;
  pending: number;
  jobCount: number;
  installCount: number;
  repairCount: number;
  coverage: number | null;
}

export interface CompareRegion extends CompareSummary { rbm: string }

export interface CompareDepot extends CompareSummary {
  rbm: string;
  depotCode: string;
  depotName: string;
  withoutWorkTechnicians: {
    techId: string;
    fullName: string;
    typeOfWork: string;
    jobAcceptType: string;
  }[];
}

export interface NoWorkPeriod {
  month: string;
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
}

export interface WeeklyJobPeriod extends NoWorkPeriod { jobCount: number }

export interface CompareRow {
  techId: string | null;
  fullName: string;
  cardRegisterDate: string;
  rbm: string;
  cbm: string;
  provider: string;
  depotCode: string;
  depotName: string;
  province: string;
  technicianStatus: string;
  jobCount: number;
  installCount: number;
  repairCount: number;
  workStatus: WorkStatus;
  noWorkPeriods: NoWorkPeriod[];
  weeklyJobs: WeeklyJobPeriod[];
}

export interface CompareDashboard {
  dataset: {
    totalRows: number;
    importedAt: string | null;
    updatedAt: string | null;
    techniciansUpdatedAt: string | null;
    missingHandlerRows: number;
    unknownHandlers: number;
    missingTechIds: number;
    duplicateTechIds: number;
    months: string[];
    invalidJobRows: number;
    workPeriods: NoWorkPeriod[];
  };
  summary: CompareSummary;
  regions: CompareRegion[];
  depots: CompareDepot[];
  rows: CompareRow[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

export function formatRegionBarLabel(value: number, total: number) {
  const share = total > 0 ? `${(value * 100 / total).toFixed(1)}%` : '-';
  return `${value.toLocaleString('en-US')} (${share})`;
}

export function calculateWithoutWorkCoverage(withWork: number, withoutWork: number) {
  const comparedTotal = withWork + withoutWork;
  return comparedTotal > 0 ? Math.round(withoutWork * 1000 / comparedTotal) / 10 : null;
}

export function formatCompletedWorkType(installCount: number, repairCount: number) {
  if (installCount > 0 && repairCount > 0) return 'ติดตั้งและซ่อม';
  if (installCount > 0) return 'ติดตั้ง';
  if (repairCount > 0) return 'ซ่อม';
  return '-';
}

export function formatNoWorkWeek(period: NoWorkPeriod) {
  const dayMonth = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;
  return `Week ${period.weekNumber} (${dayMonth(period.weekStart)} - ${dayMonth(period.weekEnd)})`;
}

export function formatNoWorkPeriods(periods: NoWorkPeriod[]) {
  return periods.map(period => `${period.month}: ${formatNoWorkWeek(period)}`).join('\n');
}

export function weeklyJobBackground(jobCount: number) {
  if (jobCount <= 0) return '#fde2e5';
  const lightness = 96 - Math.min(18, Math.log2(jobCount + 1) * 2.5);
  return `hsl(148, 45%, ${lightness.toFixed(1)}%)`;
}

export function calculateWorkingDays(cardRegisterDate: string, currentDate = new Date()) {
  const value = cardRegisterDate.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(value);
  const thaiExportMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if ((!isoMatch && !thaiExportMatch) || Number.isNaN(currentDate.getTime())) return null;

  const year = Number(isoMatch?.[1] ?? thaiExportMatch?.[3]);
  const month = Number(isoMatch?.[2] ?? thaiExportMatch?.[2]);
  const day = Number(isoMatch?.[3] ?? thaiExportMatch?.[1]);
  const start = Date.UTC(year, month - 1, day);
  const parsed = new Date(start);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return null;
  }

  const today = Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const days = Math.floor((today - start) / 86_400_000);
  return days >= 0 ? days : null;
}

export function parseCompareParams(params: URLSearchParams) {
  const status = params.get('status') ?? 'without_work';
  if (!WORK_STATUSES.includes(status as WorkStatusFilter)) {
    throw new Error('Invalid work status');
  }
  const integer = (name: string, fallback: number, max: number) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) {
      throw new Error(`Invalid ${name}`);
    }
    return value;
  };
  const search = (params.get('q') ?? '').trim();
  const rbm = (params.get('rbm') ?? '').trim();
  if (search.length > 200 || rbm.length > 200) throw new Error('Filter is too long');
  return {
    p_rbm: rbm || null,
    p_status: status,
    p_search: search,
    p_page: integer('page', 1, 1_000_000),
    p_page_size: integer('pageSize', 50, 500),
  };
}

export function parseCompareJobParams(params: URLSearchParams) {
  const month = (params.get('month') ?? '').trim();
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month');
  return { ...parseCompareParams(params), p_month: month || null };
}

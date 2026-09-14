export const WORK_STATUSES = ['all', 'without_work', 'with_work', 'pending'] as const;
export type WorkStatusFilter = typeof WORK_STATUSES[number];
export type WorkStatus = Exclude<WorkStatusFilter, 'all'>;

export interface CompareSummary {
  total: number;
  withWork: number;
  withoutWork: number;
  pending: number;
  jobCount: number;
  coverage: number | null;
}

export interface CompareRegion extends CompareSummary { rbm: string }

export interface CompareRow {
  techId: string | null;
  fullName: string;
  rbm: string;
  cbm: string;
  provider: string;
  depotCode: string;
  depotName: string;
  province: string;
  technicianStatus: string;
  jobCount: number;
  workStatus: WorkStatus;
}

export interface CompareDashboard {
  dataset: {
    totalRows: number;
    importedAt: string | null;
    updatedAt: string | null;
    missingHandlerRows: number;
    unknownHandlers: number;
    missingTechIds: number;
    duplicateTechIds: number;
  };
  summary: CompareSummary;
  regions: CompareRegion[];
  rows: CompareRow[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

export function formatRegionBarLabel(value: number, total: number) {
  const share = total > 0 ? `${(value * 100 / total).toFixed(1)}%` : '-';
  return `${value.toLocaleString('en-US')} (${share})`;
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

import type { ContractRow } from './contractDashboard';

export const contractSources = ['track-c', 'solar', 'corporate'] as const;
export type ContractSource = typeof contractSources[number];
export const sourceLabels: Record<ContractSource, string> = {
  'track-c': 'Track C', solar: 'Solar', corporate: 'Corporate',
};

export type PortfolioContract = { source: ContractSource; row: ContractRow };
export type PortfolioCompany = {
  key: string;
  registration: string;
  name: string;
  contracts: PortfolioContract[];
  sources: ContractSource[];
  matchable: boolean;
};

function registrationKey(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  const digits = trimmed.replace(/[\s-]/g, '');
  return /^\d{13}$/.test(digits) ? digits : trimmed.toLocaleLowerCase('th');
}

export function buildContractPortfolio(datasets: Record<ContractSource, ContractRow[]>) {
  const companies = new Map<string, PortfolioCompany>();
  for (const source of contractSources) {
    for (const [index, row] of datasets[source].entries()) {
      const registration = registrationKey(row.corporate_registration_no);
      const matchable = registration.length > 0;
      const key = matchable ? `id:${registration}` : `missing:${source}:${row.uuid ?? index}`;
      let company = companies.get(key);
      if (!company) {
        company = { key, registration: matchable ? registration : '', name: row.partner_name?.trim() || 'ไม่ระบุชื่อ', contracts: [], sources: [], matchable };
        companies.set(key, company);
      }
      company.contracts.push({ source, row });
      if (!company.sources.includes(source)) company.sources.push(source);
      if (company.name === 'ไม่ระบุชื่อ' && row.partner_name?.trim()) company.name = row.partner_name.trim();
    }
  }
  return [...companies.values()].sort((a, b) =>
    b.sources.length - a.sources.length || a.name.localeCompare(b.name, 'th') || a.registration.localeCompare(b.registration));
}

export function portfolioCounts(companies: PortfolioCompany[]) {
  const linked = companies.filter(company => company.matchable);
  return {
    companies: linked.length,
    missingRegistration: companies.length - linked.length,
    contracts: companies.reduce((total, company) => total + company.contracts.length, 0),
    byTypeCount: [1, 2, 3].map(count => linked.filter(company => company.sources.length === count).length),
  };
}

export function contractOverview(companies: PortfolioCompany[]) {
  const emptyCounts = () => ({ total: 0, active: 0, complete: 0, onProcess: 0, cancelled: 0, other: 0 });
  const totals = emptyCounts();
  const bySource = Object.fromEntries(contractSources.map(source => [source, emptyCounts()])) as Record<ContractSource, ReturnType<typeof emptyCounts>>;
  const agents = { total: 0, active: 0, inactive: 0, missingRegistration: 0 };

  for (const company of companies) {
    let hasActiveContract = false;
    for (const { source, row } of company.contracts) {
      const status = (row.group_status ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
      const key = status === 'complete' ? 'complete' : status === 'on process' ? 'onProcess' : status === 'cancel' ? 'cancelled' : 'other';
      const active = key === 'complete' || key === 'onProcess';
      hasActiveContract ||= active;
      for (const counts of [totals, bySource[source]]) {
        counts.total += 1;
        counts[key] += 1;
        if (active) counts.active += 1;
      }
    }
    // Missing registrations cannot be deduplicated reliably across contract types.
    if (!company.matchable) {
      agents.missingRegistration += company.contracts.length;
      continue;
    }
    agents.total += 1;
    if (hasActiveContract) agents.active += 1;
    else agents.inactive += 1;
  }
  return { agents, totals, bySource };
}

"use client";
import React from "react";
import dynamic from "next/dynamic";
import { createClient } from '@supabase/supabase-js';
import { getFieldLabel, SECTION_LABELS, KPI_LABELS } from "../lib/fieldLabels";
import { useAuth } from "@/lib/useAuth";
import PivotTableComponent from "./tables/PivotTable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";

// Dynamic import สำหรับ RsmProviderChart
const RsmProviderChart = dynamic(() => import("./charts/RsmProviderChart"), { 
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 16, color: "#666" }}>กำลังโหลด Provider Chart...</div>
    </div>
  )
});

// Dynamic import สำหรับ CtmProviderChart
const CtmProviderChart = dynamic(() => import("./charts/CtmProviderChart"), { 
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 16, color: "#666" }}>กำลังโหลด CTM Chart...</div>
    </div>
  )
});

// Dynamic import สำหรับ PivotTable
const PivotTable = dynamic(() => import("./tables/PivotTable"), { 
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 16, color: "#666" }}>กำลังโหลด Pivot Table...</div>
    </div>
  )
});

// Dynamic import สำหรับ DepotPowerRanking
const DepotPowerRanking = dynamic(() => import("./charts/DepotPowerRanking"), { 
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 16, color: "#666" }}>กำลังโหลด Depot Power Ranking...</div>
    </div>
  )
});

/* ---------- Types ---------- */
type Row = { [key: string]: any };

type KpiResp = {
  total: number;
  by_work_type: { key: string; count: number; percent: number }[];
  by_provider: { key: string; count: number; percent: number }[];
};

/* ---------- Utils ---------- */
function useDebounced<T>(value: T, delay = 400) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

function proxyImg(u: string, thumb = false) {
  return `/api/img?${thumb ? "thumb=1&" : ""}u=${encodeURIComponent(u)}`;
}

/** มาส์กเลขบัตรประชาชน - แสดงแค่ 4 ตัวท้าย */
function maskNationalId(nationalId: string): string {
  if (!nationalId) return "";
  const cleaned = String(nationalId).replace(/[^0-9]/g, ""); // เอาแค่ตัวเลข
  if (cleaned.length === 13) {
    return "xxxxxxxxx" + cleaned.slice(-4); // 9 ตัวแรกเป็น x, 4 ตัวท้ายจริง
  }
  return nationalId; // ถ้าไม่ใช่ 13 หลักให้แสดงตามเดิม
}

/** คำนวณ Work Experience จาก card_register_date */
function calculateWorkExperience(cardRegisterDate: string): string {
  if (!cardRegisterDate || cardRegisterDate.trim() === "") {
    return "—";
  }

  try {
    const registerDate = new Date(cardRegisterDate);
    const currentDate = new Date();
    
    // ตรวจสอบว่าวันที่ valid หรือไม่
    if (isNaN(registerDate.getTime()) || registerDate > currentDate) {
      return "—";
    }

    // คำนวณช่วงเวลา
    let years = currentDate.getFullYear() - registerDate.getFullYear();
    let months = currentDate.getMonth() - registerDate.getMonth();
    let days = currentDate.getDate() - registerDate.getDate();

    // ปรับปรุงการคำนวณเมื่อมีค่าติดลบ
    if (days < 0) {
      months--;
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
      days += lastMonth.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    // สร้างข้อความแสดงผล
    const parts = [];
    if (years > 0) parts.push(`${years} ปี`);
    if (months > 0) parts.push(`${months} เดือน`);
    if (days > 0) parts.push(`${days} วัน`);

    return parts.length > 0 ? parts.join(" ") : "น้อยกว่า 1 วัน";
  } catch (error) {
    console.error("Error calculating work experience:", error);
    return "—";
  }
}

/** คอลัมน์ที่ “ตาราง” ต้องแสดง (ซ่อน ctm โดยเอาออก) */
const COLS = [
  "national_id",
  "tech_id",
  "card_expire_date",
  "full_name",
  "doc_tech_card_url",
  "workgroup_status",
  "work_type",
  "provider",
  "area",
  "rsm",
  "ctm",
  "depot_code",
  "depot_name",
  "province",
  "power_authority",
] as const;

/** ความกว้างต่อคอลัมน์ (px) */
const WIDTHS: Partial<Record<(typeof COLS)[number], number>> = {
  national_id: 140,
  tech_id: 120,
  full_name: 220,
  doc_tech_card_url: 90,
  workgroup_status: 160,
  work_type: 130,
  provider: 140,
  area: 140,
  rsm: 120,
  ctm: 120,
  depot_code: 120,
  depot_name: 200,
  province: 160,
  power_authority: 140,
  card_expire_date: 130,
};

/* ---------- Component ---------- */
export default function TechBrowser() {
  /* Auth check */
  const { user, isAdmin, isManager } = useAuth();
  
  /* Performance Timing */
  const [componentStartTime] = React.useState(() => performance.now());
  const [initialLoadComplete, setInitialLoadComplete] = React.useState(false);

  /* table state */
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);

  /* filters */
  const [national_id, setNationalId] = React.useState("");
  const [tech_id, setTechId] = React.useState("");
  const [rsm, setRsm] = React.useState("");
  const [depot_code, setDepotCode] = React.useState("");
  const [q, setQ] = React.useState("");
  
  /* Selected RSM from chart */
  const [selectedRsm, setSelectedRsm] = React.useState<string | null>(null);
  
  /* Selected CTM from chart */
  const [selectedCtm, setSelectedCtm] = React.useState<string | null>(null);
  
  /* Selected Power Authority Status from chart */
  const [selectedPowerAuthority, setSelectedPowerAuthority] = React.useState<string | null>(null);

  const d_national_id = useDebounced(national_id);
  const d_tech_id = useDebounced(tech_id);
  const d_rsm = useDebounced(rsm);
  const d_depot_code = useDebounced(depot_code);
  const d_q = useDebounced(q);

  /* debounce timer for KPI */
  const kpiTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  /* rsm options for select */
  const [rsmOptions, setRsmOptions] = React.useState<string[]>([]);
  const [rsmLoading, setRsmLoading] = React.useState(false);

  /* sort */
  const [sort, setSort] =
    React.useState<(typeof COLS)[number]>("national_id");
  const [dir, setDir] = React.useState<"asc" | "desc">("asc");

  /* preview image */
  const [preview, setPreview] = React.useState<string | null>(null);

  /* detail popup (full-width modal) */
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailRow, setDetailRow] = React.useState<Row | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  /* KPI */
  const [kpi, setKpi] = React.useState<KpiResp | null>(null);
  const [kpiLoading, setKpiLoading] = React.useState(true);
  const [kpiInitialized, setKpiInitialized] = React.useState(false);
  const [kpiFetching, setKpiFetching] = React.useState(false);

  /* depot code count */
  const [depotCodeCount, setDepotCodeCount] = React.useState<number>(0);
  const [depotCodeLoading, setDepotCodeLoading] = React.useState(false);

  /* depot codes by provider */
  const [depotByProvider, setDepotByProvider] = React.useState<{[key: string]: number}>({});
  const [depotByProviderLoading, setDepotByProviderLoading] = React.useState(false);

  /* pivot table data */
  const [pivotData, setPivotData] = React.useState<any[]>([]);
  const [pivotLoading, setPivotLoading] = React.useState(false);

  /* workgroup count data */
  const [workgroupData, setWorkgroupData] = React.useState<Record<string, Record<string, number>>>({});
  const [workgroupGrandTotal, setWorkgroupGrandTotal] = React.useState<number>(0);
  const [workgroupLoading, setWorkgroupLoading] = React.useState(false);

  /* technician count data */
  const [technicianData, setTechnicianData] = React.useState<Record<string, Record<string, number>>>({});
  const [technicianLoading, setTechnicianLoading] = React.useState(false);

  /* Chart Data */
  const [chartData, setChartData] = React.useState<any[]>([]);
  const [chartSummary, setChartSummary] = React.useState<any>(null);
  const [chartLoading, setChartLoading] = React.useState(false);

  /* ----- helpers ----- */
  function buildParams(p = page, size = 10) {
    const params = new URLSearchParams({
      page: String(p),
      pageSize: String(size),
      sort,
      dir,
    });
    if (d_national_id) params.set("national_id", d_national_id);
    if (d_tech_id) params.set("tech_id", d_tech_id);
    // Use direct rsm value when selected from chart, otherwise use debounced
    if (selectedRsm) {
      params.set("rsm", selectedRsm);
    } else if (d_rsm) {
      params.set("rsm", d_rsm);
    }
    // Add CTM filter
    if (selectedCtm) {
      params.set("ctm", selectedCtm);
    }
    // Add Power Authority filter
    if (selectedPowerAuthority) {
      params.set("power_authority", selectedPowerAuthority);
    }
    if (d_depot_code) params.set("depot_code", d_depot_code);
    if (d_q) params.set("q", d_q);
    return params;
  }

  function buildFilterParamsOnly() {
    const p = new URLSearchParams();
    if (d_national_id) p.set("f_national_id", d_national_id);
    if (d_tech_id) p.set("f_tech_id", d_tech_id);
    // Use direct rsm value when selected from chart, otherwise use debounced
    // KPI API uses both 'rsm' and 'f_rsm' parameters
    if (selectedRsm) {
      p.set("rsm", selectedRsm);
      p.set("f_rsm", selectedRsm);
    } else if (d_rsm) {
      p.set("rsm", d_rsm);
      p.set("f_rsm", d_rsm);
    }
    // Add CTM filter for KPI
    if (selectedCtm) {
      p.set("ctm", selectedCtm);
      p.set("f_ctm", selectedCtm);
    }
    // Add Power Authority filter for KPI
    if (selectedPowerAuthority) {
      p.set("power_authority", selectedPowerAuthority);
      p.set("f_power_authority", selectedPowerAuthority);
    }
    if (d_depot_code) p.set("f_depot_code", d_depot_code);
    if (d_q) p.set("q", d_q);
    return p;
  }

  async function fetchData(p = page) {
    const startTime = performance.now();
    setLoading(true);
    setError(null);
    try {
      const params = buildParams(p);
      const url = `/api/technicians?${params.toString()}`;
      console.log('🔍 Fetching data with selectedRsm:', selectedRsm);
      console.log('🔍 Fetching data with selectedCtm:', selectedCtm);
      console.log('🔍 Fetching data with selectedPowerAuthority:', selectedPowerAuthority);
      console.log('🔍 Fetching data from:', url);
      
      // เพิ่ม timeout และ headers
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
      
      const res = await fetch(url, { 
        cache: "no-store",
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      console.log('📡 Response status:', res.status);
      console.log('📡 Response headers:', Object.fromEntries(res.headers.entries()));
      
      const text = await res.text();
      console.log('📄 Raw response:', text);
      
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON response: ' + text.substring(0, 100));
      }
      
      console.log('📊 Response data:', json);
      
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}: Failed to fetch`);
      setRows(json.rows || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
      setPage(json.page || p);
      
      const endTime = performance.now();
      console.log(`📊 Data fetch completed in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (e: any) {
      console.error('❌ Fetch error:', e);
      if (e.name === 'AbortError') {
        setError('Request timeout - โปรดลองใหม่อีกครั้ง');
      } else {
        setError(e.message || 'Unknown error');
      }
      // ไม่แสดง alert แล้ว ให้แสดงใน UI แทน
    } finally {
      setLoading(false);
    }
  }

  async function fetchChartData() {
    const startTime = performance.now();
    setChartLoading(true);
    try {
      // Add cache-busting parameter
      const cacheBuster = Date.now();
      const res = await fetch(`/api/chart/rsm-workgroup?_t=${cacheBuster}`, { 
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json?.error || "Failed to fetch chart data");
      
      setChartData(json.chartData || []);
      setChartSummary(json.summary || null);
      
      const endTime = performance.now();
      console.log(`📊 Chart data fetch completed in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (e: any) {
      console.error("Chart fetch error:", e);
    } finally {
      setChartLoading(false);
    }
  }

  async function fetchKpis() {
    // ป้องกันการเรียกซ้ำ
    if (kpiFetching) {
      console.log('🔄 KPI fetch already in progress, skipping...');
      return;
    }
    
    const startTime = performance.now();
    setKpiFetching(true);
    setKpiLoading(true);
    try {
      // ❌ DON'T USE FILTERS FOR KPI - KPI cards should show TOTAL data always
      // const params = buildFilterParamsOnly();
      // const url = `/api/kpis?${params.toString()}`;
      const url = `/api/kpis`; // NO FILTERS - always show total data
      console.log('📊 Fetching KPIs (TOTAL DATA - no filters)');
      console.log('📊 Fetching KPIs from:', url);
      
      // เพิ่ม timeout และ headers
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout
      
      const res = await fetch(url, { 
        cache: "no-store",
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      console.log('📡 KPI Response status:', res.status);
      
      const text = await res.text();
      console.log('📄 KPI Raw response:', text);
      
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON response from KPI API');
      }
      
      console.log('📊 KPI Response data:', json);
      
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}: KPI fetch error`);
      
      // ตรวจสอบว่าข้อมูลมีค่าที่ถูกต้องหรือไม่ (รองรับทั้ง nested และ flat format)
      const kpiData = json?.data || json; // รองรับทั้ง { data: {...} } และ {...} format
      console.log('📊 KPI Data extracted:', kpiData);
      const validKpi = {
        total: kpiData?.total ?? 0,
        by_work_type: Array.isArray(kpiData?.by_work_type) ? kpiData.by_work_type : [],
        by_provider: Array.isArray(kpiData?.by_provider) ? kpiData.by_provider : []
      };
      
      console.log('📊 Setting KPI data:', validKpi);
      console.log('📊 KPI total specifically:', kpiData?.total, 'vs', validKpi.total);
      setKpi(validKpi);
      setKpiInitialized(true);
      
      const endTime = performance.now();
      console.log(`📊 KPI fetch completed in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (e: any) {
      console.error('❌ KPI fetch error:', e);
      if (e.name === 'AbortError') {
        console.error('KPI request timeout');
      }
      // Set default KPI values on error
      setKpi({
        total: 0,
        by_work_type: [],
        by_provider: []
      });
      setKpiInitialized(true);
    } finally {
      setKpiLoading(false);
      setKpiFetching(false);
    }
  }

  // Debounced version of fetchKpis
  function debouncedFetchKpis(delay = 300) {
    if (kpiTimeoutRef.current) {
      clearTimeout(kpiTimeoutRef.current);
    }
    
    kpiTimeoutRef.current = setTimeout(() => {
      fetchKpis();
    }, delay);
  }

  /** ดึงรายการ RSM สำหรับ select (มี fallback จากข้อมูลช่างหน้าแรก) */
  async function fetchRsmOptions() {
    const startTime = performance.now();
    setRsmLoading(true);
    try {
      // 1) พยายามดึงจาก API โดยตรง - ใช้ /api/meta/rsm
      const res = await fetch(`/api/meta/rsm`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const list: string[] = Array.isArray(json?.options)
          ? json.options
          : Array.isArray(json?.rsmList)
          ? json.rsmList
          : Array.isArray(json) ? json : [];
        const uniq = Array.from(new Set(list.filter(Boolean))).sort(
          (a, b) => a.localeCompare(b, "th")
        );
        setRsmOptions(uniq);
        
        const endTime = performance.now();
        console.log(`📊 RSM options fetch completed in ${(endTime - startTime).toFixed(2)}ms`);
        return;
      }
      // 2) ถ้า API ไม่พร้อม → fallback ไปอ่านจาก technicians หน้าแรก
      const params = new URLSearchParams({ page: "1", pageSize: "200" });
      const res2 = await fetch(`/api/technicians?${params.toString()}`, {
        cache: "no-store",
      });
      const json2 = await res2.json();
      const uniq2 = Array.from(
        new Set<string>((json2?.rows || []).map((x: Row) => String(x?.rsm || "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "th"));
      setRsmOptions(uniq2);
      
      const endTime = performance.now();
      console.log(`📊 RSM options fetch (fallback) completed in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (e) {
      console.error(e);
      setRsmOptions((prev) => prev); // คงค่าเดิมไว้ถ้าพัง
    } finally {
      setRsmLoading(false);
    }
  }

  function clearFilters() {
    setNationalId("");
    setTechId("");
    setRsm("");
    setDepotCode("");
    setQ("");
    setSelectedRsm(null);
    setSelectedCtm(null);
    setPage(1);
  }

  async function fetchDepotCodeCount() {
    setDepotCodeLoading(true);
    try {
      // ใช้ API ใหม่ที่ดึง depot_code ทั้งหมดโดยตรงจากฐานข้อมูล
      const res = await fetch('/api/depot-codes', { cache: "no-store" });
      const json = await res.json();
      
      if (json.count !== undefined) {
        setDepotCodeCount(json.count);
        console.log(`📊 Depot codes: ${json.count} unique codes from ${json.total_rows} total rows`);
        console.log(`📊 Sample codes:`, json.sample_codes);
      } else {
        console.error('❌ Invalid response from depot-codes API:', json);
        setDepotCodeCount(0);
      }
      
    } catch (error) {
      console.error('Error fetching depot code count:', error);
      setDepotCodeCount(0);
    } finally {
      setDepotCodeLoading(false);
    }
  }

  async function fetchDepotCodesByProvider() {
    setDepotByProviderLoading(true);
    try {
      // ใช้ชื่อ provider ที่ตรงกับฐานข้อมูลตามที่คุณระบุ
      const providers = ["WW-Provider", "True Tech", "เถ้าแก่เทค"];
      const results: {[key: string]: number} = {};
      
      // ดึงข้อมูลแต่ละ provider
      for (const provider of providers) {
        console.log(`🔍 Fetching data for provider: "${provider}"`);
        const res = await fetch(`/api/depot-codes-by-provider?provider=${encodeURIComponent(provider)}`, { cache: "no-store" });
        const json = await res.json();
        
        console.log(`📊 Response for ${provider}:`, json);
        
        if (json.count !== undefined) {
          results[provider] = json.count;
          console.log(`✅ ${provider}: ${json.count} unique depot codes`);
        } else {
          results[provider] = 0;
          console.error(`❌ Invalid response for ${provider}:`, json);
        }
      }
      
      // ดึงรายการ provider ทั้งหมดเพื่อ debug
      console.log('🔍 Fetching all providers for debugging...');
      const allProvidersRes = await fetch('/api/depot-codes-by-provider?list_all=true', { cache: "no-store" });
      const allProviders = await allProvidersRes.json();
      console.log('📋 All providers in database:', allProviders);
      
      console.log('📊 Final depot by provider results:', results);
      setDepotByProvider(results);
      
    } catch (error) {
      console.error('Error fetching depot codes by provider:', error);
      setDepotByProvider({});
    } finally {
      setDepotByProviderLoading(false);
    }
  }

  async function fetchPivotData() {
    setPivotLoading(true);
    try {
      console.log('📊 Fetching pivot table data with filter q:', q);
      
      // Build URL with current filter
      const params = new URLSearchParams();
      if (q) {
        params.append('q', q);
      }
      
      const url = `/api/pivot-data${params.toString() ? '?' + params.toString() : ''}`;
      console.log('📊 Pivot API URL:', url);
      
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      
      if (json.data && Array.isArray(json.data)) {
        setPivotData(json.data);
        console.log(`📊 Pivot data loaded: ${json.data.length} combinations from ${json.total_rows} total rows`);
      } else {
        console.error('❌ Invalid pivot data response:', json);
        setPivotData([]);
      }
      
    } catch (error) {
      console.error('Error fetching pivot data:', error);
      setPivotData([]);
    } finally {
      setPivotLoading(false);
    }
  }

  /* Fetch workgroup count data */
  async function fetchWorkgroupData() {
    const startTime = performance.now();
    setWorkgroupLoading(true);
    try {
      const params = buildFilterParamsOnly();
      // Add cache-busting parameter
      params.set('_t', Date.now().toString());
      const url = `/api/chart/workgroup-count?${params.toString()}`;
      console.log('👥 Fetching workgroup data from:', url);
      
      const res = await fetch(url, { 
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}: Workgroup fetch error`);
      }
      
      console.log('👥 Workgroup data response:', json);
      console.log('👥 Response timestamp:', json.timestamp);
      console.log('👥 Response message:', json.message);
      setWorkgroupData(json.data || json); // Support both {data: ..., grandTotal: ...} and old format
      setWorkgroupGrandTotal(json.grandTotal || 0); // Get grandTotal from API
      
      const endTime = performance.now();
      console.log(`👥 Workgroup data loaded in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`👥 Workgroup Grand Total from API: ${json.grandTotal || 0}`);
      
      // Verify grand total calculation
      let calculatedTotal = 0;
      if (json.data) {
        Object.keys(json.data).forEach(rsm => {
          Object.keys(json.data[rsm]).forEach(key => {
            if (key.includes('_Installation') || key.includes('_Repair')) {
              calculatedTotal += json.data[rsm][key];
            }
          });
        });
      }
      console.log(`👥 Workgroup Grand Total (calculated in frontend): ${calculatedTotal}`);
      console.log(`👥 Difference: ${Math.abs((json.grandTotal || 0) - calculatedTotal)}`);
      
    } catch (error) {
      console.error('Error fetching workgroup data:', error);
      setWorkgroupData({});
      setWorkgroupGrandTotal(0);
    } finally {
      setWorkgroupLoading(false);
    }
  }

  /* Fetch technician count data */
  async function fetchTechnicianData() {
    const startTime = performance.now();
    setTechnicianLoading(true);
    try {
      const params = buildFilterParamsOnly();
      // Add cache-busting parameter
      params.set('_t', Date.now().toString());
      const url = `/api/chart/technician-count?${params.toString()}`;
      console.log('👨‍💼 Fetching technician data from:', url);
      
      const res = await fetch(url, { 
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}: Technician fetch error`);
      }
      
      console.log('👨‍💼 Technician data response:', json);
      setTechnicianData(json);
      
      const endTime = performance.now();
      console.log(`👨‍💼 Technician data loaded in ${(endTime - startTime).toFixed(2)}ms`);
      
    } catch (error) {
      console.error('Error fetching technician data:', error);
      setTechnicianData({});
    } finally {
      setTechnicianLoading(false);
    }
  }
  
  // Handle chart bar click for specific power authority status
  function handlePowerAuthorityClick(rsm: string, powerAuthority: "Yes" | "No") {
    console.log('📊 Power Authority bar clicked:', { rsm, powerAuthority });
    
    // Toggle selection if same RSM and power authority is clicked
    if (selectedRsm === rsm && selectedPowerAuthority === powerAuthority) {
      console.log('📊 Deselecting RSM and Power Authority');
      setSelectedRsm(null);
      setSelectedPowerAuthority(null);
      setRsm("");
    } else {
      console.log('📊 Selecting RSM:', rsm, 'Power Authority:', powerAuthority);
      setSelectedRsm(rsm);
      setSelectedPowerAuthority(powerAuthority);
      setRsm(rsm);
    }
  }

  // Handle general chart click (fallback)
  function handleChartClick(data: any) {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedRsm = data.activePayload[0].payload.rsm;
      console.log('📊 General chart clicked:', clickedRsm);
      
      // Only handle RSM selection without power authority filter
      if (selectedRsm === clickedRsm && !selectedPowerAuthority) {
        console.log('📊 Deselecting RSM');
        setSelectedRsm(null);
        setRsm("");
      } else if (!selectedPowerAuthority) {
        console.log('📊 Selecting RSM:', clickedRsm);
        setSelectedRsm(clickedRsm);
        setRsm(clickedRsm);
      }
    }
  }

  // Handle CTM chart click
  function handleCtmClick(ctm: string | null) {
    console.log('📊 CTM Chart clicked:', ctm);
    setSelectedCtm(ctm);
  }

  function toggleSort(c: (typeof COLS)[number]) {
    if (sort === c) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(c);
      setDir("asc");
    }
  }

  async function exportExcel() {
    try {
      setLoading(true);
      const XLSX = await import("xlsx");
      
      // ✅ Fetch ALL data using pagination to avoid Supabase 1000 limit
      console.log('📥 Starting Excel export with pagination...');
      
      let allRecords: any[] = [];
      let currentPage = 1;
      const pageSize = 1000; // Safe batch size
      let hasMore = true;
      
      while (hasMore) {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          pageSize: pageSize.toString(),
          sort: "tech_id",
          dir: "asc",
        });
        
        const res = await fetch(`/api/technicians?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        
        if (!res.ok) throw new Error(json?.error || "Export fetch failed");
        
        const rows = json.rows || [];
        allRecords = [...allRecords, ...rows];
        
        console.log(`📦 Page ${currentPage}: ${rows.length} records (total: ${allRecords.length}/${json.total})`);
        
        hasMore = rows.length === pageSize && allRecords.length < json.total;
        currentPage++;
        
        // Safety limit
        if (currentPage > 10) {
          console.warn('⚠️ Reached page limit');
          break;
        }
      }
      
      console.log(`✅ Exported ${allRecords.length} records total`);
      
      // ✅ Map ข้อมูลให้ตรงกับคอลัมน์ที่แสดงในตารางหน้าเว็บ (ใช้ชื่อภาษาไทย)
      const exportData = allRecords.map((r) => ({
        [getFieldLabel("national_id")]: r.national_id ?? "",
        [getFieldLabel("tech_id")]: r.tech_id ?? "",
        [getFieldLabel("card_expire_date")]: r.card_expire_date ?? "",
        [getFieldLabel("full_name")]: r.full_name ?? "",
        [getFieldLabel("workgroup_status")]: r.workgroup_status ?? "",
        [getFieldLabel("work_type")]: r.work_type ?? "",
        [getFieldLabel("provider")]: r.provider ?? "",
        [getFieldLabel("area")]: r.area ?? "",
        [getFieldLabel("rsm")]: r.rsm ?? "",
        [getFieldLabel("ctm")]: r.ctm ?? "",
        [getFieldLabel("depot_code")]: r.depot_code ?? "",
        [getFieldLabel("depot_name")]: r.depot_name ?? "",
        [getFieldLabel("province")]: r.province ?? "",
        [getFieldLabel("power_authority")]: r.power_authority ?? "",
      }));
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "technicians");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `technicians_${date}.xlsx`);
      console.log(`💾 Saved: technicians_${date}.xlsx`);
    } catch (e) {
      console.error('❌ Export error:', e);
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /** เปิด popup แล้วโหลด “ข้อมูลเต็มแถว” จาก /api/technicians/[tech_id] */
  async function openDetail(fullRowCandidate: Row) {
    // เช็คสิทธิ์ก่อน - Admin และ Manager เท่านั้นที่ดูรายละเอียดได้
    if (!isAdmin() && !isManager()) {
      alert("ไม่มีสิทธิ์ในการดูรายละเอียดช่างแต่ละคน\nสำหรับผู้ดูแลระบบและผู้จัดการเท่านั้น");
      return;
    }
    
    console.log('🔍 Opening detail for:', fullRowCandidate);
    
    const id =
      (fullRowCandidate?.tech_id || "").toString().trim() ||
      (fullRowCandidate?.national_id || "").toString().trim();

    console.log('🔍 Extracted ID:', id);

    if (!id) {
      alert("ไม่พบ tech_id / national_id สำหรับดึงรายละเอียด");
      return;
    }

    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailRow(null);

    try {
      const url = `/api/technicians/${encodeURIComponent(id)}`;
      console.log('🔍 Fetching URL:', url);
      
      const res = await fetch(url, {
        cache: "no-store",
      });
      
      console.log('🔍 Response status:', res.status);
      console.log('🔍 Response ok:', res.ok);
      
      const json = await res.json();
      console.log('🔍 Response JSON:', json);
      
      if (!res.ok) throw new Error(json?.error || "โหลดรายละเอียดไม่สำเร็จ");
      setDetailRow(json.row || json.data || null);
    } catch (e) {
      console.error('🔍 Error in openDetail:', e);
      setDetailError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }

  React.useEffect(() => {
    // Debug: ตรวจสอบ environment variables
    console.log('🔧 Environment check:');
    console.log('🔧 NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Not set');
    console.log('🔧 NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set');
    console.log('🔧 Current URL:', window.location.href);
    console.log('🔧 User Agent:', navigator.userAgent);
    
    fetchData(1);
  }, [d_national_id, d_tech_id, d_rsm, d_depot_code, d_q, sort, dir]);

  React.useEffect(() => {
    fetchData(page);
  }, [page]);

  React.useEffect(() => {
    // Reset KPI initialized state เมื่อ filter เปลี่ยน
    setKpiInitialized(false);
    debouncedFetchKpis();
    fetchDepotCodeCount();
    fetchWorkgroupData();
    fetchTechnicianData();
  }, [d_national_id, d_tech_id, d_rsm, d_depot_code, d_q]);

  // Trigger immediate update when selectedRsm changes
  React.useEffect(() => {
    console.log('🎯 Selected RSM changed:', selectedRsm);
    // Always fetch when selectedRsm changes (including null)
    fetchData(1);
    fetchKpis();
    fetchDepotCodeCount();
    fetchWorkgroupData();
    fetchTechnicianData();
  }, [selectedRsm]);

  // Trigger immediate update when selectedCtm changes
  React.useEffect(() => {
    console.log('🎯 Selected CTM changed:', selectedCtm);
    // Always fetch when selectedCtm changes (including null)
    fetchData(1);
    fetchKpis();
    fetchDepotCodeCount();
    fetchWorkgroupData();
    fetchTechnicianData();
  }, [selectedCtm]);

  /* ดึงรายการ RSM, Chart data และ KPI ตอน mount */
  React.useEffect(() => {
    fetchRsmOptions();
    fetchChartData();
    fetchKpis(); // เพิ่มการเรียก KPI ทันทีเมื่อ mount
    fetchDepotCodeCount(); // เพิ่มการนับ depot_code
    fetchDepotCodesByProvider(); // เพิ่มการนับ depot_code by provider
    fetchPivotData(); // เพิ่มการดึงข้อมูล pivot table
    fetchWorkgroupData(); // เพิ่มการดึงข้อมูล workgroup count
    fetchTechnicianData(); // เพิ่มการดึงข้อมูล technician count
  }, []);

  /* Re-fetch pivot data when filter changes */
  React.useEffect(() => {
    fetchPivotData();
  }, [q]);

  /* Cleanup timeout on unmount */
  React.useEffect(() => {
    return () => {
      if (kpiTimeoutRef.current) {
        clearTimeout(kpiTimeoutRef.current);
      }
    };
  }, []);

  /* Monitor initial load completion */
  React.useEffect(() => {
    if (!loading && !kpiLoading && !chartLoading && !initialLoadComplete) {
      const totalTime = performance.now() - componentStartTime;
      console.log(`🎯 TechBrowser initial load completed in ${totalTime.toFixed(2)}ms`);
      setInitialLoadComplete(true);
      
      // Check if we have login timing data
      const loginStartTime = localStorage.getItem('loginStartTime');
      if (loginStartTime) {
        const totalLoginTime = performance.now() - parseFloat(loginStartTime);
        console.log(`🎯 Total time from login to TechBrowser ready: ${totalLoginTime.toFixed(2)}ms`);
        localStorage.removeItem('loginStartTime'); // Clean up
      }
    }
  }, [loading, kpiLoading, chartLoading, initialLoadComplete, componentStartTime]);

  /* Setup Realtime subscription for technician table */
  React.useEffect(() => {
    // สร้าง Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    console.log('🔔 Setting up Realtime subscription for technician table...');

    // Subscribe to changes
    const channel = supabase
      .channel('technician-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',              // ฟังทุก event (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'technician'
        },
        (payload) => {
          console.log('🔔 Technician data changed!', payload);
          console.log('🔄 Auto-refreshing data...');

          // แสดง notification
          const eventType = payload.eventType;
          const message = eventType === 'INSERT' ? '✅ มีข้อมูลช่างใหม่' :
                         eventType === 'UPDATE' ? '🔄 ข้อมูลช่างถูกอัพเดท' :
                         eventType === 'DELETE' ? '🗑️ ข้อมูลช่างถูกลบ' :
                         '🔄 ข้อมูลมีการเปลี่ยนแปลง';
          
          // แสดง toast notification (ถ้าต้องการ)
          if (typeof window !== 'undefined') {
            // สร้าง notification element
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 80px;
              right: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 16px 24px;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              z-index: 10000;
              font-size: 14px;
              font-weight: 500;
              animation: slideIn 0.3s ease-out;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);

            // ลบหลัง 3 วินาที
            setTimeout(() => {
              notification.style.animation = 'slideOut 0.3s ease-in';
              setTimeout(() => notification.remove(), 300);
            }, 3000);
          }

          // อัพเดทข้อมูลทั้งหมด
          fetchData(page);
          fetchKpis();
          fetchChartData();
          fetchDepotCodeCount();
          fetchDepotCodesByProvider();
          fetchPivotData();
          fetchWorkgroupData();
          fetchTechnicianData();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscription active!');
        }
      });

    // Cleanup
    return () => {
      console.log('🔕 Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [page]);

  const start = (page - 1) * 10 + 1;
  const end = Math.min(total, page * 10);

  /* ---------- Render ---------- */
  return (
    <div>
      {/* Show loading overlay if KPI is loading */}
      {kpiLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255,255,255,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '6px solid #f3f3f3',
            borderTop: '6px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div style={{ fontSize: '18px', color: '#666' }}>
            กำลังโหลดข้อมูล...
          </div>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* ===== KPI Container + Technicians by RSM Table ===== */}
      <div style={{ 
        display: "flex", 
        gap: "16px", 
        alignItems: "stretch",
        marginBottom: "16px" 
      }}>
        {/* ===== ปุ่มรีเฟรชและ KPI rows ===== */}
        <div style={{ 
          background: "#eeeeee",
          padding: "16px",
          borderRadius: "8px",
          width: "650px"
        }}>
        {/* Header */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "12px",
          padding: "8px 0"
        }}>
          <div style={{ fontSize: "14px", fontWeight: "bold", color: "#333" }}>
            📊 ข้อมูลสรุป (Dashboard)
          </div>
        </div>
        {/* บรรทัดที่ 1: Technicians, Installation, Repair + Depot */}
        <div
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "130px",
            gap: 2,
            alignItems: "stretch",
            minHeight: 65,
            height: 65,
            overflow: "hidden",
            marginBottom: 4,
          }}
        >
          {/* Total */}
          <div
            style={{
              ...cardStyle,
              cursor: "pointer",
              background: "#203864",
              color: "white",
              border: "none",
            }}
            onClick={() => {
              clearFilters();
              setQ("");
            }}
            title="คลิกเพื่อล้างตัวกรองทั้งหมด"
          >
            <div style={{ ...cardTitle, color: "rgba(255,255,255,0.8)" }}>
              Technicians (คน)
            </div>
            <div style={{ ...cardNumber, color: "white" }}>
              {kpiLoading ? "กำลังโหลด..." : (kpiInitialized ? `${(kpi?.total ?? 0).toLocaleString()} (100%)` : "กำลังโหลด...")}
            </div>
          </div>

          {/* Work Type: Installation, Repair */}
          {["Installation", "Repair"].map((name, index) => {
            const f = (kpi?.by_work_type || []).find(
              (x) =>
                (x.key || "").trim().toLowerCase() === name.toLowerCase()
            );
            const count = f?.count ?? 0;
            const pct = f?.percent ?? 0;

            const colors = [
              { bg: "#87BFFF", text: "white" },
              { bg: "#87BFFF", text: "white" },
            ];

            return (
              <div
                key={name}
                style={{
                  ...cardStyle,
                  cursor: "pointer",
                  background: colors[index].bg,
                  color: colors[index].text,
                  border: q === name ? "2px solid #fff" : "none",
                  transition: "all 0.2s ease",
                  transform: q === name ? "scale(1.05)" : "scale(1)",
                  boxShadow: q === name ? "0 8px 16px rgba(0,0,0,0.2)" : "0 1px 2px rgba(0,0,0,0.04)",
                }}
                onClick={() => {
                  if (q === name) {
                    setQ("");
                  } else {
                    clearFilters();
                    setQ(name);
                  }
                }}
                onMouseOver={(e) => {
                  if (q !== name) e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseOut={(e) => {
                  if (q !== name) e.currentTarget.style.transform = "scale(1)";
                }}
                title={`คลิกเพื่อกรองตาม ${name}`}
              >
                <div style={{ ...cardTitle, color: "rgba(255,255,255,0.8)" }}>
                  {name}
                </div>
                <div style={{ ...cardNumber, color: "white" }}>
                  {kpiLoading ? "กำลังโหลด..." : `${count.toLocaleString()} (${pct.toFixed(1)}%)`}
                </div>
              </div>
            );
          })}

          {/* Depot Code */}
          <div
            style={{
              ...cardStyle,
              cursor: "pointer",
              background: "#203864",
              color: "white",
              border: "none",
              marginLeft: "10px",
            }}
            onClick={() => {
              clearFilters();
              setQ("");
            }}
            title="คลิกเพื่อล้างตัวกรองทั้งหมด - ข้อมูล Depot Code"
          >
            <div style={{ ...cardTitle, color: "rgba(255,255,255,0.8)" }}>
              Depot Code
            </div>
            <div style={{ ...cardNumber, color: "white" }}>
              {depotCodeLoading ? "กำลังโหลด..." : depotCodeCount.toLocaleString()}
            </div>
          </div>

          {/* Depot WW-Provider */}
          <div
            style={{
              ...cardStyle,
              cursor: "pointer",
              background: "#87BFFF",
              color: "white",
              border: "none",
            }}
            onClick={() => {
              if (q === "Depot WW-Provider") {
                setQ("");
              } else {
                clearFilters();
                setQ("Depot WW-Provider");
              }
            }}
            onMouseOver={(e) => {
              if (q !== "Depot WW-Provider") e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseOut={(e) => {
              if (q !== "Depot WW-Provider") e.currentTarget.style.transform = "scale(1)";
            }}
            title="คลิกเพื่อกรองตาม Depot WW-Provider"
          >
            <div style={{ ...cardTitle, color: "rgba(255,255,255,0.8)" }}>
              Depot WW
            </div>
            <div style={{ ...cardNumber, color: "white" }}>
              {depotByProviderLoading ? "กำลังโหลด..." : (() => {
                const count = depotByProvider["WW-Provider"] || 0;
                const percentage = depotCodeCount > 0 ? ((count / depotCodeCount) * 100).toFixed(1) : 0;
                return `${count} (${percentage}%)`;
              })()}
            </div>
          </div>
        </div>

        {/* บรรทัดที่ 2: WW-Provider, True Tech, เถ้าแก่เทค + Depot Provider */}
        <div
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "130px",
            gap: 2,
            alignItems: "stretch",
            minHeight: 65,
            height: 65,
            overflow: "hidden",
          }}
        >
          {/* Provider */}
          {["WW-Provider", "True Tech", "เถ้าแก่เทค"].map((name, index) => {
            const f = (kpi?.by_provider || []).find(
              (x) =>
                (x.key || "").trim().toLowerCase() === name.toLowerCase()
            );
            const count = f?.count ?? 0;
            const pct = f?.percent ?? 0;

            const colors = [
              { bg: "#87BFFF", text: "white" },
              { bg: "#87BFFF", text: "white" },
              { bg: "#87BFFF", text: "white" },
            ];

            return (
              <div
                key={name}
                style={{
                  ...cardStyle,
                  cursor: "pointer",
                  background: colors[index].bg,
                  color: colors[index].text,
                  border: q === name ? "2px solid #fff" : "none",
                  transition: "all 0.2s ease",
                  transform: q === name ? "scale(1.05)" : "scale(1)",
                  boxShadow: q === name ? "0 8px 16px rgba(0,0,0,0.2)" : "0 1px 2px rgba(0,0,0,0.04)",
                }}
                onClick={() => {
                  if (q === name) {
                    setQ("");
                  } else {
                    clearFilters();
                    setQ(name);
                  }
                }}
                onMouseOver={(e) => {
                  if (q !== name) e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseOut={(e) => {
                  if (q !== name) e.currentTarget.style.transform = "scale(1)";
                }}
                title={`คลิกเพื่อกรองตาม ${name}`}
              >
                <div
                  style={{
                    ...cardTitle,
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    ...cardNumber,
                    color: "white",
                  }}
                >
                  {kpiLoading ? "โหลด..." : (kpiInitialized ? `${count.toLocaleString()} (${pct}%)` : "โหลด...")}
                </div>
              </div>
            );
          })}

          {/* Depot Provider cards */}
          {["Depot True Tech", "Depot เถ้าแก่เทค"].map((name, index) => {
            // TODO: เพิ่มข้อมูลจริงจาก API ในอนาคต
            const count = 0;
            const pct = 0;

            const colors = [
              { bg: "#87BFFF", text: "white" },
              { bg: "#87BFFF", text: "white" },
            ];

            return (
              <div
                key={name}
                style={{
                  ...cardStyle,
                  cursor: "pointer",
                  background: colors[index].bg,
                  color: colors[index].text,
                  border: q === name ? "2px solid #fff" : "none",
                  transition: "all 0.2s ease",
                  transform: q === name ? "scale(1.05)" : "scale(1)",
                  boxShadow: q === name ? "0 8px 16px rgba(0,0,0,0.2)" : "0 1px 2px rgba(0,0,0,0.04)",
                  marginLeft: index === 0 ? "10px" : "0",
                }}
                onClick={() => {
                  if (q === name) {
                    setQ("");
                  } else {
                    clearFilters();
                    setQ(name);
                  }
                }}
                onMouseOver={(e) => {
                  if (q !== name) e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseOut={(e) => {
                  if (q !== name) e.currentTarget.style.transform = "scale(1)";
                }}
                title={`คลิกเพื่อกรองตาม ${name}`}
              >
                <div
                  style={{
                    ...cardTitle,
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    ...cardNumber,
                    color: "white",
                  }}
                >
                  {depotByProviderLoading ? "กำลังโหลด..." : (() => {
                    const providerName = name === "Depot True Tech" ? "True Tech" : "เถ้าแก่เทค";
                    const depotCount = depotByProvider[providerName] || 0;
                    const percentage = depotCodeCount > 0 ? ((depotCount / depotCodeCount) * 100).toFixed(1) : 0;
                    console.log(`🔍 Card ${name}: Looking for provider "${providerName}", found count: ${depotCount}, all providers:`, Object.keys(depotByProvider));
                    return `${depotCount} (${percentage}%)`;
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        </div>
        {/* ===== /KPI rows ===== */}

        {/* Technicians by RSM Table */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "12px",
          flex: "1",
          minWidth: "700px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column"
        }}>
          {pivotData.length > 0 ? (
            <div style={{ 
              fontSize: "12px", 
              overflow: "auto",
              flex: "1",
              display: "flex",
              flexDirection: "column"
            }}>
              <PivotTableComponent 
                data={pivotData} 
                workgroupData={workgroupData}
                workgroupGrandTotal={workgroupGrandTotal}
                technicianData={technicianData}
              />
            </div>
          ) : (
            <div style={{ 
              textAlign: "center", 
              color: "#6b7280", 
              padding: "20px",
              fontSize: "12px"
            }}>
              กำลังโหลดข้อมูล...
            </div>
          )}
        </div>
      </div>

      {/* ===== Stacked Column Charts ===== */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {selectedRsm && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ 
                  padding: "6px 12px", 
                  background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                  color: "white",
                  borderRadius: "20px",
                  fontSize: 13,
                  fontWeight: 500
                }}>
                  กำลังกรอง RSM: {selectedRsm}
                </span>
                <button
                  onClick={() => {
                    setSelectedRsm(null);
                    setRsm("");
                  }}
                  style={{
                    padding: "4px 8px",
                    background: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: 12
                  }}
                >
                  ✕ ยกเลิก
                </button>
              </div>
            )}
            {selectedCtm && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ 
                  padding: "6px 12px", 
                  background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
                  color: "white",
                  borderRadius: "20px",
                  fontSize: 13,
                  fontWeight: 500
                }}>
                  กำลังกรอง CTM: {selectedCtm}
                </span>
                <button
                  onClick={() => setSelectedCtm(null)}
                  style={{
                    padding: "4px 8px",
                    background: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: 12
                  }}
                >
                  ✕ ยกเลิก
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div style={{
          display: "grid", 
          gridTemplateColumns: "50% 50%", 
          gap: "20px"
        }}>
          {/* RSM Provider Chart (กราฟใหม่) - ย้ายมาเป็นอันแรก */}
          <div style={{
            background: "white",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            border: "1px solid #e5e7eb",
            position: "relative"
          }}>
            <h3 style={{
              margin: "0 0 20px 0",
              fontSize: 18,
              fontWeight: 600,
              color: "#1f2937"
            }}>
              🏪 RSM Provider Distribution
            </h3>
            <RsmProviderChart />
          </div>

          {/* CTM Provider Distribution Chart - ย้ายมาอยู่แถวแรก */}
          <div style={{
            background: "white",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            border: "1px solid #e5e7eb",
            position: "relative"
          }}>
            <h3 style={{
              margin: "0 0 20px 0",
              fontSize: 18,
              fontWeight: 600,
              color: "#1f2937"
            }}>
              🏪 CTM Provider Distribution
            </h3>
            <CtmProviderChart 
              selectedCtm={selectedCtm}
              onCtmClick={handleCtmClick}
            />
          </div>
        </div>
        
        {/* บรรทัดใหม่: RSM Power Authority Status Chart (50%) + พื้นที่สำหรับตารางอีก 50% */}
        <div style={{
          display: "grid", 
          gridTemplateColumns: "50% 50%", 
          gap: "20px",
          marginTop: "20px"
        }}>
          {/* RSM Workgroup Chart (RSM Power Authority Status) - 50% */}
          <div style={{
            background: "white",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            border: "1px solid #e5e7eb",
            position: "relative"
          }}>
            <h3 style={{
              margin: "0 0 20px 0",
              fontSize: 18,
              fontWeight: 600,
              color: "#1f2937"
            }}>
              ⚡ RSM Power Authority Status
            </h3>

          {chartLoading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 16, color: "#666" }}>กำลังโหลด Chart...</div>
            </div>
          ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={460}>
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="rsm" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis 
                  label={{ 
                    value: 'จำนวนช่าง (คน)', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fontSize: 12 }
                  }}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      const total = payload[0].payload.total;
                      return (
                        <div style={{
                          backgroundColor: "white",
                          padding: "10px",
                          border: "1px solid #ccc",
                          borderRadius: "8px",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                        }}>
                          <p style={{ fontWeight: "bold", marginBottom: "5px" }}>{label}</p>
                          {payload.map((entry: any, index: number) => (
                            <p key={index} style={{ color: entry.color, margin: "3px 0" }}>
                              {entry.name}: {entry.value} คน
                            </p>
                          ))}
                          <p style={{ fontWeight: "bold", marginTop: "5px", borderTop: "1px solid #eee", paddingTop: "5px" }}>
                            รวม: {total} คน
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  verticalAlign="top"
                  height={36}
                  iconType="rect"
                  wrapperStyle={{ paddingBottom: "10px" }}
                  formatter={(value: string) => {
                    // ใช้ข้อมูลจาก chartSummary ที่มีข้อมูลครบถ้วนทั้งหมด แทนการคำนวณจาก chartData ที่แสดงแค่ Top 8
                    if (chartSummary) {
                      if (value === "Yes") {
                        return `${value} (${(chartSummary.totalYes || 0).toLocaleString()})`;
                      }
                      if (value === "No") {
                        return `${value} (${(chartSummary.totalNo || 0).toLocaleString()})`;
                      }
                    }
                    
                    // Fallback: คำนวณจาก chartData ถ้าไม่มี chartSummary
                    const displayedYes = chartData.reduce((sum, item) => sum + (item.Yes || 0), 0);
                    const displayedNo = chartData.reduce((sum, item) => sum + (item.No || 0), 0);
                    
                    if (value === "Yes") {
                      return `${value} (${displayedYes.toLocaleString()})`;
                    }
                    if (value === "No") {
                      return `${value} (${displayedNo.toLocaleString()})`;
                    }
                    return value;
                  }}
                />
                <Bar 
                  dataKey="Yes" 
                  stackId="a" 
                  fill="#0EAD69"
                  name="Yes"
                  onClick={(data: any) => {
                    if (data && data.rsm) {
                      handlePowerAuthorityClick(data.rsm, "Yes");
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {chartData.map((entry, index) => {
                    const isRsmSelected = selectedRsm === entry.rsm;
                    const isPowerAuthoritySelected = selectedPowerAuthority === "Yes";
                    const isFullySelected = isRsmSelected && isPowerAuthoritySelected;
                    
                    return (
                      <Cell 
                        key={`cell-yes-${index}`} 
                        fill={isFullySelected ? "#0A7A4A" : "#0EAD69"}
                        opacity={
                          (selectedRsm && !isRsmSelected) || 
                          (selectedPowerAuthority && selectedPowerAuthority !== "Yes") 
                            ? 0.5 : 1
                        }
                        style={{ cursor: "pointer" }}
                        onMouseDown={(e: any) => {
                          e.stopPropagation();
                          handlePowerAuthorityClick(entry.rsm, "Yes");
                        }}
                      />
                    );
                  })}
                  <LabelList 
                    dataKey="Yes" 
                    position="center"
                    fill="white"
                    fontSize={10}
                    fontWeight="bold"
                    content={(props: any) => {
                      const { x, y, width, height, value, index } = props;
                      if (!value || value === 0) return null;
                      const entry = chartData[index];
                      const total = (entry.Yes || 0) + (entry.No || 0);
                      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                      return (
                        <text
                          x={x + width / 2}
                          y={y + height / 2}
                          fill="white"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="10"
                          fontWeight="bold"
                        >
                          {value} ({percentage}%)
                        </text>
                      );
                    }}
                  />
                </Bar>
                <Bar 
                  dataKey="No" 
                  stackId="a" 
                  fill="#D90429"
                  name="No"
                  onClick={(data: any) => {
                    if (data && data.rsm) {
                      handlePowerAuthorityClick(data.rsm, "No");
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {chartData.map((entry, index) => {
                    const isRsmSelected = selectedRsm === entry.rsm;
                    const isPowerAuthoritySelected = selectedPowerAuthority === "No";
                    const isFullySelected = isRsmSelected && isPowerAuthoritySelected;
                    
                    return (
                      <Cell 
                        key={`cell-no-${index}`} 
                        fill={isFullySelected ? "#A0021F" : "#D90429"}
                        opacity={
                          (selectedRsm && !isRsmSelected) || 
                          (selectedPowerAuthority && selectedPowerAuthority !== "No") 
                            ? 0.5 : 1
                        }
                        style={{ cursor: "pointer" }}
                        onMouseDown={(e: any) => {
                          e.stopPropagation();
                          handlePowerAuthorityClick(entry.rsm, "No");
                        }}
                      />
                    );
                  })}
                  <LabelList 
                    dataKey="No" 
                    position="center"
                    fill="white"
                    fontSize={10}
                    fontWeight="bold"
                    content={(props: any) => {
                      const { x, y, width, height, value, index } = props;
                      if (!value || value === 0) return null;
                      const entry = chartData[index];
                      const total = (entry.Yes || 0) + (entry.No || 0);
                      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                      return (
                        <text
                          x={x + width / 2}
                          y={y + height / 2}
                          fill="white"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="10"
                          fontWeight="bold"
                        >
                          {value} ({percentage}%)
                        </text>
                      );
                    }}
                  />
                  {/* แสดงจำนวนรวมเหนือยอดกราฟ */}
                  <LabelList 
                    dataKey="total" 
                    position="top"
                    fill="#111827"
                    fontSize={12}
                    fontWeight="bold"
                    offset={5}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 16, color: "#999" }}>ไม่มีข้อมูล Chart</div>
            </div>
          )}
          </div>

          {/* พื้นที่สำหรับตารางหรือกราฟอื่น - 50% */}
          <div style={{
            background: "white",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            border: "1px solid #e5e7eb",
            position: "relative"
          }}>
            <h3 style={{
              margin: "0 0 20px 0",
              fontSize: 18,
              fontWeight: 600,
              color: "#1f2937"
            }}>
              🏆 Top 10 Depot - บัตรการไฟฟ้าสูงสุด
            </h3>
            <DepotPowerRanking />
          </div>
        </div>

      </div>
      {/* ===== /Stacked Column Charts ===== */}

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 8,
          marginBottom: 12,
          backgroundColor: "#1e3a5f",
          padding: "12px",
          borderRadius: "8px"
        }}
      >
        <input
          placeholder="national_id"
          value={national_id}
          onChange={(e) => setNationalId(e.target.value)}
        />
        <input
          placeholder="tech_id"
          value={tech_id}
          onChange={(e) => setTechId(e.target.value)}
        />

        {/* RSM → select */}
        <select
          value={rsm}
          onChange={(e) => setRsm(e.target.value)}
          disabled={rsmLoading}
          title="เลือก RSM"
          style={{ height: 28 }}
        >
          <option value="">{rsmLoading ? "กำลังโหลด..." : "— RSM ทั้งหมด —"}</option>
          {rsmOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <input
          placeholder="depot_code"
          value={depot_code}
          onChange={(e) => setDepotCode(e.target.value)}
        />
        <input
          placeholder="ค้นหา (พิมพ์อะไรก็ได้)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <button 
          onClick={() => fetchData(1)} 
          disabled={loading}
          style={{
            backgroundColor: "#1e3a5f",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          ค้นหา
        </button>
        <button 
          onClick={clearFilters} 
          disabled={loading}
          style={{
            backgroundColor: "#1e3a5f",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          ล้างตัวกรอง
        </button>
        <button 
          onClick={exportExcel} 
          disabled={loading}
          style={{
            backgroundColor: "#1e3a5f",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          Export Excel
        </button>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#555" }}>
          {loading ? "กำลังโหลด..." : `${start}-${end} จาก ${total} รายการ`}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: "12px 16px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "8px",
          marginBottom: "12px",
          color: "#dc2626"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>❌ เกิดข้อผิดพลาด: {error}</span>
            <button 
              onClick={() => fetchData(1)}
              style={{
                background: "#dc2626",
                color: "white",
                border: "none",
                padding: "4px 8px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              ลองใหม่
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 1200, fontSize: 14 }}>
          <thead>
            <tr>
              {COLS.map((h) => (
                <th
                  key={h}
                  onClick={() => toggleSort(h)}
                  title="คลิกเพื่อเรียงลำดับ"
                  style={{
                    border: "1px solid #ddd",
                    padding: "6px 8px",
                    textAlign: "left",
                    background: "#f7f7f7",
                    cursor: "pointer",
                    userSelect: "none",
                    width: WIDTHS[h],
                    minWidth: WIDTHS[h],
                  }}
                >
                  {getFieldLabel(h)}
                  {sort === h ? (dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.national_id ?? r.tech_id ?? i}-${i}`}>
                {COLS.map((c) => (
                  <td
                    key={c}
                    style={{
                      border: "1px solid #eee",
                      padding: "6px 8px",
                      whiteSpace: "nowrap",
                      width: WIDTHS[c],
                      minWidth: WIDTHS[c],
                    }}
                  >
                    {c === "doc_tech_card_url" ? (
                      (() => {
                        const original = r.doc_tech_card_url || r.tech_card_url || "";
                        if (!original) return "";
                        const imgThumb = proxyImg(original, true);
                        const imgFull = proxyImg(original, false);
                        return (
                          <img
                            src={imgThumb}
                            alt="tech card"
                            loading="lazy"
                            style={{
                              width: 56,
                              height: 56,
                              objectFit: "cover",
                              borderRadius: 6,
                              cursor: "zoom-in",
                              boxShadow: "0 0 0 1px #ddd inset",
                            }}
                            onClick={() => setPreview(imgFull)}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                            }}
                          />
                        );
                      })()
                    ) : c === "national_id" ? (
                      // แสดงผลต่างกันตาม role
                      (isAdmin() || isManager()) ? (
                        <span
                          style={{
                            color: "#2563eb",
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontWeight: 500,
                          }}
                          onClick={() => openDetail(r)}
                          title="คลิกเพื่อดูข้อมูลทั้งหมด (Admin และ Manager)"
                        >
                          {maskNationalId(r[c] ?? "")}
                        </span>
                      ) : (
                        <span
                          style={{
                            color: "#374151",
                            fontWeight: 400,
                          }}
                          title="ข้อมูลสำหรับผู้ดูแลระบบและผู้จัดการเท่านั้น"
                        >
                          {maskNationalId(r[c] ?? "")}
                        </span>
                      )
                    ) : c === "tech_id" ? (
                      // แสดงผลต่างกันตาม role
                      (isAdmin() || isManager()) ? (
                        <span
                          style={{
                            color: "#2563eb",
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontWeight: 500,
                          }}
                          onClick={() => openDetail(r)}
                          title="คลิกเพื่อดูข้อมูลทั้งหมด (Admin และ Manager)"
                        >
                          {r[c] ?? ""}
                        </span>
                      ) : (
                        <span
                          style={{
                            color: "#374151",
                            fontWeight: 400,
                          }}
                          title="ข้อมูลสำหรับผู้ดูแลระบบเท่านั้น"
                        >
                          {r[c] ?? ""}
                        </span>
                      )
                    ) : (
                      r[c] ?? ""
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} style={{ padding: 12, textAlign: "center", color: "#777" }}>
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
          หน้าก่อน
        </button>
        <span style={{ fontSize: 13 }}>
          หน้า {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loading}
        >
          หน้าถัดไป
        </button>
        
        {/* Jump to page input */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: 12 }}>
          <span style={{ fontSize: 13, color: "#666" }}>ไปหน้า:</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            placeholder="หน้า"
            style={{
              width: 60,
              padding: "4px 6px",
              border: "1px solid #ddd",
              borderRadius: 4,
              fontSize: 13,
              textAlign: "center"
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const value = parseInt((e.target as HTMLInputElement).value);
                if (value >= 1 && value <= totalPages) {
                  setPage(value);
                  (e.target as HTMLInputElement).value = "";
                }
              }
            }}
            disabled={loading}
          />
          <button
            onClick={() => {
              const input = document.querySelector('input[type="number"]') as HTMLInputElement;
              if (input) {
                const value = parseInt(input.value);
                if (value >= 1 && value <= totalPages) {
                  setPage(value);
                  input.value = "";
                }
              }
            }}
            disabled={loading}
            style={{
              padding: "4px 8px",
              fontSize: 12,
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            ไป
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <img
            src={preview}
            alt="preview"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPreview(null)}
            style={{
              position: "fixed",
              top: 16,
              right: 16,
              fontSize: 24,
              color: "#fff",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

      {/* Detail Popup — PORTFOLIO (FULL WIDTH) */}
      {detailOpen && (
        <div
          onClick={() => setDetailOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: "96vw",
              maxWidth: "1600px",
              height: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,.3)",
              minWidth: 520,
            }}
          >
            {/* Header sticky */}
            <div style={{ position: "sticky", top: 0, background: "#fff", paddingBottom: 12, marginBottom: 12, zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1f2937" }}>
                    ข้อมูลช่าง: {detailRow?.full_name || detailRow?.tech_id || detailRow?.national_id || "-"}
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#6b7280" }}>
                    {detailLoading
                      ? "กำลังโหลดรายละเอียด..."
                      : detailError
                      ? "เกิดข้อผิดพลาด"
                      : `แสดงข้อมูลทั้งหมด ${Object.keys(detailRow || {}).length} ฟิลด์จาก Supabase`}
                  </p>
                </div>
                <button
                  onClick={() => setDetailOpen(false)}
                  style={{ background: "transparent", border: "none", fontSize: 24, cursor: "pointer", color: "#6b7280" }}
                >
                  ×
                </button>
              </div>
              {detailError && (
                <div style={{ color: "#b91c1c", marginTop: 8 }}>Error: {detailError}</div>
              )}
            </div>

            {/* ====== Portfolio layout ====== */}
            {detailRow && (
              <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
                {/* LEFT — photo sticky */}
                <div style={{ position: "sticky", top: 64, alignSelf: "start" }}>
                  <PhotoCard row={detailRow!} />
                </div>

                {/* RIGHT — summary + sections */}
                <div>
                  {/* Identity row beside photo (UPDATED order/fields) */}
                  <SummaryRow row={detailRow!} />

                  {/* Sections */}
                  <Section title={`Section 1: ${SECTION_LABELS.basic_info}`}>
                    <Field row={detailRow!} label={getFieldLabel("gender")} keys={["gender"]} />
                    <Field row={detailRow!} label={getFieldLabel("age")} keys={["age"]} />
                    <Field row={detailRow!} label={getFieldLabel("degree")} keys={["degree"]} />
                    <Field row={detailRow!} label={getFieldLabel("workgroup_status")} keys={["workgroup_status","status"]} />
                    <Field row={detailRow!} label={getFieldLabel("work_type")} keys={["work_type","team_type"]} />
                    <Field row={detailRow!} label={getFieldLabel("provider")} keys={["provider"]} />
                    <WorkExperienceField row={detailRow!} />
                  </Section>

                  <Section title={`Section 2: ${SECTION_LABELS.area_service}`}>
                    <Field row={detailRow!} label={getFieldLabel("area")} keys={["area"]} />
                    <Field row={detailRow!} label={getFieldLabel("province")} keys={["province","ctm_province"]} />
                    <Field row={detailRow!} label={getFieldLabel("rsm")} keys={["rsm"]} />
                    <Field row={detailRow!} label={getFieldLabel("ctm")} keys={["ctm"]} />
                    <Field row={detailRow!} label={getFieldLabel("depot_code")} keys={["depot_code"]} />
                    <Field row={detailRow!} label={getFieldLabel("depot_name")} keys={["depot_name"]} />
                  </Section>

                  <Section title={`Section 3: ${SECTION_LABELS.services}`}>
                    {[
                      [getFieldLabel("svc_install"), ["svc_install","service_install"]],
                      [getFieldLabel("svc_repair"), ["svc_repair","service_repair"]],
                      [getFieldLabel("svc_ojt"), ["svc_ojt"]],
                      [getFieldLabel("svc_safety"), ["svc_safety"]],
                      [getFieldLabel("svc_softskill"), ["svc_softskill"]],
                      [getFieldLabel("svc_5p"), ["svc_5p"]],
                      [getFieldLabel("svc_nonstandard"), ["svc_nonstandard"]],
                      [getFieldLabel("svc_corporate"), ["svc_corporate"]],
                      [getFieldLabel("svc_solar"), ["svc_solar"]],
                      [getFieldLabel("svc_fttr"), ["svc_fttr"]],
                      [getFieldLabel("svc_2g"), ["svc_2g"]],
                      [getFieldLabel("svc_cctv"), ["svc_cctv"]],
                      [getFieldLabel("svc_cyod"), ["svc_cyod"]],
                      [getFieldLabel("svc_dongle"), ["svc_dongle"]],
                      [getFieldLabel("svc_iot"), ["svc_iot"]],
                      [getFieldLabel("svc_gigatex"), ["svc_gigatex"]],
                      [getFieldLabel("svc_wifi"), ["svc_wifi"]],
                      [getFieldLabel("svc_smarthome"), ["svc_smarthome"]],
                      [getFieldLabel("svc_catv_settop"), ["svc_catv_settop"]],
                      [getFieldLabel("svc_true_id"), ["svc_true_id"]],
                      [getFieldLabel("svc_true_inno"), ["svc_true_inno"]],
                      [getFieldLabel("svc_l3"), ["svc_l3"]],
                    ].map(([label, keys]) => (
                      <Field key={String(label)} row={detailRow!} label={String(label)} keys={keys as string[]} />
                    ))}
                  </Section>

                  <Section title={`Section 4: ${SECTION_LABELS.authority_safety}`}>
                    <Field row={detailRow!} label={getFieldLabel("power_authority")} keys={["power_authority"]} />
                    <Field row={detailRow!} label={getFieldLabel("power_card_start_date")} keys={["power_card_start_date"]} isDate />
                    <Field row={detailRow!} label={getFieldLabel("power_card_expire_date")} keys={["power_card_expire_date"]} isDate />
                    <Field row={detailRow!} label={getFieldLabel("sso_number")} keys={["sso_number"]} />
                    <Field row={detailRow!} label={getFieldLabel("safety_officer_executive")} keys={["safety_officer_executive"]} />
                    <Field row={detailRow!} label={getFieldLabel("safety_officer_supervisor")} keys={["safety_officer_supervisor"]} />
                    <Field row={detailRow!} label={getFieldLabel("safety_officer_technical")} keys={["safety_officer_technical"]} />
                  </Section>

                  <Section title={`Section 5: ${SECTION_LABELS.vehicle_info}`}>
                    <Field row={detailRow!} label={getFieldLabel("car_brand_code")} keys={["car_brand_code"]} />
                    <Field row={detailRow!} label={getFieldLabel("car_model")} keys={["car_model"]} />
                    <Field row={detailRow!} label={getFieldLabel("car_color")} keys={["car_color"]} />
                    <Field row={detailRow!} label={getFieldLabel("car_license_plate")} keys={["car_license_plate"]} />
                    <Field row={detailRow!} label={getFieldLabel("car_reg_province")} keys={["car_reg_province"]} />
                    <Field row={detailRow!} label={getFieldLabel("car_type")} keys={["car_type"]} />
                    <Field row={detailRow!} label={getFieldLabel("equip_carryboy")} keys={["equip_carryboy"]} />
                  </Section>

                  <Section title={`Section 6: ${SECTION_LABELS.documents}`}>
                    <DocField row={detailRow!} label={getFieldLabel("doc_tech_card_url")} keys={["doc_tech_card_url","tech_card_url"]} />
                    <DocField row={detailRow!} label={getFieldLabel("doc_id_card_url")} keys={["doc_id_card_url"]} />
                    <DocField row={detailRow!} label={getFieldLabel("doc_driver_license_url")} keys={["doc_driver_license_url"]} />
                    <DocField row={detailRow!} label={getFieldLabel("doc_education_certificate_url")} keys={["doc_education_certificate_url"]} />
                    <DocField row={detailRow!} label={getFieldLabel("doc_criminal_record_url")} keys={["doc_criminal_record_url"]} />
                    <DocField row={detailRow!} label={getFieldLabel("doc_medical_certificate_url")} keys={["doc_medical_certificate_url"]} />
                    <DocField row={detailRow!} label={getFieldLabel("doc_power_authority_card_url")} keys={["doc_power_authority_card_url"]} />
                    <DocField row={detailRow!} label={getFieldLabel("doc_safety_officer_executive_url")} keys={["doc_safety_officer_executive_url"]} />
                    <DocField row={detailRow!} label={getFieldLabel("doc_safety_officer_supervisor_url")} keys={["doc_safety_officer_supervisor_url"]} />
                    <DocField row={detailRow!} label={getFieldLabel("doc_safety_officer_technical_url")} keys={["doc_safety_officer_technical_url"]} />
                  </Section>
                </div>
              </div>
            )}

            {/* Watermark Footer */}
            <div style={{
              marginTop: 24,
              paddingTop: 16,
              paddingBottom: 12,
              borderTop: '2px solid #e5e7eb',
              background: 'linear-gradient(to bottom, #f9fafb, #f3f4f6)',
              borderRadius: '0 0 12px 12px',
              marginLeft: -24,
              marginRight: -24,
              marginBottom: -24,
              paddingLeft: 24,
              paddingRight: 24,
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: 13,
                color: '#6b7280',
                fontWeight: 500,
                letterSpacing: '0.3px'
              }}>
                © 2025 WW-Provider - For Internal Use Only
              </div>
              <div style={{
                fontSize: 11,
                color: '#9ca3af',
                marginTop: 4
              }}>
                ข้อมูลนี้เป็นความลับและใช้เพื่อการทำงานภายในเท่านั้น
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

/* ---------- Reusable UI for the modal ---------- */
function SummaryRow({ row }: { row: Row }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 12,
      marginBottom: 16,
    }}>
      <SummaryChip label={getFieldLabel("tech_id")}>{pick(row, ["tech_id"]) || "—"}</SummaryChip>
      <SummaryChip label={getFieldLabel("full_name")}>{pick(row, ["full_name","tech_first_name","tech_last_name"]) || "—"}</SummaryChip>
      <SummaryChip label={getFieldLabel("card_expire_date")}>{pick(row, ["card_expire_date"]) || "—"}</SummaryChip>
      <SummaryChip label={getFieldLabel("phone")}>{pick(row, ["phone","tel"]) || "—"}</SummaryChip>
      <SummaryChip label={getFieldLabel("email")}>{pick(row, ["email"]) || "—"}</SummaryChip>
    </div>
  );
}

function SummaryChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: "12px 14px",
      background: "#f9fafb",
      border: "1px solid #e5e7eb",
      borderRadius: 10
    }}>
      <div style={{ fontSize: 11, color: "#6b7280", letterSpacing: .4, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{children}</div>
    </div>
  );
}

function PhotoCard({ row }: { row: Row }) {
  const url = pick(row, ["doc_tech_card_url", "tech_card_url"]);
  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 12,
      background: "#fff",
      boxShadow: "0 1px 2px rgba(0,0,0,.04)",
      width: 300
    }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{getFieldLabel("doc_tech_card_url")}</div>
      {url ? (
        <img
          src={proxyImg(String(url), false)}
          alt="tech card"
          style={{ width: "100%", height: "auto", borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
      ) : (
        <div style={{
          height: 200,
          borderRadius: 8,
          border: "1px dashed #e5e7eb",
          color: "#9ca3af",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>ไม่มีรูป</div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontWeight: 700,
        fontSize: 14,
        marginBottom: 10,
        background: "#eef2ff",
        color: "#1e40af",
        padding: "6px 10px",
        borderRadius: 8,
        display: "inline-block"
      }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Field({
  row,
  label,
  keys,
  isDate = false,
}: {
  row: Row;
  label: string;
  keys: string[];
  isDate?: boolean;
}) {
  let v = pick(row, keys);
  // แสดงค่าที่ดึงมาจาก Supabase โดยตรง โดยไม่แปลงรูปแบบ
  const hasValue = v !== undefined && v !== null && String(v).trim() !== "";
  return (
    <div style={{
      padding: 12,
      background: hasValue ? "#f9fafb" : "#f3f4f6",
      borderRadius: 8,
      border: "1px solid #e5e7eb",
      opacity: hasValue ? 1 : 0.7
    }}>
      <div style={{ fontSize: 12, color: hasValue ? "#6b7280" : "#9ca3af", marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: hasValue ? "#111827" : "#6b7280" }}>
        {hasValue ? String(v) : "—"}
      </div>
    </div>
  );
}

// Add CSS animations for notifications
if (typeof window !== 'undefined' && !document.getElementById('realtime-notification-styles')) {
  const style = document.createElement('style');
  style.id = 'realtime-notification-styles';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

function WorkExperienceField({ row }: { row: Row }) {
  const cardRegisterDate = pick(row, ["card_register_date"]);
  const workExperience = calculateWorkExperience(cardRegisterDate || "");
  const hasValue = cardRegisterDate && cardRegisterDate.trim() !== "";
  
  return (
    <div style={{
      padding: 12,
      background: hasValue ? "#f9fafb" : "#f3f4f6",
      borderRadius: 8,
      border: "1px solid #e5e7eb",
      opacity: hasValue ? 1 : 0.7
    }}>
      <div style={{ fontSize: 12, color: hasValue ? "#6b7280" : "#9ca3af", marginBottom: 4, fontWeight: 500 }}>
        {getFieldLabel("work_experience")}
      </div>
      <div style={{ fontSize: 14, color: hasValue ? "#111827" : "#6b7280", fontWeight: hasValue ? 600 : 400 }}>
        {workExperience}
      </div>
      {hasValue && (
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
          ลงทะเบียนเมื่อ: {new Date(cardRegisterDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      )}
    </div>
  );
}

function DocField({ row, label, keys }: { row: Row; label: string; keys: string[] }) {
  const v = pick(row, keys);
  const has = v !== undefined && v !== null && String(v).trim() !== "";
  return (
    <div style={{
      padding: 12,
      background: has ? "#f9fafb" : "#f3f4f6",
      borderRadius: 8,
      border: "1px solid #e5e7eb",
      opacity: has ? 1 : 0.7
    }}>
      <div style={{ fontSize: 12, color: has ? "#6b7280" : "#9ca3af", marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 14 }}>
        {has ? (
          <a href={proxyImg(String(v), false)} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
            เปิดไฟล์
          </a>
        ) : "—"}
      </div>
    </div>
  );
}

/* pick first non-empty value by candidate keys */
function pick(row: Row, keys: string[]) {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}



/* ---------- styles ---------- */
const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  minHeight: 65,
  transition: "all 0.2s ease-in-out",
};
const cardTitle: React.CSSProperties = { fontSize: 12, color: "#6b7280", marginBottom: 4 };
const cardNumber: React.CSSProperties = { fontSize: 14, fontWeight: 700 };
const cardSub: React.CSSProperties = { fontSize: 12, color: "#6b7280" };

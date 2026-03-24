"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SidebarLayout from '@/components/common/SidebarLayout';
import * as XLSX from 'xlsx';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList, PieChart, Pie, ComposedChart, AreaChart, Area } from 'recharts';

interface TransactionItem {
  Year?: number;
  Month?: string;
  Week?: number;
  Date?: string;
  provider?: string;
  Register?: string;
  Register_Ref?: string;
  [key: string]: any;
}

function TechTransactionContent() {
  const [data, setData] = useState<TransactionItem[]>([]);
  const [allData, setAllData] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // DB counts for accurate statistics
  const [dbTotalTransactions, setDbTotalTransactions] = useState<number>(0);
  const [dbNewTechs, setDbNewTechs] = useState<number>(0);
  const [dbResignedTechs, setDbResignedTechs] = useState<number>(0);

  // Current technician count for November chart
  const [currentTechnicianCount, setCurrentTechnicianCount] = useState<number>(0);

  // Filter states - changed to arrays for multi-select
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState<{
    years: any[];
    months: any[];
    weeks: any[];
    dates: any[];
  }>({ years: [], months: [], weeks: [], dates: [] });

  // Dropdown open/close states
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  // Top 10 Depot month filter
  const [selectedDepotMonths, setSelectedDepotMonths] = useState<string[]>([]);
  const [selectedDepotYears, setSelectedDepotYears] = useState<string[]>([]);

  // Card selection state for interactive filtering
  const [selectedCard, setSelectedCard] = useState<'all' | 'new' | 'resigned' | 'net'>('all');

  const itemsPerPage = 50;

  // Auto-close dropdown function
  const autoCloseDropdown = (closeFunction: () => void) => {
    setTimeout(() => {
      closeFunction();
    }, 3000); // 3 seconds delay
  };

  useEffect(() => {
    fetchTransactions();
  }, [currentPage]);

  useEffect(() => {
    fetchAllData();
    fetchFilterOptions();
    fetchDBCounts();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYears, selectedMonths, selectedWeeks, selectedDates, searchTerm]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setYearDropdownOpen(false);
        setMonthDropdownOpen(false);
        setWeekDropdownOpen(false);
        setDateDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Setup Realtime subscription for transaction table
  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    console.log('🔔 Setting up Realtime subscription for transaction table...');

    const channel = supabase
      .channel('transaction-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transaction'
        },
        (payload) => {
          console.log('🔔 Transaction data changed!', payload);
          console.log('🔄 Auto-refreshing data...');

          const eventType = payload.eventType;
          const message = eventType === 'INSERT' ? '✅ มีข้อมูล Transaction ใหม่' :
            eventType === 'UPDATE' ? '🔄 ข้อมูล Transaction ถูกอัพเดท' :
              eventType === 'DELETE' ? '🗑️ ข้อมูล Transaction ถูกลบ' :
                '🔄 ข้อมูลมีการเปลี่ยนแปลง';

          // แสดง notification
          if (typeof window !== 'undefined') {
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 80px;
              right: 20px;
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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

            setTimeout(() => {
              notification.style.animation = 'slideOut 0.3s ease-in';
              setTimeout(() => notification.remove(), 300);
            }, 3000);
          }

          // รีเฟรชข้อมูลทั้งหมด
          fetchAllData();
          fetchFilterOptions();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Transaction Realtime subscription active!');
        }
      });

    return () => {
      console.log('🔕 Cleaning up Transaction Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDBCounts = async () => {
    try {
      console.log('📊 Fetching DB counts for statistics...');

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Count total transactions using exact count
      const { count: totalTransCount, error: totalError } = await supabase
        .from('transaction')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        console.error('Error fetching total transactions:', totalError);
      } else {
        console.log(`✅ Total Transactions = ${totalTransCount}`);
        setDbTotalTransactions(totalTransCount || 0);
      }

      // Count "ช่างใหม่" - use OR condition to catch both normal and encoding-issue records
      const { count: newTechsCount, error: newError } = await supabase
        .from('transaction')
        .select('*', { count: 'exact', head: true })
        .or('Register.ilike.%างใหม่%,Register.ilike.%ช่า%ใหม่%');

      if (newError) {
        console.error('Error fetching new techs:', newError);
      } else {
        console.log(`✅ New Techs = ${newTechsCount}`);
        setDbNewTechs(newTechsCount || 0);
      }

      // Count "ช่างลาออก" + "Blacklist" using OR condition
      const { count: resignedTechsCount, error: resignedError } = await supabase
        .from('transaction')
        .select('*', { count: 'exact', head: true })
        .or('Register.ilike.%ช่างลาออก%,Register.ilike.%Blacklist%');

      if (resignedError) {
        console.error('Error fetching resigned techs:', resignedError);
      } else {
        console.log(`✅ Resigned Techs = ${resignedTechsCount}`);
        setDbResignedTechs(resignedTechsCount || 0);
      }

      // Count current total technicians from technicians table
      const { count: currentTechCount, error: techError } = await supabase
        .from('technicians')
        .select('*', { count: 'exact', head: true });

      if (techError) {
        console.error('Error fetching current technician count:', techError);
      } else {
        console.log(`✅ Current Technicians = ${currentTechCount}`);
        setCurrentTechnicianCount(currentTechCount || 0);
      }

      console.log(`✅ DB Counts: Total = ${totalTransCount}, New = ${newTechsCount}, Resigned = ${resignedTechsCount}, Net = ${(newTechsCount || 0) - (resignedTechsCount || 0)}`);

    } catch (err) {
      console.error('❌ Error fetching DB counts:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching Transactions directly from DB...', { page: currentPage, limit: itemsPerPage });

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // First get total count
      const { count: totalRecords } = await supabase
        .from('transaction')
        .select('*', { count: 'exact', head: true });

      console.log('📊 Total transaction records in DB:', totalRecords);

      // Fetch paginated data
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: fetchedData, error: fetchError } = await supabase
        .from('transaction')
        .select('*')
        .order('Date', { ascending: false })
        .order('Year', { ascending: false })
        .order('Week', { ascending: false })
        .range(from, to);

      if (fetchError) {
        console.error('❌ Supabase Error:', fetchError);
        throw new Error(fetchError.message);
      }

      console.log('✅ Fetched from DB:', {
        dataLength: fetchedData?.length,
        totalCount: totalRecords,
        page: currentPage
      });

      setData(fetchedData || []);
      setTotalCount(totalRecords || 0);

    } catch (err: any) {
      console.error('❌ Error fetching transactions:', err);
      setError(err.message || 'An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    try {
      console.log('📥 Fetching all transaction data directly from DB...');

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // First, get total count
      const { count: totalCount } = await supabase
        .from('transaction')
        .select('*', { count: 'exact', head: true });

      console.log('📊 Total records in database:', totalCount);

      // Fetch in batches (1000 per batch) using pagination
      let allRecords: any[] = [];
      const batchSize = 1000;
      let currentBatch = 0;
      let hasMore = true;

      while (hasMore) {
        const from = currentBatch * batchSize;
        const to = from + batchSize - 1;

        const { data: batchData, error: batchError } = await supabase
          .from('transaction')
          .select('*')
          .order('Date', { ascending: false })
          .order('Year', { ascending: false })
          .order('Week', { ascending: false })
          .range(from, to);

        if (batchError) {
          console.error('❌ Error fetching batch', currentBatch, ':', batchError);
          break;
        }

        if (batchData && batchData.length > 0) {
          allRecords = [...allRecords, ...batchData];
          console.log(`📦 Batch ${currentBatch + 1}: ${batchData.length} records (total: ${allRecords.length}/${totalCount})`);

          // Debug register types in each batch
          const registerTypes = [...new Set(batchData.map((item: any) => item.Register))];
          console.log(`📋 Batch ${currentBatch + 1} register types:`, registerTypes);

          hasMore = batchData.length === batchSize;
          currentBatch++;
        } else {
          hasMore = false;
        }

        // Safety limit
        if (currentBatch > 10) {
          console.warn('⚠️ Reached batch limit of 10');
          break;
        }
      }

      setAllData(allRecords);

      // Debug: Check what months are in the data
      const monthsInData = [...new Set(allRecords.map((item: any) => item.Month).filter(Boolean))];
      console.log('✅ All transaction data loaded:', allRecords.length, '/', totalCount, 'records');
      console.log('📅 Months in allData:', monthsInData);
      console.log('🗓️ First 5 records:', allRecords.slice(0, 5));
    } catch (err: any) {
      console.error('❌ Error fetching all data:', err);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      console.log('🔽 Fetching filter options directly from DB...');

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Fetch all transactions with pagination
      let allTransactions: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('transaction')
          .select('Year, Month, Week, Date')
          .range(from, from + batchSize - 1);

        if (error) {
          console.error('❌ Error fetching filter data:', error);
          throw error;
        }

        if (batch && batch.length > 0) {
          allTransactions = [...allTransactions, ...batch];
          from += batchSize;
          hasMore = batch.length === batchSize;
          console.log(`📥 Fetched batch: ${batch.length} records, total: ${allTransactions.length}`);
        } else {
          hasMore = false;
        }
      }

      console.log('📥 Total transactions for filters:', allTransactions.length);

      // Month order for sorting
      const monthOrder = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      // Extract unique values and sort
      const years = [...new Set(allTransactions.map((item: any) => item.Year).filter(Boolean))].sort();

      // Sort months by calendar order
      const uniqueMonths = [...new Set(allTransactions.map((item: any) => item.Month).filter(Boolean))];
      const months = uniqueMonths.sort((a: any, b: any) => {
        return monthOrder.indexOf(a) - monthOrder.indexOf(b);
      });

      // Convert weeks to strings for consistent comparison
      const weeks = [...new Set(allTransactions.map((item: any) => String(item.Week)).filter(Boolean))].sort((a: any, b: any) => Number(a) - Number(b));
      const dates = [...new Set(allTransactions.map((item: any) => item.Date).filter(Boolean))].sort();

      const options = { years, months, weeks, dates };
      setFilterOptions(options);

      console.log('✅ Filter options loaded from DB:', {
        years: years.length,
        months: months.length,
        weeks: weeks.length,
        dates: dates.length
      });
      console.log('📅 Months:', months);
    } catch (err: any) {
      console.error('❌ Error fetching filter options:', err);
    }
  };

  // Filter allData instead of data
  const filteredAllData = useMemo(() => {
    console.log('🔍 Filtering data...', {
      allDataLength: allData.length,
      selectedYears,
      selectedMonths,
      selectedWeeks,
      selectedDates,
      searchTerm
    });

    let filtered = allData;

    // Apply filters (multi-select)
    if (selectedYears.length > 0) {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(item => {
        const itemYear = String(item.Year);
        const match = selectedYears.includes(itemYear);
        return match;
      });
      console.log(`📅 Year filter: ${beforeFilter} → ${filtered.length}`);
    }

    if (selectedMonths.length > 0) {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(item => {
        const itemMonth = String(item.Month);
        const match = selectedMonths.includes(itemMonth);
        return match;
      });
      console.log(`📅 Month filter: ${beforeFilter} → ${filtered.length}`, {
        selectedMonths,
        sampleMonth: filtered[0]?.Month
      });
    }

    if (selectedWeeks.length > 0) {
      const beforeFilter = filtered.length;
      // Week in database is number, but selectedWeeks is string array
      filtered = filtered.filter(item => {
        const weekStr = String(item.Week);
        const match = selectedWeeks.includes(weekStr);
        return match;
      });
      console.log(`📅 Week filter: ${beforeFilter} → ${filtered.length}`);
    }

    if (selectedDates.length > 0) {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(item => {
        const itemDate = String(item.Date);
        const match = selectedDates.includes(itemDate);
        return match;
      });
      console.log(`📅 Date filter: ${beforeFilter} → ${filtered.length}`);
    }

    // Apply search term
    if (searchTerm.trim()) {
      const beforeFilter = filtered.length;
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        return Object.values(item).some((value) =>
          String(value).toLowerCase().includes(lowerSearch)
        );
      });
      console.log(`🔍 Search filter: ${beforeFilter} → ${filtered.length}`);
    }

    // Filter by selected card
    if (selectedCard === 'new') {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(item => item.Register?.includes('างใหม่'));
      console.log(`🎯 Card filter (ช่างใหม่): ${beforeFilter} → ${filtered.length}`);
    } else if (selectedCard === 'resigned') {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(item => item.Register?.includes('ช่างลาออก') || item.Register?.toLowerCase().includes('blacklist'));
      console.log(`🎯 Card filter (ช่างลาออก+Blacklist): ${beforeFilter} → ${filtered.length}`);
    }

    // Sort by Date (newest to oldest)
    filtered.sort((a, b) => {
      const dateA = a.Date ? new Date(a.Date).getTime() : 0;
      const dateB = b.Date ? new Date(b.Date).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });

    console.log(`✅ Final filtered count: ${filtered.length}`);

    return filtered;
  }, [allData, searchTerm, selectedYears, selectedMonths, selectedWeeks, selectedDates, selectedCard]);

  // Calculate statistics - use DB counts if no filters, otherwise use filtered data
  const statistics = useMemo(() => {
    const hasFilters = selectedYears.length > 0 || selectedMonths.length > 0 ||
      selectedWeeks.length > 0 || selectedDates.length > 0 ||
      searchTerm.trim() !== '' || selectedCard !== 'all';

    let totalTransactions, newTechs, resignedTechs;

    if (hasFilters) {
      // If filters are applied, count from filtered data
      totalTransactions = filteredAllData.length;

      newTechs = filteredAllData.filter(item => {
        const register = String(item.Register || '');
        // Check for both normal and encoding-issue patterns
        return register.includes('างใหม่') || register.includes('ช่า') && register.includes('ใหม่');
      }).length;

      resignedTechs = filteredAllData.filter(item => {
        const register = String(item.Register || '');
        return register.includes('ช่างลาออก') || register.toLowerCase().includes('blacklist');
      }).length;
    } else {
      // No filters - use DB counts for accuracy
      totalTransactions = dbTotalTransactions;
      newTechs = dbNewTechs;
      resignedTechs = dbResignedTechs;
    }

    const netChange = newTechs - resignedTechs;

    console.log('📊 Statistics calculated:', {
      totalTransactions,
      newTechs,
      resignedTechs,
      netChange,
      hasFilters,
      dbTotalTransactions,
      dbNewTechs,
      dbResignedTechs
    });

    return {
      totalTransactions,
      newTechs,
      resignedTechs,
      netChange
    };
  }, [filteredAllData, dbTotalTransactions, dbNewTechs, dbResignedTechs, selectedYears, selectedMonths, selectedWeeks, selectedDates, searchTerm, selectedCard]);

  // Paginate the filtered data
  const filteredData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAllData.slice(startIndex, endIndex);
  }, [filteredAllData, currentPage, itemsPerPage]);

  // Update total count based on filtered data
  const filteredTotalCount = filteredAllData.length;

  const totalPages = Math.ceil(filteredTotalCount / itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const exportToExcel = () => {
    try {
      console.log('📊 Exporting to Excel...', allData.length, 'rows');

      if (allData.length === 0) {
        alert('ไม่มีข้อมูลสำหรับ Export');
        return;
      }

      // Get all unique columns from data
      const allColumns = new Set<string>();
      allData.forEach(item => {
        Object.keys(item).forEach(key => {
          if (key !== 'id') { // Skip id column
            allColumns.add(key);
          }
        });
      });

      console.log('📋 Columns to export:', Array.from(allColumns));

      const exportData = allData.map((item, index) => {
        const row: any = { 'ลำดับ': index + 1 };

        // Add all columns dynamically
        allColumns.forEach(col => {
          row[col] = item[col] !== null && item[col] !== undefined ? String(item[col]) : '';
        });

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

      // Auto-adjust column widths
      const colWidths = [{ wch: 8 }]; // ลำดับ
      allColumns.forEach(() => {
        colWidths.push({ wch: 20 }); // Default width for all columns
      });
      ws['!cols'] = colWidths;

      const fileName = `Tech_Transaction_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      console.log('✅ Excel exported successfully:', fileName);
    } catch (err: any) {
      console.error('❌ Export error:', err);
      alert('เกิดข้อผิดพลาดในการ Export: ' + err.message);
    }
  };

  const columns = useMemo(() => {
    if (filteredData.length === 0) return [];
    // Hide these columns from display
    const hiddenColumns = [
      'id', 'NATIONAL ID', 'national_id', 'Year', 'Month', 'Week',
      'Register_Ref', 'register_ref', 'REGISTER_REF',
      'area', 'Area', 'AREA',
      'ctm', 'Ctm', 'CTM',
      'province', 'Province', 'PROVINCE'
    ];
    return Object.keys(filteredData[0]).filter(key => !hiddenColumns.includes(key));
  }, [filteredData]);

  // Prepare chart data (use filtered allData based on filter selections)
  const chartData = useMemo(() => {
    console.log('🎯 Preparing chart data...', {
      allDataLength: allData?.length,
      filters: { selectedYears, selectedMonths, selectedWeeks, selectedDates },
      selectedCard
    });

    if (!allData || allData.length === 0) {
      console.log('⚠️ No allData available');
      return [];
    }

    // First, filter allData based on filter selections
    let chartSourceData = allData;
    console.log('📊 Initial data:', chartSourceData.length);

    if (selectedYears.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedYears.includes(String(item.Year)));
      console.log('🔽 After Year filter:', chartSourceData.length);
    }
    if (selectedMonths.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedMonths.includes(String(item.Month)));
      console.log('🔽 After Month filter:', chartSourceData.length);
    }
    if (selectedWeeks.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedWeeks.includes(String(item.Week)));
      console.log('🔽 After Week filter:', chartSourceData.length);
    }
    if (selectedDates.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedDates.includes(String(item.Date)));
      console.log('🔽 After Date filter:', chartSourceData.length);
    }

    // Filter by selected card
    if (selectedCard === 'new') {
      chartSourceData = chartSourceData.filter(item => item.Register?.includes('างใหม่'));
      console.log('🔽 After card filter (ช่างใหม่):', chartSourceData.length);
    } else if (selectedCard === 'resigned') {
      chartSourceData = chartSourceData.filter(item => item.Register?.includes('ช่างลาออก') || item.Register?.toLowerCase().includes('blacklist'));
      console.log('🔽 After card filter (ช่างลาออก+Blacklist):', chartSourceData.length);
    }

    // Group by Date and count Register types
    const dateGroups: { [key: string]: { new: number; resigned: number } } = {};

    chartSourceData.forEach(item => {
      const date = item.Date || '';
      const register = item.Register || '';

      if (!dateGroups[date]) {
        dateGroups[date] = { new: 0, resigned: 0 };
      }

      // Count based on Register value
      if (register.includes('างใหม่')) {
        dateGroups[date].new += 1;
      } else if (register.includes('ช่างลาออก') || register.toLowerCase().includes('blacklist')) {
        dateGroups[date].resigned += 1;
      }
    });

    // Convert to array and sort by date
    const chartArray = Object.entries(dateGroups)
      .map(([date, counts]) => ({
        date,
        'ช่างใหม่': counts.new,
        'ช่างลาออก': counts.resigned
      }))
      .sort((a, b) => {
        // Sort by date (assuming format YYYY-MM-DD)
        return a.date.localeCompare(b.date);
      });

    // Show last 30 days only if no filters applied, otherwise show all filtered dates
    const isFiltered = selectedYears.length > 0 || selectedMonths.length > 0 || selectedWeeks.length > 0 || selectedDates.length > 0;
    const finalChartArray = isFiltered ? chartArray : chartArray.slice(-30);

    console.log('📈 Chart data prepared:', finalChartArray.length, 'dates', isFiltered ? '(filtered)' : '(last 30 days)');
    return finalChartArray;
  }, [allData, selectedYears, selectedMonths, selectedWeeks, selectedDates, selectedCard]);

  // Prepare monthly chart data
  const monthlyChartData = useMemo(() => {
    if (!allData || allData.length === 0) {
      return [];
    }

    // Filter data based on selections
    let chartSourceData = allData;

    if (selectedYears.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedYears.includes(String(item.Year)));
    }
    if (selectedMonths.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedMonths.includes(String(item.Month)));
    }
    if (selectedWeeks.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedWeeks.includes(String(item.Week)));
    }
    if (selectedDates.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedDates.includes(String(item.Date)));
    }

    // Filter by selected card
    if (selectedCard === 'new') {
      chartSourceData = chartSourceData.filter(item => item.Register?.includes('างใหม่'));
    } else if (selectedCard === 'resigned') {
      chartSourceData = chartSourceData.filter(item => item.Register?.includes('ช่างลาออก') || item.Register?.toLowerCase().includes('blacklist'));
    }

    // Group by Month and Year
    const monthGroups: { [key: string]: { new: number; resigned: number; year: string } } = {};

    chartSourceData.forEach(item => {
      const month = item.Month || '';
      const year = String(item.Year || '');
      const monthYearKey = `${month} ${year}`;
      const register = item.Register || '';

      if (!monthGroups[monthYearKey]) {
        monthGroups[monthYearKey] = { new: 0, resigned: 0, year };
      }

      if (register.includes('างใหม่')) {
        monthGroups[monthYearKey].new += 1;
      } else if (register.includes('ช่างลาออก') || register.toLowerCase().includes('blacklist')) {
        monthGroups[monthYearKey].resigned += 1;
      }
    });

    // Month order for sorting
    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Convert to array and sort by year then month order
    const chartArray = Object.entries(monthGroups)
      .map(([monthYear, counts]) => {
        const parts = monthYear.split(' ');
        const month = parts[0];
        const year = parts[1] || '';
        return {
          month: monthYear,
          monthOnly: month,
          year,
          'ช่างลาออก': counts.resigned,
          'ช่างใหม่': counts.new
        };
      })
      .sort((a, b) => {
        // Sort by year first, then by month
        if (a.year !== b.year) {
          return Number(a.year) - Number(b.year);
        }
        return monthOrder.indexOf(a.monthOnly) - monthOrder.indexOf(b.monthOnly);
      });

    console.log('📊 Monthly chart data prepared:', chartArray.length, 'months');
    return chartArray;
  }, [allData, selectedYears, selectedMonths, selectedWeeks, selectedDates, selectedCard]);

  // Prepare RSM chart data
  const rsmChartData = useMemo(() => {
    if (!allData || allData.length === 0) {
      return [];
    }

    // Filter data based on selections
    let chartSourceData = allData;

    if (selectedYears.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedYears.includes(String(item.Year)));
    }
    if (selectedMonths.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedMonths.includes(String(item.Month)));
    }
    if (selectedWeeks.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedWeeks.includes(String(item.Week)));
    }
    if (selectedDates.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedDates.includes(String(item.Date)));
    }

    // Filter by selected card
    if (selectedCard === 'new') {
      chartSourceData = chartSourceData.filter(item => item.Register?.includes('างใหม่'));
    } else if (selectedCard === 'resigned') {
      chartSourceData = chartSourceData.filter(item => item.Register?.includes('ช่างลาออก') || item.Register?.toLowerCase().includes('blacklist'));
    }

    // Group by RSM
    const rsmGroups: { [key: string]: { new: number; resigned: number } } = {};

    chartSourceData.forEach(item => {
      const rsm = item.rsm || 'N/A';
      const register = item.Register || '';

      if (!rsmGroups[rsm]) {
        rsmGroups[rsm] = { new: 0, resigned: 0 };
      }

      if (register.includes('างใหม่')) {
        rsmGroups[rsm].new += 1;
      } else if (register.includes('ช่างลาออก') || register.toLowerCase().includes('blacklist')) {
        rsmGroups[rsm].resigned += 1;
      }
    });

    // Convert to array and sort by RSM name
    const chartArray = Object.entries(rsmGroups)
      .map(([rsm, counts]) => ({
        rsm,
        'ช่างลาออก': counts.resigned,
        'ช่างใหม่': counts.new
      }))
      .sort((a, b) => a.rsm.localeCompare(b.rsm));

    console.log('📊 RSM chart data prepared:', chartArray.length, 'RSMs');
    return chartArray;
  }, [allData, selectedYears, selectedMonths, selectedWeeks, selectedDates, selectedCard]);

  // Prepare Top 10 Depot - New Technicians
  const top10NewDepots = useMemo(() => {
    if (!allData || allData.length === 0) {
      return [];
    }

    // Filter data based on selections (use depot-specific filters if set, otherwise use main filters)
    let chartSourceData = allData;

    // Use depot years filter if selected, otherwise use main years filter
    const yearsToFilter = selectedDepotYears.length > 0 ? selectedDepotYears : selectedYears;
    if (yearsToFilter.length > 0) {
      chartSourceData = chartSourceData.filter(item => yearsToFilter.includes(String(item.Year)));
    }

    // Use depot months filter if selected, otherwise use main months filter
    const monthsToFilter = selectedDepotMonths.length > 0 ? selectedDepotMonths : selectedMonths;
    if (monthsToFilter.length > 0) {
      chartSourceData = chartSourceData.filter(item => monthsToFilter.includes(String(item.Month)));
    }

    if (selectedWeeks.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedWeeks.includes(String(item.Week)));
    }
    if (selectedDates.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedDates.includes(String(item.Date)));
    }

    // Group by depot_name for new technicians
    const depotCounts: { [key: string]: number } = {};

    chartSourceData.forEach(item => {
      const depot = item.depot_name || 'N/A';
      const register = item.Register || '';

      if (register.includes('างใหม่')) {
        depotCounts[depot] = (depotCounts[depot] || 0) + 1;
      }
    });

    // Convert to array, sort by count descending, and take top 10
    const topDepots = Object.entries(depotCounts)
      .map(([depot, count]) => ({ depot, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    console.log('📊 Top 10 New Depots prepared:', topDepots.length);
    return topDepots;
  }, [allData, selectedYears, selectedMonths, selectedWeeks, selectedDates, selectedDepotMonths, selectedDepotYears]);

  // Prepare Top 10 Depot - Resigned Technicians
  const top10ResignedDepots = useMemo(() => {
    if (!allData || allData.length === 0) {
      return [];
    }

    // Filter data based on selections (use depot-specific filters if set, otherwise use main filters)
    let chartSourceData = allData;

    // Use depot years filter if selected, otherwise use main years filter
    const yearsToFilter = selectedDepotYears.length > 0 ? selectedDepotYears : selectedYears;
    if (yearsToFilter.length > 0) {
      chartSourceData = chartSourceData.filter(item => yearsToFilter.includes(String(item.Year)));
    }

    // Use depot months filter if selected, otherwise use main months filter
    const monthsToFilter = selectedDepotMonths.length > 0 ? selectedDepotMonths : selectedMonths;
    if (monthsToFilter.length > 0) {
      chartSourceData = chartSourceData.filter(item => monthsToFilter.includes(String(item.Month)));
    }

    if (selectedWeeks.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedWeeks.includes(String(item.Week)));
    }
    if (selectedDates.length > 0) {
      chartSourceData = chartSourceData.filter(item => selectedDates.includes(String(item.Date)));
    }

    // Group by depot_name for resigned technicians
    const depotCounts: { [key: string]: number } = {};

    chartSourceData.forEach(item => {
      const depot = item.depot_name || 'N/A';
      const register = item.Register || '';

      if (register.includes('ช่างลาออก') || register.toLowerCase().includes('blacklist')) {
        depotCounts[depot] = (depotCounts[depot] || 0) + 1;
      }
    });

    // Convert to array, sort by count descending, and take top 10
    const topDepots = Object.entries(depotCounts)
      .map(([depot, count]) => ({ depot, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    console.log('📊 Top 10 Resigned Depots prepared:', topDepots.length);
    return topDepots;
  }, [allData, selectedYears, selectedMonths, selectedWeeks, selectedDates, selectedDepotMonths, selectedDepotYears]);

  // Prepare Pivot Table Data (RSM x Provider x Work Type)
  const pivotTableData = useMemo(() => {
    if (!allData || allData.length === 0) {
      return null;
    }

    // Filter data based on selections
    let sourceData = allData;

    if (selectedYears.length > 0) {
      sourceData = sourceData.filter(item => selectedYears.includes(String(item.Year)));
    }
    if (selectedMonths.length > 0) {
      sourceData = sourceData.filter(item => selectedMonths.includes(String(item.Month)));
    }
    if (selectedWeeks.length > 0) {
      sourceData = sourceData.filter(item => selectedWeeks.includes(String(item.Week)));
    }
    if (selectedDates.length > 0) {
      sourceData = sourceData.filter(item => selectedDates.includes(String(item.Date)));
    }

    // Filter by selected card
    if (selectedCard === 'new') {
      sourceData = sourceData.filter(item => item.Register?.includes('างใหม่') || (item.Register?.includes('ช่า') && item.Register?.includes('ใหม่')));
    } else if (selectedCard === 'resigned') {
      sourceData = sourceData.filter(item => item.Register?.includes('ช่างลาออก') || item.Register?.toLowerCase().includes('blacklist'));
    }

    // Create nested structure: RSM -> Provider -> WorkType -> {new, resigned}
    const pivotData: { [rsm: string]: { [provider: string]: { [workType: string]: { new: number; resigned: number } } } } = {};

    sourceData.forEach(item => {
      const rsm = item.rsm || 'N/A';
      const provider = item.provider || 'N/A';
      const workType = item.work_type || 'N/A';
      const register = item.Register || '';

      if (!pivotData[rsm]) pivotData[rsm] = {};
      if (!pivotData[rsm][provider]) pivotData[rsm][provider] = {};
      if (!pivotData[rsm][provider][workType]) {
        pivotData[rsm][provider][workType] = { new: 0, resigned: 0 };
      }

      // Check for both normal and encoding-issue patterns for "ช่างใหม่"
      if (register.includes('างใหม่') || (register.includes('ช่า') && register.includes('ใหม่'))) {
        pivotData[rsm][provider][workType].new += 1;
      } else if (register.includes('ช่างลาออก') || register.toLowerCase().includes('blacklist')) {
        pivotData[rsm][provider][workType].resigned += 1;
      }
    });

    console.log('📊 Pivot table data prepared');
    return pivotData;
  }, [allData, selectedYears, selectedMonths, selectedWeeks, selectedDates, selectedCard]);

  if (loading && currentPage === 1) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '16px' }}>⏳ กำลังโหลดข้อมูล...</div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '24px',
        margin: '24px',
        backgroundColor: '#fee2e2',
        border: '1px solid #ef4444',
        borderRadius: '8px',
        color: '#991b1b'
      }}>
        <strong>❌ เกิดข้อผิดพลาด:</strong> {error}
      </div>
    );
  }

  return (
    <div style={{
      padding: '32px',
      maxWidth: '100%',
      margin: '0 auto',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '24px'
        }}>
          Tech-Transaction (2025) : update ทุกวันเวลา 8.00 น.
        </h1>


        {/* Statistics Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Card 0: จำนวน Transaction */}
          <div style={{
            background: 'linear-gradient(135deg, #056D8D 0%, #044d63 100%)',
            borderRadius: '12px',
            padding: '24px',
            color: 'white',
            boxShadow: '0 8px 15px rgba(5, 109, 141, 0.3)',
            cursor: 'pointer',
            transform: 'translateY(0)',
            transition: 'all 0.3s ease',
            opacity: 1,
          }}
            onClick={() => setSelectedCard('all')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 15px 25px rgba(5, 109, 141, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 15px rgba(5, 109, 141, 0.3)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 5px 10px rgba(5, 109, 141, 0.2)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = selectedCard === 'all' ? '0 0 0 3px #3b82f6, 0 15px 25px rgba(5, 109, 141, 0.4)' : '0 15px 25px rgba(5, 109, 141, 0.4)';
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '12px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                opacity: 0.9
              }}>
                จำนวน(คน)
              </div>
              <div style={{
                fontSize: '42px',
                fontWeight: 'bold'
              }}>
                {statistics.totalTransactions.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Card 1: ช่างใหม่ */}
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: '12px',
            padding: '24px',
            color: 'white',
            boxShadow: selectedCard === 'new' ? '0 0 0 3px #3b82f6' : '0 8px 15px rgba(16, 185, 129, 0.3)',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            transform: 'translateY(0)',
            transition: 'all 0.3s ease',
            opacity: selectedCard === 'all' || selectedCard === 'new' ? 1 : 0.6,
          }}
            onClick={() => setSelectedCard(selectedCard === 'new' ? 'all' : 'new')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = selectedCard === 'new' ? '0 0 0 3px #3b82f6, 0 15px 25px rgba(16, 185, 129, 0.4)' : '0 15px 25px rgba(16, 185, 129, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = selectedCard === 'new' ? '0 0 0 3px #3b82f6' : '0 8px 15px rgba(16, 185, 129, 0.3)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 5px 10px rgba(16, 185, 129, 0.2)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = selectedCard === 'new' ? '0 0 0 3px #3b82f6, 0 15px 25px rgba(16, 185, 129, 0.4)' : '0 15px 25px rgba(16, 185, 129, 0.4)';
            }}
          >
            {/* Background Area Chart */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '100%',
              opacity: 0.3
            }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="colorNewTechs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="ช่างใหม่"
                    stroke="#ffffff"
                    strokeWidth={2}
                    fill="url(#colorNewTechs)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Content on top */}
            <div style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'baseline',
              gap: '12px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                opacity: 0.9
              }}>
                ช่างใหม่
              </div>
              <div style={{
                fontSize: '42px',
                fontWeight: 'bold'
              }}>
                {statistics.newTechs.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Card 2: ช่างลาออก */}
          <div style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            borderRadius: '12px',
            padding: '24px',
            color: 'white',
            boxShadow: selectedCard === 'resigned' ? '0 0 0 3px #3b82f6' : '0 8px 15px rgba(239, 68, 68, 0.3)',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            transform: 'translateY(0)',
            transition: 'all 0.3s ease',
            opacity: selectedCard === 'all' || selectedCard === 'resigned' ? 1 : 0.6,
          }}
            onClick={() => setSelectedCard(selectedCard === 'resigned' ? 'all' : 'resigned')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = selectedCard === 'resigned' ? '0 0 0 3px #3b82f6, 0 15px 25px rgba(239, 68, 68, 0.4)' : '0 15px 25px rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = selectedCard === 'resigned' ? '0 0 0 3px #3b82f6' : '0 8px 15px rgba(239, 68, 68, 0.3)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 5px 10px rgba(239, 68, 68, 0.2)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = selectedCard === 'resigned' ? '0 0 0 3px #3b82f6, 0 15px 25px rgba(239, 68, 68, 0.4)' : '0 15px 25px rgba(239, 68, 68, 0.4)';
            }}
          >
            {/* Background Area Chart */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '100%',
              opacity: 0.3
            }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="colorResignedTechs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="ช่างลาออก"
                    stroke="#ffffff"
                    strokeWidth={2}
                    fill="url(#colorResignedTechs)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Content on top */}
            <div style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'baseline',
              gap: '12px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                opacity: 0.9
              }}>
                ช่างลาออก
              </div>
              <div style={{
                fontSize: '42px',
                fontWeight: 'bold'
              }}>
                {statistics.resignedTechs.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Card 3: การเปลี่ยนแปลงสุทธิ */}
          <div style={{
            background: statistics.netChange >= 0
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            borderRadius: '12px',
            padding: '24px',
            color: 'white',
            boxShadow: selectedCard === 'net'
              ? '0 0 0 3px #3b82f6'
              : (statistics.netChange >= 0
                ? '0 8px 15px rgba(16, 185, 129, 0.3)'
                : '0 8px 15px rgba(239, 68, 68, 0.3)'),
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            transform: 'translateY(0)',
            transition: 'all 0.3s ease',
            opacity: selectedCard === 'all' || selectedCard === 'net' ? 1 : 0.6,
          }}
            onClick={() => setSelectedCard(selectedCard === 'net' ? 'all' : 'net')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = selectedCard === 'net'
                ? (statistics.netChange >= 0
                  ? '0 0 0 3px #3b82f6, 0 15px 25px rgba(16, 185, 129, 0.4)'
                  : '0 0 0 3px #3b82f6, 0 15px 25px rgba(239, 68, 68, 0.4)')
                : (statistics.netChange >= 0
                  ? '0 15px 25px rgba(16, 185, 129, 0.4)'
                  : '0 15px 25px rgba(239, 68, 68, 0.4)');
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = selectedCard === 'net'
                ? '0 0 0 3px #3b82f6'
                : (statistics.netChange >= 0
                  ? '0 8px 15px rgba(16, 185, 129, 0.3)'
                  : '0 8px 15px rgba(239, 68, 68, 0.3)');
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = statistics.netChange >= 0
                ? '0 5px 10px rgba(16, 185, 129, 0.2)'
                : '0 5px 10px rgba(239, 68, 68, 0.2)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = selectedCard === 'net'
                ? (statistics.netChange >= 0
                  ? '0 0 0 3px #3b82f6, 0 15px 25px rgba(16, 185, 129, 0.4)'
                  : '0 0 0 3px #3b82f6, 0 15px 25px rgba(239, 68, 68, 0.4)')
                : (statistics.netChange >= 0
                  ? '0 15px 25px rgba(16, 185, 129, 0.4)'
                  : '0 15px 25px rgba(239, 68, 68, 0.4)');
            }}
          >
            {/* Background Area Chart */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '100%',
              opacity: 0.3
            }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyChartData.map(item => ({
                    month: item.month,
                    net: item['ช่างใหม่'] - item['ช่างลาออก']
                  }))}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="colorNetChange" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="#ffffff"
                    strokeWidth={2}
                    fill="url(#colorNetChange)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Content on top */}
            <div style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'baseline',
              gap: '12px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                opacity: 0.9
              }}>
                สุทธิ
              </div>
              <div style={{
                fontSize: '42px',
                fontWeight: 'bold'
              }}>
                {statistics.netChange >= 0 ? '+' : ''}{statistics.netChange.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Card Selection Indicator */}
        {selectedCard !== 'all' && (
          <div style={{
            backgroundColor: '#eff6ff',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            border: '1px solid #3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '18px' }}>🔍</span>
              <span style={{ color: '#1e40af', fontWeight: '500' }}>
                กำลังแสดงข้อมูล: {
                  selectedCard === 'new' ? 'ช่างใหม่' :
                    selectedCard === 'resigned' ? 'ช่างลาออก' :
                      'สุทธิ'
                }
              </span>
            </div>
            <button
              onClick={() => setSelectedCard('all')}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ล้างการเลือก
            </button>
          </div>
        )}

        {/* Filter Section */}
        <div style={{
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '12px',
            margin: '0 0 12px 0'
          }}>
            🔍 ตัวกรองข้อมูล
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '40px',
            marginBottom: '16px'
          }}>
            {/* Year Filter */}
            <div className="dropdown-container" style={{ position: 'relative' }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                display: 'block',
                marginBottom: '4px'
              }}>
                ปี (Year)
              </label>
              <div
                onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{
                  color: selectedYears.length > 0 ? '#000' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>📅</span>
                  <span>
                    {selectedYears.length > 0
                      ? `${selectedYears.length} selected`
                      : 'ทั้งหมด'}
                  </span>
                </span>
                <span style={{ fontSize: '12px' }}>▼</span>
              </div>

              {yearDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    padding: '8px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '8px',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'white'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedYears(filterOptions.years);
                      }}
                      style={{
                        fontSize: '11px',
                        color: '#3b82f6',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedYears([]);
                      }}
                      style={{
                        fontSize: '11px',
                        color: '#ef4444',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                  {filterOptions.years.map(year => (
                    <label key={year} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedYears.includes(year)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedYears([...selectedYears, year]);
                          } else {
                            setSelectedYears(selectedYears.filter(y => y !== year));
                          }
                          autoCloseDropdown(() => setYearDropdownOpen(false));
                        }}
                        style={{ marginRight: '8px', cursor: 'pointer' }}
                      />
                      {year}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Month Filter */}
            <div className="dropdown-container" style={{ position: 'relative' }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                display: 'block',
                marginBottom: '4px'
              }}>
                เดือน (Month)
              </label>
              <div
                onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{
                  color: selectedMonths.length > 0 ? '#000' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>📅</span>
                  <span>
                    {selectedMonths.length > 0
                      ? `${selectedMonths.length} selected`
                      : 'ทั้งหมด'}
                  </span>
                </span>
                <span style={{ fontSize: '12px' }}>▼</span>
              </div>

              {monthDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    padding: '8px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '8px',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'white'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMonths(filterOptions.months);
                      }}
                      style={{
                        fontSize: '11px',
                        color: '#3b82f6',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMonths([]);
                      }}
                      style={{
                        fontSize: '11px',
                        color: '#ef4444',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                  {filterOptions.months.map(month => (
                    <label key={month} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMonths.includes(month)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedMonths([...selectedMonths, month]);
                          } else {
                            setSelectedMonths(selectedMonths.filter(m => m !== month));
                          }
                          autoCloseDropdown(() => setMonthDropdownOpen(false));
                        }}
                        style={{ marginRight: '8px', cursor: 'pointer' }}
                      />
                      {month}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Week Filter */}
            <div className="dropdown-container" style={{ position: 'relative' }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                display: 'block',
                marginBottom: '4px'
              }}>
                สัปดาห์ (Week)
              </label>
              <div
                onClick={() => setWeekDropdownOpen(!weekDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{
                  color: selectedWeeks.length > 0 ? '#000' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>📅</span>
                  <span>
                    {selectedWeeks.length > 0
                      ? `${selectedWeeks.length} selected`
                      : 'ทั้งหมด'}
                  </span>
                </span>
                <span style={{ fontSize: '12px' }}>▼</span>
              </div>

              {weekDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    padding: '8px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '8px',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'white'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWeeks(filterOptions.weeks);
                      }}
                      style={{
                        fontSize: '11px',
                        color: '#3b82f6',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWeeks([]);
                      }}
                      style={{
                        fontSize: '11px',
                        color: '#ef4444',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                  {filterOptions.weeks.map(week => (
                    <label key={week} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedWeeks.includes(week)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedWeeks([...selectedWeeks, week]);
                          } else {
                            setSelectedWeeks(selectedWeeks.filter(w => w !== week));
                          }
                          autoCloseDropdown(() => setWeekDropdownOpen(false));
                        }}
                        style={{ marginRight: '8px', cursor: 'pointer' }}
                      />
                      สัปดาห์ที่ {week}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Date Filter */}
            <div className="dropdown-container" style={{ position: 'relative' }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                display: 'block',
                marginBottom: '4px'
              }}>
                วันที่ (Date)
              </label>
              <div
                onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{
                  color: selectedDates.length > 0 ? '#000' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>📅</span>
                  <span>
                    {selectedDates.length > 0
                      ? `${selectedDates.length} selected`
                      : 'ทั้งหมด'}
                  </span>
                </span>
                <span style={{ fontSize: '12px' }}>▼</span>
              </div>

              {dateDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    padding: '8px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '8px',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'white'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDates(filterOptions.dates);
                      }}
                      style={{
                        fontSize: '11px',
                        color: '#3b82f6',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDates([]);
                      }}
                      style={{
                        fontSize: '11px',
                        color: '#ef4444',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px'
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                  {filterOptions.dates.map(date => (
                    <label key={date} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDates.includes(date)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedDates([...selectedDates, date]);
                          } else {
                            setSelectedDates(selectedDates.filter(d => d !== date));
                          }
                          autoCloseDropdown(() => setDateDropdownOpen(false));
                        }}
                        style={{ marginRight: '8px', cursor: 'pointer' }}
                      />
                      {date}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Clear Filters Button */}
          <button
            onClick={() => {
              setSelectedYears([]);
              setSelectedMonths([]);
              setSelectedWeeks([]);
              setSelectedDates([]);
              setSearchTerm('');
            }}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#6b7280',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.borderColor = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            🗑️ ล้างตัวกรอง
          </button>
        </div>

        {/* Charts Section - Side by Side */}
        {chartData.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '24px',
            marginBottom: '32px'
          }}>
            {/* Daily Line Chart */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '4px'
                }}>
                  ช่างใหม่ vs ช่างลาออก รายวัน
                </h2>
                <p style={{
                  fontSize: '12px',
                  color: '#1e3a8a',
                  margin: 0
                }}>
                  (แสดงข้อมูล 30 วัน ล่าสุด)
                </p>
              </div>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart
                  data={chartData}
                  margin={{ top: 160, right: 30, left: 20, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    style={{ fontSize: '11px' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    domain={[0, 'auto']}
                    ticks={[0, 5, 10, 15, 20]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '12px'
                    }}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: '20px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ช่างใหม่"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 2 }}
                    activeDot={{ r: 4 }}
                    label={{
                      position: 'top',
                      fill: '#10b981',
                      fontSize: 11,
                      formatter: (value: any) => (value && value > 0) ? value : ''
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ช่างลาออก"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', r: 2 }}
                    activeDot={{ r: 4 }}
                    label={{
                      position: 'top',
                      fill: '#ef4444',
                      fontSize: 11,
                      formatter: (value: any) => (value && value > 0) ? value : ''
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Bar Chart */}
            {monthlyChartData.length > 0 && (
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #e5e7eb'
              }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  ช่างใหม่ vs ช่างลาออก รายเดือน
                </h2>
                <ResponsiveContainer width="100%" height={500}>
                  <ComposedChart
                    data={monthlyChartData.map(item => ({
                      name: `${item.monthOnly?.substring(0, 3) || item.month.substring(0, 3)} ${item.year?.slice(-2) || ''}`.trim(),
                      month: item.month,
                      newTech: item['ช่างใหม่'],
                      resignation: item['ช่างลาออก'],
                      netChange: item['ช่างใหม่'] - item['ช่างลาออก']
                    }))}
                    margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" tick={false} />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div style={{
                              backgroundColor: 'rgba(0,0,0,0.8)',
                              backdropFilter: 'blur(8px)',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                              <p style={{ color: 'white', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                                {data.month}
                              </p>
                              <p style={{ color: '#10b981', fontSize: '12px', margin: '2px 0' }}>
                                ช่างใหม่: {data.newTech}
                              </p>
                              <p style={{ color: '#ef4444', fontSize: '12px', margin: '2px 0' }}>
                                ช่างลาออก: {data.resignation}
                              </p>
                              <p style={{
                                color: data.netChange >= 0 ? '#10b981' : '#ef4444',
                                fontSize: '12px',
                                fontWeight: 600,
                                marginTop: '4px'
                              }}>
                                Net: {data.netChange > 0 ? '+' : ''}{data.netChange}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />

                    <Bar
                      yAxisId="left"
                      dataKey="newTech"
                      fill="#10b981"
                      radius={[8, 8, 0, 0]}
                      name="ช่างใหม่"
                      label={{
                        position: 'top',
                        fill: '#10b981',
                        fontSize: 12,
                        fontWeight: 'bold'
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="resignation"
                      fill="#ef4444"
                      radius={[8, 8, 0, 0]}
                      name="ช่างลาออก"
                      label={{
                        position: 'top',
                        fill: '#ef4444',
                        fontSize: 12,
                        fontWeight: 'bold'
                      }}
                    />

                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="netChange"
                      stroke="#a855f7"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                      name="Net Change"
                      label={(props: any) => {
                        const { x, y, value, index } = props;
                        const data = monthlyChartData[index];
                        if (!data) return null;

                        const netChange = data['ช่างใหม่'] - data['ช่างลาออก'];
                        const color = netChange >= 0 ? '#10b981' : '#ef4444';

                        return (
                          <g>
                            <text
                              x={x}
                              y={y - 35}
                              textAnchor="middle"
                              fill="#a855f7"
                              fontSize={12}
                              fontWeight="bold"
                            >
                              {value > 0 ? '+' : ''}{value}
                            </text>
                            {netChange > 0 ? (
                              <polygon
                                points={`${x},${y - 5} ${x + 5},${y + 5} ${x - 5},${y + 5}`}
                                fill={color}
                              />
                            ) : netChange < 0 ? (
                              <polygon
                                points={`${x},${y + 5} ${x + 5},${y - 5} ${x - 5},${y - 5}`}
                                fill={color}
                              />
                            ) : (
                              <circle cx={x} cy={y} r={3} fill="#a855f7" />
                            )}
                          </g>
                        );
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Monthly Technician Comparison Chart (Total vs Resigned) + Provider Pie Chart */}
        {(() => {
          // ข้อมูลจำนวนช่างทั้งหมดแต่ละเดือน (hard-coded สำหรับเดือนก่อนหน้า, real-time สำหรับเดือนปัจจุบัน)
          const monthlyTechnicianData = [
            { month: 'January 2025', total: 2632 },
            { month: 'February 2025', total: 2660 },
            { month: 'March 2025', total: 2704 },
            { month: 'April 2025', total: 2679 },
            { month: 'May 2025', total: 3154 },
            { month: 'June 2025', total: 3147 },
            { month: 'July 2025', total: 2987 },
            { month: 'August 2025', total: 2971 },
            { month: 'September 2025', total: 2932 },
            { month: 'October 2025', total: 2938 },
            { month: 'November 2025', total: 2963 },
            { month: 'December 2025', total: 2896 },
            { month: 'January 2026', total: 2944 },
            { month: 'February 2026', total: 2950 },
            { month: 'March 2026', total: currentTechnicianCount } // real-time จากตาราง technicians
          ];

          // คำนวณจำนวนช่างลาออกจาก monthlyChartData
          const resignedByMonth = monthlyChartData.reduce((acc: any, item: any) => {
            acc[item.month] = item['ช่างลาออก'] || 0;
            return acc;
          }, {});

          // รวมข้อมูลและคำนวณ %
          const comparisonData = monthlyTechnicianData.map(item => {
            const resigned = resignedByMonth[item.month] || 0;
            const resignedPercent = item.total > 0 ? ((resigned / item.total) * 100).toFixed(1) : '0';

            return {
              month: item.month,
              'ช่างทั้งหมด': item.total,
              'ช่างลาออก': resigned,
              resignedPercent: resignedPercent
            };
          });

          // คำนวณข้อมูล Pie Chart สำหรับช่างลาออกแยกตาม Provider (ถึง December)
          const monthsToInclude = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

          // ใช้ filteredAllData เพื่อแสดงข้อมูลทั้งหมดที่ผ่าน filter (ไม่ใช่แค่หน้าปัจจุบัน)
          const dataForPieChart = (selectedYears.length > 0 || selectedMonths.length > 0 || selectedWeeks.length > 0 || selectedDates.length > 0 || searchTerm)
            ? filteredAllData
            : allData;

          const providerResignedData = dataForPieChart
            .filter((item: any) => {
              // กรองเฉพาะ Register = "ช่างลาออก" หรือ "Blacklist"
              const register = String(item.Register || '');
              if (!register.includes('ช่างลาออก') && !register.toLowerCase().includes('blacklist')) return false;

              // กรองเฉพาะเดือนถึง September
              if (item.Month && !monthsToInclude.includes(item.Month)) return false;

              // กรอง Provider ที่ต้องการ
              const provider = item.provider || item.Provider || '';
              return provider === 'WW-Provider' || provider === 'truetech' || provider === 'เถ้าแก่เทค';
            })
            .reduce((acc: any, item: any) => {
              const provider = item.provider || item.Provider || 'Unknown';
              acc[provider] = (acc[provider] || 0) + 1;
              return acc;
            }, {});

          const totalResigned = Object.values(providerResignedData).reduce((sum: number, count: any) => sum + count, 0);

          const pieData = Object.entries(providerResignedData).map(([provider, count]: [string, any]) => ({
            name: provider,
            value: count,
            percent: totalResigned > 0 ? ((count / totalResigned) * 100).toFixed(1) : '0'
          }));

          const COLORS = {
            'WW-Provider': '#3b82f6',
            'truetech': '#8b5cf6',
            'เถ้าแก่เทค': '#f59e0b'
          };

          return comparisonData.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '32px'
            }}>
              {/* Bar Chart */}
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '16px'
                }}>
                  จำนวนช่างทั้งหมด vs ช่างลาออก รายเดือน
                </h2>
                <ResponsiveContainer width="100%" height={450}>
                  <BarChart
                    data={comparisonData}
                    margin={{ top: 40, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '12px'
                      }}
                      formatter={(value: any, name: string, props: any) => {
                        if (name === 'ช่างลาออก') {
                          return [`${value.toLocaleString()} (${props.payload.resignedPercent}%)`, name];
                        }
                        return [value.toLocaleString(), name];
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        paddingTop: '20px'
                      }}
                    />
                    <Bar
                      dataKey="ช่างทั้งหมด"
                      fill="#10b981"
                      radius={[8, 8, 0, 0]}
                    >
                      <LabelList
                        dataKey="ช่างทั้งหมด"
                        position="top"
                        fill="#10b981"
                        fontSize={11}
                        fontWeight="600"
                        formatter={(value: any) => value.toLocaleString()}
                      />
                    </Bar>
                    <Bar
                      dataKey="ช่างลาออก"
                      fill="#ef4444"
                      radius={[8, 8, 0, 0]}
                    >
                      <LabelList
                        dataKey="ช่างลาออก"
                        position="center"
                        fill="white"
                        fontSize={11}
                        fontWeight="600"
                        content={(props: any) => {
                          const { x, y, width, value, index } = props;
                          const item = comparisonData[index];
                          if (!item || !value) return null;

                          return (
                            <text
                              x={x + width / 2}
                              y={y - 10}
                              fill="#ef4444"
                              fontSize={11}
                              fontWeight="600"
                              textAnchor="middle"
                            >
                              {`${value.toLocaleString()} (${item.resignedPercent}%)`}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart - Provider Resigned */}
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '16px'
                }}>
                  สัดส่วนช่างลาออกตาม Provider
                </h2>
                {pieData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.value} (${entry.percent}%)`}
                          outerRadius={120}
                          innerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                          paddingAngle={2}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#9ca3af'} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, name: string, props: any) => {
                            return [`${value.toLocaleString()} คน (${props.payload.percent}%)`, name];
                          }}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '12px'
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '80px 20px',
                    color: '#9ca3af',
                    fontSize: '15px'
                  }}>
                    ไม่มีข้อมูลช่างลาออกในช่วงที่เลือก
                  </div>
                )}
              </div>
            </div>
          ) : null;
        })()}

        {/* RSM Chart and Pivot Table - Side by Side */}
        {rsmChartData.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '32px'
          }}>
            {/* RSM Chart */}
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '16px'
              }}>
                ช่างใหม่ vs ช่างลาออก (RSM)
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={rsmChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="rsm"
                    stroke="#6b7280"
                    style={{ fontSize: '11px' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '12px'
                    }}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: '20px'
                    }}
                  />
                  <Bar
                    dataKey="ช่างลาออก"
                    fill="#dc2626"
                    label={{
                      position: 'top',
                      fill: '#dc2626',
                      fontSize: 11,
                      formatter: (value: any) => (value && value > 0) ? value : ''
                    }}
                  />
                  <Bar
                    dataKey="ช่างใหม่"
                    fill="#059669"
                    label={{
                      position: 'top',
                      fill: '#059669',
                      fontSize: 11,
                      formatter: (value: any) => (value && value > 0) ? value : ''
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pivot Table */}
            {pivotTableData && (
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                maxHeight: '500px',
                overflow: 'auto'
              }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '16px'
                }}>
                  สรุปข้อมูล RSM x Provider
                </h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '10px',
                    backgroundColor: 'white',
                    fontFamily: 'Arial, sans-serif'
                  }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr>
                        <th rowSpan={2} style={{
                          padding: '4px 2px',
                          border: '1px solid #2c5aa0',
                          fontWeight: 'bold',
                          backgroundColor: '#4472C4',
                          color: 'white',
                          textAlign: 'center',
                          fontSize: '10px',
                          lineHeight: '1.2'
                        }}>RSM</th>
                        <th rowSpan={2} style={{
                          padding: '4px 2px',
                          border: '1px solid #2c5aa0',
                          fontWeight: 'bold',
                          backgroundColor: '#4472C4',
                          color: 'white',
                          textAlign: 'center',
                          fontSize: '10px',
                          lineHeight: '1.2'
                        }}>Grand Total</th>
                        <th colSpan={2} style={{
                          padding: '4px 2px',
                          border: '1px solid #2c5aa0',
                          fontWeight: 'bold',
                          backgroundColor: '#4472C4',
                          color: 'white',
                          textAlign: 'center',
                          fontSize: '10px',
                          lineHeight: '1.2'
                        }}>WW-Provider</th>
                        <th colSpan={2} style={{
                          padding: '4px 2px',
                          border: '1px solid #2c5aa0',
                          fontWeight: 'bold',
                          backgroundColor: '#4472C4',
                          color: 'white',
                          textAlign: 'center',
                          fontSize: '10px',
                          lineHeight: '1.2'
                        }}>truetech</th>
                        <th colSpan={2} style={{
                          padding: '4px 2px',
                          border: '1px solid #2c5aa0',
                          fontWeight: 'bold',
                          backgroundColor: '#4472C4',
                          color: 'white',
                          textAlign: 'center',
                          fontSize: '10px',
                          lineHeight: '1.2'
                        }}>เถ้าแก่เทค</th>
                      </tr>
                      <tr>
                        <th style={{
                          padding: '4px 2px',
                          border: '1px solid #2c5aa0',
                          backgroundColor: '#4472C4',
                          color: 'white',
                          fontSize: '10px',
                          lineHeight: '1.2',
                          fontWeight: 'bold'
                        }}>ช่างใหม่</th>
                        <th style={{
                          padding: '4px 2px',
                          border: '1px solid #2c5aa0',
                          backgroundColor: '#4472C4',
                          color: 'white',
                          fontSize: '10px',
                          lineHeight: '1.2',
                          fontWeight: 'bold'
                        }}>ช่างลาออก</th>
                        <th style={{
                          padding: '4px 2px',
                          border: '1px solid #2c5aa0',
                          backgroundColor: '#4472C4',
                          color: 'white',
                          fontSize: '10px',
                          lineHeight: '1.2',
                          fontWeight: 'bold'
                        }}>ช่างใหม่</th>
                        <th style={{
                          padding: '4px 2px',
                          border: '1px solid #2c5aa0',
                          backgroundColor: '#4472C4',
                          color: 'white',
                          fontSize: '10px',
                          lineHeight: '1.2',
                          fontWeight: 'bold'
                        }}>ช่างลาออก</th>
                        <th style={{
                          padding: '4px 2px',
                          border: '1px solid #2c5aa0',
                          backgroundColor: '#4472C4',
                          color: 'white',
                          fontSize: '10px',
                          lineHeight: '1.2',
                          fontWeight: 'bold'
                        }}>ช่างใหม่</th>
                        <th style={{
                          padding: '4px 2px',
                          border: '1px solid #2c5aa0',
                          backgroundColor: '#4472C4',
                          color: 'white',
                          fontSize: '10px',
                          lineHeight: '1.2',
                          fontWeight: 'bold'
                        }}>ช่างลาออก</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Grand Total Row */}
                      <tr style={{ backgroundColor: '#f9fafb', fontWeight: 'bold' }}>
                        <td style={{
                          padding: '2px 3px',
                          border: '1px solid #d1d5db',
                          fontSize: '10px',
                          lineHeight: '1.2'
                        }}>Grand Total</td>
                        <td style={{
                          padding: '2px 3px',
                          border: '1px solid #d1d5db',
                          textAlign: 'right',
                          fontSize: '10px',
                          lineHeight: '1.2'
                        }}>
                          {(() => {
                            const netTotal = Object.values(pivotTableData).reduce((sum, providers) =>
                              sum + Object.values(providers).reduce((pSum, workTypes) =>
                                pSum + Object.values(workTypes).reduce((wSum, counts) =>
                                  wSum + counts.new - counts.resigned, 0), 0), 0);
                            return (
                              <span style={{ color: netTotal < 0 ? '#dc2626' : 'inherit' }}>
                                {netTotal}
                              </span>
                            );
                          })()}
                        </td>
                        {['WW-Provider', 'truetech', 'เถ้าแก่เทค'].map(provider => {
                          let newTotal = 0, resignedTotal = 0;
                          Object.values(pivotTableData).forEach(providers => {
                            if (providers[provider]) {
                              Object.values(providers[provider]).forEach(counts => {
                                newTotal += counts.new;
                                resignedTotal += counts.resigned;
                              });
                            }
                          });
                          return (
                            <>
                              <td key={`${provider}-new`} style={{
                                padding: '2px 3px',
                                border: '1px solid #d1d5db',
                                textAlign: 'right',
                                fontSize: '10px',
                                lineHeight: '1.2'
                              }}>
                                <span style={{ color: newTotal < 0 ? '#dc2626' : 'inherit' }}>
                                  {newTotal || ''}
                                </span>
                              </td>
                              <td key={`${provider}-resigned`} style={{
                                padding: '2px 3px',
                                border: '1px solid #d1d5db',
                                textAlign: 'right',
                                fontSize: '10px',
                                lineHeight: '1.2',
                                color: '#dc2626'
                              }}>
                                {resignedTotal ? `-${resignedTotal}` : ''}
                              </td>
                            </>
                          );
                        })}
                      </tr>

                      {/* RSM Rows */}
                      {Object.keys(pivotTableData).sort().map(rsm => {
                        const providers = pivotTableData[rsm];
                        let rsmTotal = 0;
                        Object.values(providers).forEach(workTypes => {
                          Object.values(workTypes).forEach(counts => {
                            rsmTotal += counts.new - counts.resigned;
                          });
                        });

                        return (
                          <tr key={rsm}>
                            <td style={{
                              padding: '2px 3px',
                              border: '1px solid #d1d5db',
                              fontSize: '10px',
                              lineHeight: '1.2'
                            }}>{rsm}</td>
                            <td style={{
                              padding: '2px 3px',
                              border: '1px solid #d1d5db',
                              textAlign: 'right',
                              fontSize: '10px',
                              lineHeight: '1.2'
                            }}>
                              <span style={{ color: rsmTotal < 0 ? '#dc2626' : 'inherit' }}>
                                {rsmTotal}
                              </span>
                            </td>
                            {['WW-Provider', 'truetech', 'เถ้าแก่เทค'].map(provider => {
                              let newCount = 0, resignedCount = 0;
                              if (providers[provider]) {
                                Object.values(providers[provider]).forEach(counts => {
                                  newCount += counts.new;
                                  resignedCount += counts.resigned;
                                });
                              }
                              return (
                                <>
                                  <td key={`${rsm}-${provider}-new`} style={{
                                    padding: '2px 3px',
                                    border: '1px solid #d1d5db',
                                    textAlign: 'right',
                                    fontSize: '10px',
                                    lineHeight: '1.2'
                                  }}>
                                    <span style={{ color: newCount < 0 ? '#dc2626' : 'inherit' }}>
                                      {newCount || ''}
                                    </span>
                                  </td>
                                  <td key={`${rsm}-${provider}-resigned`} style={{
                                    padding: '2px 3px',
                                    border: '1px solid #d1d5db',
                                    textAlign: 'right',
                                    fontSize: '10px',
                                    lineHeight: '1.2',
                                    color: '#dc2626'
                                  }}>
                                    {resignedCount ? `-${resignedCount}` : ''}
                                  </td>
                                </>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Top 10 Depot Tables - Side by Side */}
        {(top10NewDepots.length > 0 || top10ResignedDepots.length > 0) && (
          <div>
            {/* Year and Month Filter for Top 10 Depot */}
            <div style={{
              backgroundColor: '#203864',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px',
                margin: '0 0 12px 0'
              }}>
                Ranking : จำนวน<span style={{ color: '#10b981' }}>ช่างใหม่</span>/<span style={{ color: '#ef4444' }}>ช่างลาออก</span> รายเดือน
              </h3>

              {/* Year Filter */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '6px' }}>
                  📅 เลือกปี
                </div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  {['2025', '2026'].map(year => (
                    <button
                      key={year}
                      onClick={() => {
                        if (selectedDepotYears.includes(year)) {
                          setSelectedDepotYears(selectedDepotYears.filter(y => y !== year));
                        } else {
                          setSelectedDepotYears([...selectedDepotYears, year]);
                        }
                      }}
                      style={{
                        padding: '8px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        backgroundColor: selectedDepotYears.includes(year) ? '#10b981' : 'rgba(255,255,255,0.2)',
                        color: selectedDepotYears.includes(year) ? 'white' : 'white'
                      }}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>

              {/* Month Filter */}
              <div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '6px' }}>
                  📆 เลือกเดือน
                </div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                    <button
                      key={month}
                      onClick={() => {
                        if (selectedDepotMonths.includes(month)) {
                          setSelectedDepotMonths(selectedDepotMonths.filter(m => m !== month));
                        } else {
                          setSelectedDepotMonths([...selectedDepotMonths, month]);
                        }
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        backgroundColor: selectedDepotMonths.includes(month) ? '#ffffff' : 'rgba(255,255,255,0.2)',
                        color: selectedDepotMonths.includes(month) ? '#203864' : 'white'
                      }}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear Button */}
              {(selectedDepotMonths.length > 0 || selectedDepotYears.length > 0) && (
                <button
                  onClick={() => {
                    setSelectedDepotMonths([]);
                    setSelectedDepotYears([]);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    color: 'white',
                    marginTop: '12px'
                  }}
                >
                  ล้างการเลือก
                  {selectedDepotYears.length > 0 && ` (${selectedDepotYears.length} ปี)`}
                  {selectedDepotMonths.length > 0 && ` (${selectedDepotMonths.length} เดือน)`}
                </button>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: '24px',
              marginBottom: '32px'
            }}>
              {/* Top 10 Depot - New Technicians */}
              {top10NewDepots.length > 0 && (
                <div style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '12px',
                  padding: '10px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '4px',
                      height: '20px',
                      backgroundColor: '#059669',
                      borderRadius: '2px'
                    }}></span>
                    Top 10 Depot - ช่างใหม่
                  </h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f0fdf4' }}>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#059669',
                            borderBottom: '2px solid #059669',
                            width: '60px'
                          }}>
                            อันดับ
                          </th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#059669',
                            borderBottom: '2px solid #059669'
                          }}>
                            Depot Name
                          </th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#059669',
                            borderBottom: '2px solid #059669',
                            width: '100px'
                          }}>
                            จำนวน
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {top10NewDepots.map((item, index) => (
                          <tr key={index} style={{
                            borderBottom: '1px solid #e5e7eb',
                            transition: 'background-color 0.2s'
                          }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{
                              padding: '12px 16px',
                              textAlign: 'center',
                              fontWeight: '600',
                              color: index < 3 ? '#059669' : '#6b7280'
                            }}>
                              {index === 0 && '🥇'}
                              {index === 1 && '🥈'}
                              {index === 2 && '🥉'}
                              {index > 2 && (index + 1)}
                            </td>
                            <td style={{
                              padding: '12px 16px',
                              color: '#374151'
                            }}>
                              {item.depot}
                            </td>
                            <td style={{
                              padding: '12px 16px',
                              textAlign: 'center',
                              fontWeight: '600',
                              color: '#059669',
                              fontSize: '16px'
                            }}>
                              {item.count.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top 10 Depot - Resigned Technicians */}
              {top10ResignedDepots.length > 0 && (
                <div style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '12px',
                  padding: '10px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '4px',
                      height: '20px',
                      backgroundColor: '#dc2626',
                      borderRadius: '2px'
                    }}></span>
                    Top 10 Depot - ช่างลาออก
                  </h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fef2f2' }}>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#dc2626',
                            borderBottom: '2px solid #dc2626',
                            width: '60px'
                          }}>
                            อันดับ
                          </th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontWeight: '600',
                            color: '#dc2626',
                            borderBottom: '2px solid #dc2626'
                          }}>
                            Depot Name
                          </th>
                          <th style={{
                            padding: '12px 16px',
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#dc2626',
                            borderBottom: '2px solid #dc2626',
                            width: '100px'
                          }}>
                            จำนวน
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {top10ResignedDepots.map((item, index) => (
                          <tr key={index} style={{
                            borderBottom: '1px solid #e5e7eb',
                            transition: 'background-color 0.2s'
                          }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{
                              padding: '12px 16px',
                              textAlign: 'center',
                              fontWeight: '600',
                              color: index < 3 ? '#dc2626' : '#6b7280'
                            }}>
                              {index === 0 && '🥇'}
                              {index === 1 && '🥈'}
                              {index === 2 && '🥉'}
                              {index > 2 && (index + 1)}
                            </td>
                            <td style={{
                              padding: '12px 16px',
                              color: '#374151'
                            }}>
                              {item.depot}
                            </td>
                            <td style={{
                              padding: '12px 16px',
                              textAlign: 'center',
                              fontWeight: '600',
                              color: '#dc2626',
                              fontSize: '16px'
                            }}>
                              {item.count.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '24px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            placeholder="🔍 ค้นหา Provider, Register, Month..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: '300px',
              padding: '12px 16px',
              fontSize: '16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />

          <button
            onClick={exportToExcel}
            disabled={allData.length === 0}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: allData.length === 0 ? '#9ca3af' : '#10b981',
              border: 'none',
              borderRadius: '8px',
              cursor: allData.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (allData.length > 0) {
                e.currentTarget.style.backgroundColor = '#059669';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (allData.length > 0) {
                e.currentTarget.style.backgroundColor = '#10b981';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            📥 Export to Excel
          </button>
        </div>

        <div style={{
          fontSize: '14px',
          color: '#6b7280',
          marginBottom: '16px'
        }}>
          แสดง {filteredData.length} รายการ จากทั้งหมด {filteredTotalCount.toLocaleString()} รายการ
          {(selectedYears.length > 0 || selectedMonths.length > 0 || selectedWeeks.length > 0 || selectedDates.length > 0 || searchTerm) &&
            ` (${(selectedYears.length > 0 || selectedMonths.length > 0 || selectedWeeks.length > 0 || selectedDates.length > 0) ? 'กรองตาม Filter' : ''}${searchTerm ? ` ค้นหา "${searchTerm}"` : ''})`
          }
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{
                  padding: '16px',
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#374151',
                  borderBottom: '2px solid #e5e7eb',
                  position: 'sticky',
                  top: 0,
                  backgroundColor: '#f3f4f6',
                  zIndex: 10
                }}>
                  ลำดับ
                </th>
                {columns.map((col) => (
                  <th key={col} style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    borderBottom: '2px solid #e5e7eb',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#f3f4f6',
                    zIndex: 10
                  }}>
                    {col.replace(/_/g, ' ').toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{
                    padding: '48px',
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: '16px'
                  }}>
                    {searchTerm ? '🔍 ไม่พบข้อมูลที่ค้นหา' : '📭 ไม่มีข้อมูล'}
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.id || index} style={{
                    borderBottom: '1px solid #e5e7eb',
                    transition: 'background-color 0.2s'
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <td style={{ padding: '16px', color: '#6b7280' }}>
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </td>
                    {columns.map((col) => (
                      <td key={col} style={{
                        padding: '16px',
                        color: '#374151',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item[col] !== null && item[col] !== undefined
                          ? String(item[col])
                          : '-'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{
            marginTop: '32px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: currentPage === 1 ? '#9ca3af' : '#374151',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              « แรก
            </button>

            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: currentPage === 1 ? '#9ca3af' : '#374151',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ‹ ก่อนหน้า
            </button>

            <span style={{
              padding: '8px 16px',
              fontSize: '14px',
              color: '#374151',
              fontWeight: '500'
            }}>
              หน้า {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: currentPage === totalPages ? '#9ca3af' : '#374151',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ถัดไป ›
            </button>

            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: currentPage === totalPages ? '#9ca3af' : '#374151',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              สุดท้าย »
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function TechTransactionPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'manager']}>
      <SidebarLayout>
        <TechTransactionContent />
      </SidebarLayout>
    </ProtectedRoute>
  );
}

// Add CSS animations for notifications (Tech-Transaction)
if (typeof window !== 'undefined' && !document.getElementById('transaction-notification-styles')) {
  const style = document.createElement('style');
  style.id = 'transaction-notification-styles';
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

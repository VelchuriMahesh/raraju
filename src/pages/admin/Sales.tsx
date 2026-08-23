import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  FileDown,
  Printer,
  Search,
  Store as StoreIcon,
  Download,
  Calendar,
  Loader2,
  X,
  Ban,
  AlertTriangle,
  Trash2,
  TrendingUp,
  Clock,
  RefreshCw,
  Sparkles,
  DollarSign,
  ShoppingBag,
  CreditCard,
  QrCode,
  Wallet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { Sale } from '../../types/sale';
import { Store } from '../../types/store';
import { getSales, subscribeToSales, cancelSale, deleteSale } from '../../services/saleService';
import { getStores, subscribeToStores } from '../../services/storeService';
import { generateInvoicePDF } from '../../services/pdfService';
import { exportToCSV } from '../../services/reportService';

type TimeRange = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM';

const isDateToday = (dStr?: string): boolean => {
  if (!dStr) return false;
  const d = new Date(dStr);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

const isDateThisWeek = (dStr?: string): boolean => {
  if (!dStr) return false;
  const d = new Date(dStr);
  const now = new Date();
  const firstDay = new Date(now);
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  firstDay.setDate(diff);
  firstDay.setHours(0, 0, 0, 0);

  const endDay = new Date(firstDay);
  endDay.setDate(firstDay.getDate() + 6);
  endDay.setHours(23, 59, 59, 999);

  return d >= firstDay && d <= endDay;
};

const isDateThisMonth = (dStr?: string): boolean => {
  if (!dStr) return false;
  const d = new Date(dStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

export const Sales: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const { language } = useLanguage();

  const [sales, setSales] = useState<Sale[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<TimeRange>('TODAY');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Cancel / Void Modal State
  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Customer returned goods / Billing mistake');
  const [restoreStock, setRestoreStock] = useState<boolean>(true);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Permanent Delete Modal State
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    const unsubSales = subscribeToSales((liveSales) => {
      setSales(liveSales);
      setLoading(false);
      setLastSyncTime(new Date());
    });

    const unsubStores = subscribeToStores((liveStores) => {
      setStores(liveStores);
    });

    return () => {
      unsubSales();
      unsubStores();
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const fresh = await getSales();
      setSales(fresh);
      setLastSyncTime(new Date());
      success('Real-time sales synchronized successfully.');
    } catch (err: any) {
      error('Sync failed: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadPDF = (sale: Sale, format: 'a4' | 'thermal') => {
    try {
      const doc = generateInvoicePDF(sale, null, null, format);
      doc.save(`${sale.invoiceNumber}_${format}.pdf`);
      success(`Downloaded ${sale.invoiceNumber} (${format.toUpperCase()}).`);
    } catch (err: any) {
      error('Failed to generate PDF: ' + err.message);
    }
  };

  const handleExportCSV = () => {
    const exportData = filteredSales.map((s) => ({
      InvoiceNumber: s.invoiceNumber,
      Store: s.storeName,
      Cashier: s.employeeName,
      CustomerName: s.customer?.name || 'Walk-in',
      CustomerPhone: s.customer?.phone || '',
      ItemCount: s.itemCount,
      PaymentMethod: s.paymentMethod,
      ExtraAmount: s.extraAmount || 0,
      GrandTotal: s.grandTotal,
      Status: s.status,
      CreatedAt: s.createdAt
    }));

    exportToCSV(`Sales_${timeRange}_${new Date().toISOString().split('T')[0]}`, exportData);
    success('Sales report exported to CSV.');
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingSale || !currentUser) return;

    setIsCancelling(true);
    try {
      await cancelSale(cancellingSale.id, cancelReason.trim(), currentUser, restoreStock);
      success(`Invoice #${cancellingSale.invoiceNumber} has been voided/cancelled.`);
      setCancellingSale(null);
      setCancelReason('Customer returned goods / Billing mistake');
    } catch (err: any) {
      error('Failed to cancel invoice: ' + err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingSale || !currentUser) return;

    setIsDeleting(true);
    try {
      await deleteSale(deletingSale.id, currentUser, restoreStockOnDelete);
      success(`Invoice #${deletingSale.invoiceNumber} permanently deleted.`);
      setDeletingSale(null);
    } catch (err: any) {
      error('Failed to delete invoice: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Real-Time Aggregate Metrics
  const stats = useMemo(() => {
    const completed = sales.filter((s) => s.status === 'COMPLETED');

    const todayList = completed.filter((s) => isDateToday(s.createdAt));
    const todayRev = todayList.reduce((sum, s) => sum + s.grandTotal, 0);

    const weekList = completed.filter((s) => isDateThisWeek(s.createdAt));
    const weekRev = weekList.reduce((sum, s) => sum + s.grandTotal, 0);

    const monthList = completed.filter((s) => isDateThisMonth(s.createdAt));
    const monthRev = monthList.reduce((sum, s) => sum + s.grandTotal, 0);

    return {
      todayRev,
      todayCount: todayList.length,
      weekRev,
      weekCount: weekList.length,
      monthRev,
      monthCount: monthList.length,
      allRev: completed.reduce((sum, s) => sum + s.grandTotal, 0),
      allCount: completed.length
    };
  }, [sales]);

  // Filtered Sales according to active TimeRange, Store, and Search
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      // 1. Store Filter
      const matchesStore =
        storeFilter === 'ALL' ||
        s.storeId === storeFilter ||
        stores.find((st) => st.id === storeFilter)?.name === s.storeName;
      if (!matchesStore) return false;

      // 2. Time Range Filter
      if (timeRange === 'TODAY') {
        if (!isDateToday(s.createdAt)) return false;
      } else if (timeRange === 'WEEK') {
        if (!isDateThisWeek(s.createdAt)) return false;
      } else if (timeRange === 'MONTH') {
        if (!isDateThisMonth(s.createdAt)) return false;
      } else if (timeRange === 'CUSTOM') {
        if (customStartDate && s.createdAt < `${customStartDate}T00:00:00`) return false;
        if (customEndDate && s.createdAt > `${customEndDate}T23:59:59`) return false;
      }

      // 3. Search Query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesSearch =
          s.invoiceNumber.toLowerCase().includes(q) ||
          s.storeName.toLowerCase().includes(q) ||
          (s.customer?.name && s.customer.name.toLowerCase().includes(q)) ||
          (s.customer?.phone && s.customer.phone.includes(q)) ||
          s.employeeName.toLowerCase().includes(q) ||
          s.items?.some((it) => it.productName.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [sales, storeFilter, timeRange, customStartDate, customEndDate, searchQuery, stores]);

  const currentTotalRevenue = useMemo(() => {
    return filteredSales
      .filter((s) => s.status === 'COMPLETED')
      .reduce((sum, s) => sum + s.grandTotal, 0);
  }, [filteredSales]);

  // Payment Breakdown for active filter
  const paymentBreakdown = useMemo(() => {
    const res: { [key: string]: number } = { CASH: 0, UPI: 0, CARD: 0, CREDIT: 0, SPLIT: 0 };
    filteredSales
      .filter((s) => s.status === 'COMPLETED')
      .forEach((s) => {
        const m = s.paymentMethod || 'CASH';
        res[m] = (res[m] || 0) + s.grandTotal;
      });
    return res;
  }, [filteredSales]);

  return (
    <div className="space-y-6">
      {/* Top Header Banner with Live Pulse */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-6 h-6 text-indigo-600" />
              <span>{language === 'te' ? 'అమ్మకాలు & ఇన్వాయిస్‌లు (రియల్ టైమ్)' : 'Sales & Invoices (Real-Time)'}</span>
            </h1>

            {/* Real-time Streaming Pulse Indicator */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black rounded-full shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>LIVE REAL-TIME</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>
              {language === 'te'
                ? 'స్టోర్లలో జరిగిన బిల్లుల ప్రత్యక్ష లైవ్ లెక్కలు (ఈ రోజు, వారం, నెల)'
                : 'Live transactions from store POS terminals with today, weekly, and monthly tracking'}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              • Auto-synced at {lastSyncTime.toLocaleTimeString()}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200 transition-colors shadow-sm"
            title="Force refresh live database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Live'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/20 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{language === 'te' ? 'CSV డౌన్‌లోడ్' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Real-Time KPI Metric Cards (Today, Week, Month, Selected Period) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Card */}
        <button
          onClick={() => setTimeRange('TODAY')}
          className={`p-5 rounded-3xl border transition-all text-left relative overflow-hidden group ${
            timeRange === 'TODAY'
              ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-indigo-600 shadow-lg shadow-indigo-600/20 scale-[1.02]'
              : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-900 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                timeRange === 'TODAY' ? 'text-indigo-100' : 'text-slate-500'
              }`}
            >
              {language === 'te' ? 'ఈ రోజు అమ్మకాలు' : "Today's Sales"}
            </span>
            <span
              className={`p-2 rounded-2xl ${
                timeRange === 'TODAY' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black font-mono mt-2">₹{stats.todayRev.toFixed(2)}</p>
          <div
            className={`flex items-center justify-between text-[11px] font-bold mt-1 ${
              timeRange === 'TODAY' ? 'text-indigo-100' : 'text-slate-500'
            }`}
          >
            <span>{stats.todayCount} Bills Completed</span>
            <span className="font-semibold text-[10px]">Real-Time Active</span>
          </div>
        </button>

        {/* This Week Card */}
        <button
          onClick={() => setTimeRange('WEEK')}
          className={`p-5 rounded-3xl border transition-all text-left relative overflow-hidden group ${
            timeRange === 'WEEK'
              ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-indigo-600 shadow-lg shadow-indigo-600/20 scale-[1.02]'
              : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-900 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                timeRange === 'WEEK' ? 'text-indigo-100' : 'text-slate-500'
              }`}
            >
              {language === 'te' ? 'ఈ వారం అమ్మకాలు' : 'This Week Sales'}
            </span>
            <span
              className={`p-2 rounded-2xl ${
                timeRange === 'WEEK' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black font-mono mt-2">₹{stats.weekRev.toFixed(2)}</p>
          <div
            className={`flex items-center justify-between text-[11px] font-bold mt-1 ${
              timeRange === 'WEEK' ? 'text-indigo-100' : 'text-slate-500'
            }`}
          >
            <span>{stats.weekCount} Bills Completed</span>
            <span className="font-semibold text-[10px]">Mon - Sun</span>
          </div>
        </button>

        {/* This Month Card */}
        <button
          onClick={() => setTimeRange('MONTH')}
          className={`p-5 rounded-3xl border transition-all text-left relative overflow-hidden group ${
            timeRange === 'MONTH'
              ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-indigo-600 shadow-lg shadow-indigo-600/20 scale-[1.02]'
              : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-900 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                timeRange === 'MONTH' ? 'text-indigo-100' : 'text-slate-500'
              }`}
            >
              {language === 'te' ? 'ఈ నెల అమ్మకాలు' : 'This Month Sales'}
            </span>
            <span
              className={`p-2 rounded-2xl ${
                timeRange === 'MONTH' ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-600'
              }`}
            >
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black font-mono mt-2">₹{stats.monthRev.toFixed(2)}</p>
          <div
            className={`flex items-center justify-between text-[11px] font-bold mt-1 ${
              timeRange === 'MONTH' ? 'text-indigo-100' : 'text-slate-500'
            }`}
          >
            <span>{stats.monthCount} Bills Completed</span>
            <span className="font-semibold text-[10px]">Monthly Cycle</span>
          </div>
        </button>

        {/* Active Filter Revenue Summary */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {timeRange === 'TODAY'
                  ? "Today's Ledger"
                  : timeRange === 'WEEK'
                  ? 'Weekly Ledger'
                  : timeRange === 'MONTH'
                  ? 'Monthly Ledger'
                  : 'Total Filtered'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                {filteredSales.length} Total Bills
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 font-mono mt-2">
              ₹{currentTotalRevenue.toFixed(2)}
            </p>
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-1">
            Avg Bill: ₹{filteredSales.length ? (currentTotalRevenue / filteredSales.length).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>

      {/* Time Range Selector & Search & Store Filters Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Time Range Segmented Control */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              onClick={() => setTimeRange('TODAY')}
              className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap ${
                timeRange === 'TODAY'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {language === 'te' ? 'ఈ రోజు (Today)' : 'Today'}
            </button>

            <button
              onClick={() => setTimeRange('WEEK')}
              className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap ${
                timeRange === 'WEEK'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {language === 'te' ? 'ఈ వారం (Week)' : 'This Week'}
            </button>

            <button
              onClick={() => setTimeRange('MONTH')}
              className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap ${
                timeRange === 'MONTH'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {language === 'te' ? 'ఈ నెల (Month)' : 'This Month'}
            </button>

            <button
              onClick={() => setTimeRange('ALL')}
              className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap ${
                timeRange === 'ALL'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {language === 'te' ? 'మొత్తం (All Time)' : 'All Time'}
            </button>

            <button
              onClick={() => setTimeRange('CUSTOM')}
              className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap flex items-center gap-1 ${
                timeRange === 'CUSTOM'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{language === 'te' ? 'కస్టమ్ తేదీ' : 'Custom Dates'}</span>
            </button>
          </div>

          {/* Store Branch Filter */}
          <div className="flex items-center gap-2">
            <StoreIcon className="w-4 h-4 text-indigo-600" />
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="ALL">All Store Branches / అన్ని స్టోర్లు</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Pickers (if CUSTOM is selected) */}
        {timeRange === 'CUSTOM' && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-700">Date Range:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Search & Payment Mode Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice number, customer name, phone, cashier, or product..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {/* Payment Method Totals */}
          <div className="flex items-center gap-2 overflow-x-auto text-[11px] font-bold">
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              Cash: ₹{paymentBreakdown.CASH.toFixed(0)}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              UPI: ₹{paymentBreakdown.UPI.toFixed(0)}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
              Card: ₹{paymentBreakdown.CARD.toFixed(0)}
            </span>
            {paymentBreakdown.CREDIT > 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
                Credit: ₹{paymentBreakdown.CREDIT.toFixed(0)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Real-Time Sales Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs font-bold text-slate-600">Streaming real-time sales ledger...</span>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6">
            <Receipt className="w-12 h-12 mb-2 text-slate-300 stroke-[1.5]" />
            <p className="text-sm font-bold text-slate-700">No sales transactions found for this period</p>
            <p className="text-xs text-slate-400 mt-1">
              Transactions processed at store POS terminals appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Store Branch</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Items Summary</th>
                  <th className="py-3.5 px-4">Extra Fee</th>
                  <th className="py-3.5 px-4 text-right">Grand Total</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    {/* Invoice Number */}
                    <td className="py-3.5 px-4 font-mono font-black text-indigo-700 text-xs">
                      {sale.invoiceNumber}
                    </td>

                    {/* Store Branch */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>
                        <span>{sale.storeName}</span>
                        <p className="text-[10px] text-slate-400 font-normal">Cashier: {sale.employeeName}</p>
                      </div>
                    </td>

                    {/* Date & Time */}
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                      <div>
                        <span>{new Date(sale.createdAt).toLocaleDateString('en-IN')}</span>
                        <p className="text-[10px] text-slate-400 font-normal">
                          {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {sale.customer?.name ? (
                        <div>
                          <p className="font-bold text-slate-900">{sale.customer.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{sale.customer.phone || ''}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-normal">Walk-in</span>
                      )}
                    </td>

                    {/* Items Summary */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5 max-w-[220px]">
                        {sale.items && sale.items.length > 0 ? (
                          sale.items.map((it, idx) => (
                            <p key={idx} className="text-[11px] text-slate-800 truncate">
                              <strong>{it.productName}</strong> × {it.quantity} {it.unit}
                            </p>
                          ))
                        ) : (
                          <span className="text-slate-400">{sale.itemCount} items</span>
                        )}
                      </div>
                    </td>

                    {/* Extra Fee */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {sale.extraAmount && sale.extraAmount > 0 ? (
                        <span className="font-bold text-amber-700">+₹{sale.extraAmount}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Grand Total */}
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      ₹{sale.grandTotal.toFixed(2)}
                    </td>

                    {/* Payment Mode */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 font-bold text-[10px] text-slate-800">
                        {sale.paymentMethod}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          sale.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownloadPDF(sale, 'thermal')}
                          className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                          title="Print 80mm Thermal Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(sale, 'a4')}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Download A4 Tax Invoice PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                        {sale.status === 'COMPLETED' && (
                          <button
                            onClick={() => setCancellingSale(sale)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Cancel / Void Invoice"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingSale(sale)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Permanently Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel / Void Modal */}
      {cancellingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Cancel Invoice #{cancellingSale.invoiceNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {cancellingSale.storeName} • ₹{cancellingSale.grandTotal.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCancellingSale(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cancellation Reason (కారణం) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer returned goods / Wrong bill entry"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                <input
                  type="checkbox"
                  id="restoreStockCheck"
                  checked={restoreStock}
                  onChange={(e) => setRestoreStock(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="restoreStockCheck" className="text-slate-800 font-bold cursor-pointer">
                  Restore deducted items back to store stock (స్టాక్ తిరిగి చేర్చు)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingSale(null)}
                  disabled={isCancelling}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl shadow-lg shadow-amber-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Ban className="w-4 h-4" />
                  <span>{isCancelling ? 'Voiding...' : 'Confirm Void'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Permanently Delete Invoice #{deletingSale.invoiceNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {deletingSale.storeName} • ₹{deletingSale.grandTotal.toFixed(2)} ({deletingSale.paymentMethod})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeletingSale(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this sale record? This action cannot be undone.
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
              <input
                type="checkbox"
                id="restoreStockDeleteSalesCheck"
                checked={restoreStockOnDelete}
                onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <label htmlFor="restoreStockDeleteSalesCheck" className="text-slate-800 font-bold cursor-pointer">
                Restore sold items back to store stock (స్టాక్ తిరిగి చేర్చు)
              </label>
            </div>

            <form onSubmit={handleConfirmDelete} className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSale(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDeleting}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm Delete (శాశ్వతంగా తొలగించు)'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CalendarPlus,
  Store as StoreIcon,
  Package,
  Boxes,
  Check,
  Search,
  Calendar,
  FileSpreadsheet,
  Loader2,
  TrendingDown,
  Clock,
  Layers,
  Image as ImageIcon,
  Banknote,
  DollarSign,
  Receipt,
  Download
} from 'lucide-react';
import { Store } from '../../types/store';
import { Product } from '../../types/product';
import { DailyStockAssignment } from '../../types/stockAssignment';
import { getStores, subscribeToStores } from '../../services/storeService';
import { getProducts, subscribeToProducts } from '../../services/productService';
import {
  assignDailyStock,
  subscribeToDailyAssignments,
  getTodayDateString,
  normalizeDateString
} from '../../services/stockAssignmentService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useLanguage } from '../../context/LanguageContext';
import { exportToCSV } from '../../services/reportService';

export const StockAssignment: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const { language, t } = useLanguage();

  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [assignments, setAssignments] = useState<DailyStockAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form State for Assigning Stock
  const todayStr = getTodayDateString();
  const [assignmentDate, setAssignmentDate] = useState<string>(todayStr);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [stockInputs, setStockInputs] = useState<{ [productId: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // History Filter State
  const [historyDate, setHistoryDate] = useState<string>(todayStr);
  const [historyStoreFilter, setHistoryStoreFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const unsubStores = subscribeToStores((liveStores) => {
      setStores(liveStores);
      if (!selectedStoreId && liveStores.length > 0) {
        setSelectedStoreId(liveStores[0].id);
      }
    });

    const unsubProds = subscribeToProducts((liveProds) => {
      setProducts(liveProds);
      // Initialize inputs
      const initial: { [id: string]: string } = {};
      liveProds.forEach((p) => {
        initial[p.id] = '0';
      });
      setStockInputs((prev) => ({ ...initial, ...prev }));
      setLoading(false);
    });

    const unsubAssignments = subscribeToDailyAssignments((liveAssignments) => {
      setAssignments(liveAssignments);
    });

    return () => {
      unsubStores();
      unsubProds();
      unsubAssignments();
    };
  }, []);

  // Map product map for fast lookup of image and prices
  const productLookup = useMemo(() => {
    const map: { [id: string]: Product } = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  // Boxes the admin has typed into during the current store+date selection. They are
  // left alone when a live snapshot arrives; every other box keeps tracking the saved
  // quantity. Previously this effect re-ran on EVERY `assignments` snapshot and
  // rewrote all ten boxes, wiping numbers out from under the admin mid-entry.
  const dirtyInputs = useRef<Set<string>>(new Set());
  const inputsContextKey = useRef<string>('');

  useEffect(() => {
    if (!selectedStoreId || !assignmentDate || products.length === 0) return;
    const normSelectedDate = normalizeDateString(assignmentDate);

    // Switching branch or date starts a fresh entry sheet.
    const contextKey = `${selectedStoreId}|${normSelectedDate}`;
    if (inputsContextKey.current !== contextKey) {
      inputsContextKey.current = contextKey;
      dirtyInputs.current = new Set();
    }

    const existing = assignments.filter(
      (a) => a.storeId === selectedStoreId && normalizeDateString(a.date) === normSelectedDate
    );

    setStockInputs((prev) => {
      const updated: { [id: string]: string } = {};
      products.forEach((p) => {
        if (dirtyInputs.current.has(p.id)) {
          updated[p.id] = prev[p.id] ?? '0';
          return;
        }
        const found = existing.find((a) => a.productId === p.id || (a.sku && p.sku && a.sku === p.sku));
        updated[p.id] = found ? String(found.assignedQuantity) : '0';
      });
      return updated;
    });
  }, [selectedStoreId, assignmentDate, assignments, products]);

  const handleStockInputChange = (productId: string, val: string) => {
    dirtyInputs.current.add(productId);
    setStockInputs((prev) => ({
      ...prev,
      [productId]: val
    }));
  };

  const handleSaveAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedStoreId || isSubmitting) return;

    const targetStore = stores.find((s) => s.id === selectedStoreId);
    if (!targetStore) {
      error('Invalid store selection');
      return;
    }

    const normDate = normalizeDateString(assignmentDate);

    // GUARD 1 — never save from a half-initialised sheet. Until the boxes have been
    // populated for THIS store+date, every quantity still reads '0', and saving would
    // wipe the day's real assignments. A stray submit (Enter key, double-click, an HMR
    // reload landing on this page) previously did exactly that.
    if (loading || products.length === 0 || inputsContextKey.current !== `${selectedStoreId}|${normDate}`) {
      error('Stock sheet is still loading — please wait a moment and try again.');
      return;
    }

    const existingForContext = assignments.filter(
      (a) => a.storeId === targetStore.id && normalizeDateString(a.date) === normDate
    );

    // GUARD 2 — a save that reduces or clears assignments already dispatched today is
    // destructive, so make the admin confirm it rather than doing it silently.
    const reductions = existingForContext.filter((a) => {
      const prod = products.find((p) => p.id === a.productId);
      if (!prod) return false;
      const qty = parseInt(stockInputs[prod.id] || '0', 10);
      return !isNaN(qty) && qty < a.assignedQuantity;
    });

    if (reductions.length > 0) {
      const summary = reductions
        .map((a) => `${a.productName}: ${a.assignedQuantity} → ${parseInt(stockInputs[a.productId] || '0', 10)}`)
        .join(', ');
      const confirmed = await confirm({
        title: 'Reduce assigned stock?',
        message:
          `This will REDUCE stock already assigned to "${targetStore.name}" for ${normDate}:\n\n${summary}\n\n` +
          `The cashier will immediately see the lower quantity. Continue?`,
        confirmText: 'Yes, reduce',
        isDestructive: true
      });
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    let savedCount = 0;
    const failures: string[] = [];

    for (const prod of products) {
      const qty = parseInt(stockInputs[prod.id] || '0', 10);
      if (isNaN(qty) || qty < 0) continue;

      // GUARD 3 — assigned quantity can never drop below what the store has already
      // sold today; that would leave the ledger with more sold than ever dispatched.
      const existingRow = existingForContext.find((a) => a.productId === prod.id);
      if (existingRow && qty < (existingRow.soldQuantity || 0)) {
        failures.push(
          `${prod.name}: cannot assign ${qty} — ${existingRow.soldQuantity} bags have already been sold today.`
        );
        continue;
      }

      // Only write a row when there is something to record: a positive quantity, or an
      // existing assignment being corrected. Writing every product at 0 used to fill the
      // ledger with empty "0 Bags" rows.
      const hasExisting = assignments.some(
        (a) =>
          a.storeId === targetStore.id &&
          normalizeDateString(a.date) === normDate &&
          a.productId === prod.id
      );
      if (qty === 0 && !hasExisting) continue;

      try {
        await assignDailyStock(
          assignmentDate,
          targetStore.id,
          targetStore.name,
          targetStore.code,
          prod.id,
          prod.name,
          prod.sku,
          prod.unit,
          qty,
          currentUser
        );
        savedCount++;
      } catch (err: any) {
        failures.push(`${prod.name}: ${err.message}`);
      }
    }

    setIsSubmitting(false);

    if (failures.length > 0) {
      error(
        `${failures.length} product(s) FAILED to sync to the cloud and will NOT reach the store. ${failures[0]}`
      );
      return;
    }
    if (savedCount === 0) {
      error('Nothing to assign — enter at least one bag quantity above.');
      return;
    }
    // Saved values now come back from the live feed.
    dirtyInputs.current = new Set();
    success(
      `Assigned daily stock for ${savedCount} product(s) to "${targetStore.name}" on ${assignmentDate}.`
    );
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return assignments.filter((a) => {
      const matchesDate =
        !historyDate || normalizeDateString(a.date) === normalizeDateString(historyDate);
      const matchesStore = historyStoreFilter === 'ALL' || a.storeId === historyStoreFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.productName.toLowerCase().includes(q) ||
        a.storeName.toLowerCase().includes(q) ||
        a.sku.toLowerCase().includes(q);

      return matchesDate && matchesStore && matchesSearch;
    });
  }, [assignments, historyDate, historyStoreFilter, searchQuery]);

  // Aggregate comprehensive ledger totals for the filtered history
  const historyLedgerTotals = useMemo(() => {
    let totalAssignedBags = 0;
    let totalSoldBags = 0;
    let totalRemainingBags = 0;
    let totalAssignedValue = 0;
    let totalSoldRevenue = 0;
    let totalRemainingValue = 0;

    filteredHistory.forEach((h) => {
      const prod = productLookup[h.productId];
      const unitPrice = prod ? prod.standardPrice : 1500;

      totalAssignedBags += h.assignedQuantity;
      totalSoldBags += h.soldQuantity;
      totalRemainingBags += h.remainingQuantity;

      totalAssignedValue += h.assignedQuantity * unitPrice;
      totalSoldRevenue += h.soldQuantity * unitPrice;
      totalRemainingValue += h.remainingQuantity * unitPrice;
    });

    return {
      totalAssignedBags,
      totalSoldBags,
      totalRemainingBags,
      totalAssignedValue,
      totalSoldRevenue,
      totalRemainingValue,
      recordsCount: filteredHistory.length
    };
  }, [filteredHistory, productLookup]);

  const handleExportCSV = () => {
    const exportData = filteredHistory.map((h) => {
      const prod = productLookup[h.productId];
      const unitPrice = prod ? prod.standardPrice : 1500;

      return {
        Date: h.date,
        Store: `${h.storeName} (${h.storeCode})`,
        Product: h.productName,
        SKU: h.sku,
        Packaging: h.unit,
        PricePerBag: unitPrice,
        AssignedBags: h.assignedQuantity,
        AssignedTotalValue: h.assignedQuantity * unitPrice,
        SoldBags: h.soldQuantity,
        SoldRevenue: h.soldQuantity * unitPrice,
        RemainingBags: h.remainingQuantity,
        RemainingValue: h.remainingQuantity * unitPrice,
        AssignedBy: h.assignedByUserName,
        LastUpdated: h.updatedAt
      };
    });

    exportToCSV(`Daily_Stock_Assignments_Ledger_${historyDate || 'All'}`, exportData);
    success('Exported daily stock ledger to CSV');
  };

  if (loading && products.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-slate-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="text-xs font-bold text-slate-600">Loading daily stock system...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <CalendarPlus className="w-6 h-6 text-indigo-600" />
            <span>
              {language === 'te' ? 'రోజువారీ స్టాక్ కేటాయింపు & లెడ్జర్' : 'Daily Stock Assignment & Comprehensive Ledger'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'te'
              ? 'ప్రతి రోజు ప్రతి స్టోర్‌కు ఎన్ని సంచుల స్టాక్ పంపాలో నమోదు చేయండి మరియు అమ్మకాలు, మిగిలిన సంచుల పూర్తి లెక్కలను పరిశీలించండి'
              : 'Allocate daily bag quantities to each branch with product images, and audit total sent, sold, and remaining inventory values'}
          </p>
        </div>
      </div>

      {/* SECTION 1: Daily Stock Assignment Form with Product Images */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                {language === 'te' ? 'స్టోర్‌కు స్టాక్ కేటాయింపు చేయండి' : 'Assign Daily Stock to Store'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'te'
                  ? 'తేదీ మరియు స్టోర్ ఎంచుకుని ఉత్పత్తుల సంచుల సంఖ్యను నమోదు చేయండి'
                  : 'Select Date & Store, then specify assigned bags for each catalog product'}
              </p>
            </div>
          </div>

          {/* Date & Store Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <span className="font-bold text-slate-600 pl-1">Date:</span>
              <input
                type="date"
                value={assignmentDate}
                onChange={(e) => setAssignmentDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 shadow-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <span className="font-bold text-slate-600 pl-1">Store:</span>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 shadow-sm focus:outline-none focus:border-indigo-500"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Product Allocation Grid with Images */}
        <form onSubmit={handleSaveAssignments} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {products.map((prod) => (
              <div
                key={prod.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 hover:bg-slate-100/80 transition-colors"
              >
                {/* Thumbnail Image */}
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                  {prod.imageUrl ? (
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Package className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-sm text-slate-900 truncate">{prod.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 font-mono">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                      {prod.unit}
                    </span>
                    <span className="font-bold text-slate-700">₹{prod.standardPrice}</span>
                  </div>
                </div>

                {/* Quantity Input */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block">Bags (సంచులు)</span>
                    <input
                      type="number"
                      min="0"
                      value={stockInputs[prod.id] || '0'}
                      onChange={(e) => handleStockInputChange(prod.id, e.target.value)}
                      className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-mono font-black text-slate-900 text-center text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting || products.length === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isSubmitting ? 'Saving...' : 'Save & Assign Stock / స్టాక్ కేటాయించండి'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Daily Stock Assignment Ledger & History with Comprehensive Totals */}
      <div className="space-y-4">
        {/* Ledger Header & Filters */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Daily Stock Assignment Ledger & History / రోజువారీ స్టాక్ లెడ్జర్ & నివేదిక</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Total products sent, sold, and remaining in store with accurate valuation / మొత్తం పంపిన, అమ్మిన మరియు మిగిలిన స్టాక్ వివరాలు
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ledger CSV</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none"
              />
              {historyDate && (
                <button
                  onClick={() => setHistoryDate('')}
                  className="text-[10px] text-rose-600 font-bold hover:underline"
                >
                  All Dates
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <StoreIcon className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={historyStoreFilter}
                onChange={(e) => setHistoryStoreFilter(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none"
              >
                <option value="ALL">All Stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search product, SKU, store..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Comprehensive Financial & Volume KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Total Sent */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Total Sent / కేటాయించినవి
            </span>
            <p className="text-2xl font-black text-indigo-600 font-mono mt-1">
              {historyLedgerTotals.totalAssignedBags} <span className="text-xs text-slate-500 font-normal">Bags</span>
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Valuation: ₹{historyLedgerTotals.totalAssignedValue.toFixed(2)}
            </p>
          </div>

          {/* Total Sold */}
          <div className="p-4 rounded-3xl bg-emerald-50/70 border border-emerald-200 shadow-sm">
            <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
              Total Sold / అమ్మినవి
            </span>
            <p className="text-2xl font-black text-emerald-700 font-mono mt-1">
              {historyLedgerTotals.totalSoldBags} <span className="text-xs text-emerald-600 font-normal">Bags</span>
            </p>
            <p className="text-[10px] text-emerald-600 font-mono mt-0.5">
              Revenue: ₹{historyLedgerTotals.totalSoldRevenue.toFixed(2)}
            </p>
          </div>

          {/* Total Remaining */}
          <div className="p-4 rounded-3xl bg-amber-50/70 border border-amber-200 shadow-sm">
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">
              Remaining in Store / మిగిలినవి
            </span>
            <p className="text-2xl font-black text-amber-700 font-mono mt-1">
              {historyLedgerTotals.totalRemainingBags} <span className="text-xs text-amber-600 font-normal">Bags</span>
            </p>
            <p className="text-[10px] text-amber-600 font-mono mt-0.5">
              Stock Value: ₹{historyLedgerTotals.totalRemainingValue.toFixed(2)}
            </p>
          </div>

          {/* Total Value Sent */}
          <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Total Stock Value
            </span>
            <p className="text-xl font-black text-slate-900 font-mono mt-1">
              ₹{historyLedgerTotals.totalAssignedValue.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Total Dispatch Value</p>
          </div>

          {/* Total Realized Sales */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Realized Sales
            </span>
            <p className="text-xl font-black text-emerald-600 font-mono mt-1">
              ₹{historyLedgerTotals.totalSoldRevenue.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {historyLedgerTotals.totalAssignedBags > 0
                ? `${Math.round((historyLedgerTotals.totalSoldBags / historyLedgerTotals.totalAssignedBags) * 100)}% Cleared`
                : '0%'}
            </p>
          </div>
        </div>

        {/* Detailed Itemized Ledger Table with Images */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Store</th>
                  <th className="py-3 px-4 text-right">Price / Bag</th>
                  <th className="py-3 px-4 text-right">Assigned (పంపినవి)</th>
                  <th className="py-3 px-4 text-right">Total Value</th>
                  <th className="py-3 px-4 text-right">Sold (అమ్మినవి)</th>
                  <th className="py-3 px-4 text-right">Remaining (మిగిలినవి)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <CalendarPlus className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold">No daily stock assignments found for the selected filter</p>
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item) => {
                    const prod = productLookup[item.productId];
                    const unitPrice = prod ? prod.standardPrice : 1500;
                    const assignedVal = item.assignedQuantity * unitPrice;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {item.date}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                              {prod?.imageUrl ? (
                                <img
                                  src={prod.imageUrl}
                                  alt={item.productName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-extrabold text-sm text-slate-900">{item.productName}</p>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold">
                                  {item.unit}
                                </span>
                                <span>{item.sku}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {item.storeName}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                          ₹{unitPrice.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-indigo-600 text-sm">
                          {item.assignedQuantity} Bags
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{assignedVal.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 text-sm">
                          {item.soldQuantity} Bags
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-amber-600 text-sm">
                          {item.remainingQuantity} Bags
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              item.remainingQuantity === 0 && item.assignedQuantity > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.soldQuantity > 0
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.remainingQuantity === 0 && item.assignedQuantity > 0
                              ? 'Sold Out (పూర్తయింది)'
                              : item.soldQuantity > 0
                              ? 'Active (అమ్మకాలు జరుగుతున్నాయి)'
                              : 'Dispatched (పంపబడింది)'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

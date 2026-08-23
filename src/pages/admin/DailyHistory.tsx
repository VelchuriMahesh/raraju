import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  Store as StoreIcon,
  Banknote,
  QrCode,
  CreditCard,
  PlusCircle,
  Receipt,
  FileSpreadsheet,
  FileText,
  Search,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';
import { Sale } from '../../types/sale';
import { Store } from '../../types/store';
import { subscribeToSales, deleteSale } from '../../services/saleService';
import { subscribeToStores } from '../../services/storeService';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { generateInvoicePDF } from '../../services/pdfService';
import { exportToCSV } from '../../services/reportService';
import { getTodayDateString } from '../../services/stockAssignmentService';

export const DailyHistory: React.FC = () => {
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const { success, error } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const todayStr = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Delete modal state
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    const unsubSales = subscribeToSales((liveSales) => {
      setSales(liveSales);
      setLoading(false);
    });
    const unsubStores = subscribeToStores((liveStores) => {
      setStores(liveStores);
    });

    return () => {
      unsubSales();
      unsubStores();
    };
  }, []);

  // Filter sales for the selected date and store
  const filteredDailySales = useMemo(() => {
    return sales.filter((s) => {
      // 1. Date matching (supports YYYY-MM-DD format)
      const saleDate = s.createdAt ? s.createdAt.split('T')[0] : '';
      const matchesDate = !selectedDate || saleDate === selectedDate || s.createdAt.includes(selectedDate);

      // 2. Store matching
      const matchesStore =
        selectedStoreFilter === 'ALL' ||
        s.storeId === selectedStoreFilter ||
        (stores.find((st) => st.id === selectedStoreFilter)?.name === s.storeName);

      // 3. Search matching
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.storeName.toLowerCase().includes(q) ||
        (s.customer?.name && s.customer.name.toLowerCase().includes(q)) ||
        (s.customer?.phone && s.customer.phone.includes(q)) ||
        s.employeeName.toLowerCase().includes(q);

      return matchesDate && matchesStore && matchesSearch;
    });
  }, [sales, selectedDate, selectedStoreFilter, searchQuery, stores]);

  // Aggregate metrics for selected date
  const metrics = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let card = 0;
    let extra = 0;
    let grand = 0;
    let totalItems = 0;

    filteredDailySales.forEach((s) => {
      grand += s.grandTotal;
      totalItems += s.itemCount;
      extra += s.extraAmount || 0;

      if (s.paymentMethod === 'CASH') cash += s.grandTotal;
      else if (s.paymentMethod === 'UPI') upi += s.grandTotal;
      else if (s.paymentMethod === 'CARD') card += s.grandTotal;
      else if (s.paymentMethod === 'SPLIT' && s.splitPayments) {
        s.splitPayments.forEach((sp) => {
          if (sp.method === 'CASH') cash += sp.amount;
          else if (sp.method === 'UPI') upi += sp.amount;
          else if (sp.method === 'CARD') card += sp.amount;
        });
      }
    });

    return { cash, upi, card, extra, grand, totalItems, billsCount: filteredDailySales.length };
  }, [filteredDailySales]);

  // Store-wise breakdown for the selected date
  const storeSummaries = useMemo(() => {
    const relevantSales = sales.filter((s) => {
      const saleDate = s.createdAt ? s.createdAt.split('T')[0] : '';
      return !selectedDate || saleDate === selectedDate || s.createdAt.includes(selectedDate);
    });

    return stores.map((st) => {
      const stSales = relevantSales.filter(
        (s) =>
          s.storeId === st.id ||
          s.storeName.toLowerCase() === st.name.toLowerCase() ||
          (st.code && s.storeId.toLowerCase().includes(st.code.toLowerCase())) ||
          (stores.length === 1)
      );
      const total = stSales.reduce((sum, s) => sum + s.grandTotal, 0);
      const cash = stSales.reduce((sum, s) => sum + (s.paymentMethod === 'CASH' ? s.grandTotal : 0), 0);
      const upi = stSales.reduce((sum, s) => sum + (s.paymentMethod === 'UPI' ? s.grandTotal : 0), 0);
      return {
        store: st,
        bills: stSales.length,
        total,
        cash,
        upi
      };
    });
  }, [stores, sales, selectedDate]);

  const handleExportCSV = () => {
    const exportData = filteredDailySales.map((s) => ({
      Invoice: s.invoiceNumber,
      Date: s.createdAt.split('T')[0],
      Time: new Date(s.createdAt).toLocaleTimeString('en-IN'),
      Store: s.storeName,
      Cashier: s.employeeName,
      Items: s.itemCount,
      PaymentMethod: s.paymentMethod,
      ExtraAmount: s.extraAmount || 0,
      GrandTotal: s.grandTotal
    }));

    exportToCSV(`Daily_Sales_${selectedDate}`, exportData);
    success('Exported daily report to CSV');
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
      error('Failed to delete sale: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-indigo-600" />
            <span>
              {language === 'te' ? 'రోజువారీ అమ్మకాల చరిత్ర & లెక్క' : 'Daily Sales History & Ledger'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'te'
              ? 'ఏ రోజుకైనా నగదు, యూపీఐ మరియు బిల్లుల పూర్తి వివరాలు పరిశీలించండి లేదా రికార్డులను నిర్వహించండి'
              : 'Select any date to inspect day-by-day sales, cash/UPI collections, and store comparisons'}
          </p>
        </div>

        {/* Date Selector & Store Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 shadow-sm text-xs focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-colors ${
                selectedDate === todayStr
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Today
            </button>
          </div>

          {/* Store Filter */}
          <select
            value={selectedStoreFilter}
            onChange={(e) => setSelectedStoreFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Stores (అన్ని స్టోర్లు)</option>
            {stores.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.code})
              </option>
            ))}
          </select>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-2xl text-xs font-extrabold transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Selected Day KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Grand Total */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Day Total Sales
          </span>
          <p className="font-mono font-black text-slate-900 text-xl mt-1">₹{metrics.grand.toFixed(2)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{metrics.billsCount} Invoices</p>
        </div>

        {/* Cash Collected */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cash (నగదు)</span>
          </span>
          <p className="font-mono font-black text-emerald-700 text-xl mt-1">₹{metrics.cash.toFixed(2)}</p>
          <p className="text-[10px] text-emerald-600/80 mt-0.5">Direct Cash in Drawers</p>
        </div>

        {/* UPI Collected */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 shadow-sm">
          <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>UPI (యూపీఐ)</span>
          </span>
          <p className="font-mono font-black text-indigo-700 text-xl mt-1">₹{metrics.upi.toFixed(2)}</p>
          <p className="text-[10px] text-indigo-600/80 mt-0.5">Online Scanned</p>
        </div>

        {/* Card / Others */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
            <span>Card / Credit</span>
          </span>
          <p className="font-mono font-bold text-slate-800 text-xl mt-1">₹{metrics.card.toFixed(2)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">POS Swipe</p>
        </div>

        {/* Extra Amount */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-sm">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
            <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Extra Fees</span>
          </span>
          <p className="font-mono font-black text-amber-700 text-xl mt-1">+₹{metrics.extra.toFixed(2)}</p>
          <p className="text-[10px] text-amber-600/80 mt-0.5">Loading / Misc</p>
        </div>
      </div>

      {/* Store Wise Quick Summary for Selected Date */}
      {selectedStoreFilter === 'ALL' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {storeSummaries.map((ss) => (
            <div
              key={ss.store.id}
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-xs font-mono font-bold">
                    {ss.store.code}
                  </span>
                  <span className="font-extrabold text-sm text-slate-900">{ss.store.name}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  {ss.bills} bills • Cash: ₹{ss.cash.toFixed(2)} • UPI: ₹{ss.upi.toFixed(2)}
                </p>
              </div>
              <span className="font-mono font-black text-slate-900 text-base">
                ₹{ss.total.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Invoices List Table for Selected Date */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              {language === 'te' ? `${selectedDate} నాటి బిల్లుల జాబితా` : `Bills for ${selectedDate}`} ({filteredDailySales.length})
            </h3>
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice, store, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Store</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Extra Amount</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDailySales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <CalendarDays className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    <p className="font-bold">No sales recorded on {selectedDate}</p>
                  </td>
                </tr>
              ) : (
                filteredDailySales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {new Date(sale.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{sale.storeName}</td>
                    <td className="py-3 px-4 text-slate-600">{sale.employeeName}</td>
                    <td className="py-3 px-4 text-slate-600">{sale.customer?.name || 'Walk-in'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{sale.itemCount} Bags</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          sale.paymentMethod === 'CASH'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sale.paymentMethod === 'UPI'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                      {sale.extraAmount ? `+₹${sale.extraAmount.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      ₹{sale.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            const doc = generateInvoicePDF(sale, null, null, 'thermal');
                            doc.save(`${sale.invoiceNumber}_thermal.pdf`);
                            success(`Downloaded ${sale.invoiceNumber}`);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Download Receipt PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </button>

                        {/* Admin Delete Action */}
                        <button
                          onClick={() => setDeletingSale(sale)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Sale (శాశ్వతంగా తొలగించు)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Delete Invoice #{deletingSale.invoiceNumber}
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
              Are you sure you want to permanently delete this sale record? This action will remove the invoice from daily records and update the audit log.
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
              <input
                type="checkbox"
                id="restoreStockDeleteCheck"
                checked={restoreStockOnDelete}
                onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <label htmlFor="restoreStockDeleteCheck" className="text-slate-800 font-bold cursor-pointer">
                Restore sold items back to store stock (స్టాక్ తిరిగి స్టోర్‌కు చేర్చు)
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

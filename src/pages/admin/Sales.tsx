import React, { useState, useEffect } from 'react';
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
  CheckCircle2,
  Trash2
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

export const Sales: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const { language } = useLanguage();

  const [sales, setSales] = useState<Sale[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');

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
    });
    const unsubStores = subscribeToStores((liveStores) => {
      setStores(liveStores);
    });

    return () => {
      unsubSales();
      unsubStores();
    };
  }, []);

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

    exportToCSV(`Sales_Export_${new Date().toISOString().split('T')[0]}`, exportData);
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

  const filteredSales = sales.filter((s) => {
    const matchesStore =
      storeFilter === 'ALL' ||
      s.storeId === storeFilter ||
      (stores.find((st) => st.id === storeFilter)?.name === s.storeName);

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      s.invoiceNumber.toLowerCase().includes(q) ||
      s.storeName.toLowerCase().includes(q) ||
      (s.customer?.name && s.customer.name.toLowerCase().includes(q)) ||
      (s.customer?.phone && s.customer.phone.includes(q)) ||
      s.employeeName.toLowerCase().includes(q);

    return matchesStore && matchesSearch;
  });

  const totalRevenue = filteredSales
    .filter((s) => s.status === 'COMPLETED')
    .reduce((sum, s) => sum + s.grandTotal, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" />
            <span>{language === 'te' ? 'అమ్మకాలు & ఇన్వాయిస్‌లు' : 'Sales & Invoices Ledger'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'te'
              ? 'అన్ని స్టోర్లలో జరిగిన బిల్లులు, రశీదులు మరియు చెల్లింపు వివరాల ప్రత్యక్ష లెక్క'
              : 'Complete real-time ledger of completed sales, receipts, and invoice records across all stores'}
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-extrabold text-xs rounded-2xl border border-emerald-200 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>{language === 'te' ? 'CSV డౌన్‌లోడ్' : 'Export CSV'}</span>
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed Revenue</span>
          <p className="text-2xl font-black text-emerald-600 font-mono mt-1">₹{totalRevenue.toFixed(2)}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bills</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">{filteredSales.length}</p>
        </div>
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Ticket</span>
          <p className="text-2xl font-black text-indigo-600 font-mono mt-1">
            ₹{filteredSales.length ? (totalRevenue / filteredSales.length).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>

      {/* Search & Store Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice number, customer phone, cashier..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <StoreIcon className="w-4 h-4 text-indigo-600" />
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:outline-none"
          >
            <option value="ALL">All Store Branches</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs">Loading sales history...</span>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6">
            <Receipt className="w-12 h-12 mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No sales transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Invoice</th>
                  <th className="py-3.5 px-4">Store Branch</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Items</th>
                  <th className="py-3.5 px-4">Extra Fee</th>
                  <th className="py-3.5 px-4">Grand Total</th>
                  <th className="py-3.5 px-4">Mode</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {sale.storeName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {new Date(sale.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {sale.customer?.name ? `${sale.customer.name} (${sale.customer.phone || ''})` : 'Walk-in'}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {sale.itemCount} items
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {sale.extraAmount && sale.extraAmount > 0 ? (
                        <span className="font-bold text-amber-700">+₹{sale.extraAmount}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-sm">
                      ₹{sale.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 font-bold text-[10px] text-slate-700">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          sale.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownloadPDF(sale, 'thermal')}
                          className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                          title="Print 80mm Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(sale, 'a4')}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                          title="Download A4 PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                        {sale.status === 'COMPLETED' && (
                          <button
                            onClick={() => setCancellingSale(sale)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                            title="Cancel / Void Invoice"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingSale(sale)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Permanently Delete (శాశ్వతంగా తొలగించు)"
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
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
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
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
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

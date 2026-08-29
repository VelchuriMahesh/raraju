import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  FileDown,
  Printer,
  Search,
  Loader2,
  Calendar,
  Banknote,
  QrCode,
  CreditCard,
  PlusCircle,
  Clock,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { Sale } from '../../types/sale';
import { subscribeToSales } from '../../services/saleService';
import { generateInvoicePDF } from '../../services/pdfService';

export const StoreSalesHistory: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const { language, t } = useLanguage();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);

  const storeId = currentUser?.storeId || 's1';

  useEffect(() => {
    const unsub = subscribeToSales((liveSales) => {
      setSales(liveSales);
      setLoading(false);
    });

    return () => unsub();
  }, [storeId]);

  // Filter sales for the store and selected date
  const dailySales = useMemo(() => {
    return sales.filter((s) => {
      const matchesDate = !selectedDate || s.createdAt.includes(selectedDate) || s.createdAt.startsWith(selectedDate);
      const matchesStore =
        !storeId ||
        s.storeId === storeId ||
        s.storeName.toLowerCase() === (currentUser?.storeName || 'krupa').toLowerCase() ||
        s.storeId === 's1' ||
        s.storeId === 'store_1_main';

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.invoiceNumber.toLowerCase().includes(q) ||
        (s.customer?.name && s.customer.name.toLowerCase().includes(q)) ||
        (s.customer?.phone && s.customer.phone.includes(q)) ||
        s.employeeName.toLowerCase().includes(q);

      return matchesDate && matchesStore && matchesSearch;
    });
  }, [sales, selectedDate, searchQuery, storeId, currentUser]);

  // Aggregate metrics for selected date
  const metrics = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let card = 0;
    let extra = 0;
    let grand = 0;
    let totalItems = 0;

    dailySales.forEach((s) => {
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

    return { cash, upi, card, extra, grand, totalItems, billsCount: dailySales.length };
  }, [dailySales]);

  const handleDownloadPDF = (sale: Sale, format: 'a4' | 'thermal') => {
    try {
      const doc = generateInvoicePDF(sale, null, null, format);
      doc.save(`${sale.invoiceNumber}_${format}.pdf`);
      success(`Invoice ${sale.invoiceNumber} downloaded.`);
    } catch (err: any) {
      error('Failed to download invoice: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" />
            <span>{currentUser?.storeName || 'krupa'} Daily Sales History / రోజువారీ అమ్మకాలు</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Select date to review daily register sales, collected cash & UPI receipts / నగదు మరియు యూపీఐ బిల్లుల లెక్క
          </p>
        </div>

        {/* Date Selector */}
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Grand Total */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Day Total Sales / మొత్తం అమ్మకాలు
          </span>
          <p className="font-mono font-black text-slate-900 text-xl mt-1">₹{metrics.grand.toFixed(2)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{metrics.billsCount} Bills Generated</p>
        </div>

        {/* Cash */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cash (నగదు)</span>
          </span>
          <p className="font-mono font-black text-emerald-700 text-xl mt-1">₹{metrics.cash.toFixed(2)}</p>
          <p className="text-[10px] text-emerald-600/80 mt-0.5">Cash in Drawer</p>
        </div>

        {/* UPI */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 shadow-sm">
          <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>UPI (యూపీఐ)</span>
          </span>
          <p className="font-mono font-black text-indigo-700 text-xl mt-1">₹{metrics.upi.toFixed(2)}</p>
          <p className="text-[10px] text-indigo-600/80 mt-0.5">QR Payments</p>
        </div>

        {/* Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
            <span>Card / Other</span>
          </span>
          <p className="font-mono font-bold text-slate-800 text-xl mt-1">₹{metrics.card.toFixed(2)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">POS Card</p>
        </div>

        {/* Extra Fees */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-sm">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
            <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Extra Fees / అదనపు</span>
          </span>
          <p className="font-mono font-black text-amber-700 text-xl mt-1">+₹{metrics.extra.toFixed(2)}</p>
          <p className="text-[10px] text-amber-600/80 mt-0.5">Delivery / Misc</p>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              Bills on {selectedDate} ({dailySales.length})
            </h3>
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice or customer..."
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
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Extra Amount</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Print / PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    <p className="font-bold">Loading daily sales...</p>
                  </td>
                </tr>
              ) : dailySales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    <p className="font-bold">No sales recorded on {selectedDate}</p>
                  </td>
                </tr>
              ) : (
                dailySales.map((sale) => (
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
                    <td className="py-3 px-4 text-slate-600">{sale.customer?.name || 'Walk-in'}</td>
                    <td className="py-3 px-4 text-slate-600">{sale.employeeName}</td>
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
                          onClick={() => handleDownloadPDF(sale, 'thermal')}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Thermal 80mm Print"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(sale, 'a4')}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title="A4 PDF Download"
                        >
                          <FileDown className="w-4 h-4" />
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
    </div>
  );
};

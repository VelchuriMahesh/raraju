import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Store as StoreIcon,
  Loader2,
  Calendar,
  Calculator,
  Banknote,
  QrCode,
  CreditCard,
  PlusCircle,
  Receipt,
  FileText,
  Clock,
  Layers,
  ChevronDown,
  CheckCircle2,
  Printer
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { Sale } from '../../types/sale';
import { Store } from '../../types/store';
import { subscribeToSales } from '../../services/saleService';
import { subscribeToStores } from '../../services/storeService';
import { exportToCSV } from '../../services/reportService';
import { generateInvoicePDF } from '../../services/pdfService';

export const Reports: React.FC = () => {
  const { success, error } = useToast();
  const { language, t } = useLanguage();

  const [sales, setSales] = useState<Sale[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(''); // empty = all dates

  // Denominations Calculator State
  const [denom500, setDenom500] = useState<number>(0);
  const [denom200, setDenom200] = useState<number>(0);
  const [denom100, setDenom100] = useState<number>(0);
  const [denom50, setDenom50] = useState<number>(0);
  const [denom20, setDenom20] = useState<number>(0);
  const [denom10, setDenom10] = useState<number>(0);

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

  const activeSales = useMemo(() => {
    return sales.filter((s) => {
      const matchesStatus = s.status === 'COMPLETED';
      const matchesStore =
        storeFilter === 'ALL' ||
        s.storeId === storeFilter ||
        (stores.find((st) => st.id === storeFilter)?.name === s.storeName);
      const matchesDate = !selectedDateFilter || s.createdAt.includes(selectedDateFilter);
      return matchesStatus && matchesStore && matchesDate;
    });
  }, [sales, storeFilter, selectedDateFilter, stores]);

  // Aggregate financial metrics
  const financialTotals = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let card = 0;
    let extra = 0;
    let grand = 0;
    let items = 0;
    let profit = 0;

    activeSales.forEach((s) => {
      grand += s.grandTotal;
      items += s.itemCount;
      extra += s.extraAmount || 0;
      profit += s.grossProfit || s.grandTotal * 0.15;

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

    return { cash, upi, card, extra, grand, items, profit, billsCount: activeSales.length };
  }, [activeSales]);

  // Calculate Cash Denomination Total
  const countedCash =
    denom500 * 500 +
    denom200 * 200 +
    denom100 * 100 +
    denom50 * 50 +
    denom20 * 20 +
    denom10 * 10;
  const cashDifference = countedCash - financialTotals.cash;

  const handleExportSales = () => {
    const rows = activeSales.map((s) => ({
      Invoice: s.invoiceNumber,
      Date: new Date(s.createdAt).toLocaleDateString('en-IN'),
      Time: new Date(s.createdAt).toLocaleTimeString('en-IN'),
      Store: s.storeName,
      Cashier: s.employeeName,
      Customer: s.customer?.name || 'Walk-in',
      CustomerPhone: s.customer?.phone || '',
      ItemsSummary: s.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join('; '),
      ItemsCount: s.itemCount,
      Subtotal: s.subtotal,
      ExtraAmount: s.extraAmount || 0,
      ExtraReason: s.extraAmountReason || '',
      PaymentMethod: s.paymentMethod,
      GrandTotal: s.grandTotal
    }));
    exportToCSV(`Detailed_Financial_Report_${new Date().toISOString().split('T')[0]}`, rows);
    success('Detailed financial report exported to CSV.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <span>Sales Analytics & Financial Reports / వ్యాపార ఆర్థిక నివేదికలు</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            In-detail bill-by-bill audit with timings, payment breakdowns, and register cash calculator / సమయంతో సహా పూర్తి లెక్కల నివేదిక
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Filter */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="bg-transparent text-slate-900 font-bold focus:outline-none"
            />
            {selectedDateFilter && (
              <button
                onClick={() => setSelectedDateFilter('')}
                className="text-[10px] text-rose-600 font-bold hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Store Filter */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200 text-xs">
            <StoreIcon className="w-4 h-4 text-indigo-600" />
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="bg-transparent text-slate-900 font-bold focus:outline-none"
            >
              <option value="ALL">All Store Branches (అన్ని బ్రాంచ్‌లు)</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportSales}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/20 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Financial Calculator KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Grand Revenue */}
        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            Total Revenue / మొత్తం రాబడి
          </span>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-900 font-mono">
              ₹{financialTotals.grand.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{financialTotals.billsCount} Bills Generated</p>
          </div>
        </div>

        {/* Cash in Drawer */}
        <div className="p-4 rounded-3xl bg-emerald-50/80 border border-emerald-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cash in Hand / నగదు</span>
          </span>
          <div className="mt-2">
            <p className="text-2xl font-black text-emerald-700 font-mono">
              ₹{financialTotals.cash.toFixed(2)}
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">Direct Counter Cash</p>
          </div>
        </div>

        {/* Online UPI Scanned */}
        <div className="p-4 rounded-3xl bg-indigo-50/80 border border-indigo-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>UPI Online / యూపీఐ</span>
          </span>
          <div className="mt-2">
            <p className="text-2xl font-black text-indigo-700 font-mono">
              ₹{financialTotals.upi.toFixed(2)}
            </p>
            <p className="text-[10px] text-indigo-600 mt-0.5">Bank Direct QR Scan</p>
          </div>
        </div>

        {/* Extra Fees */}
        <div className="p-4 rounded-3xl bg-amber-50/80 border border-amber-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1">
            <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Extra Fees / అదనపు రుసుము</span>
          </span>
          <div className="mt-2">
            <p className="text-2xl font-black text-amber-700 font-mono">
              +₹{financialTotals.extra.toFixed(2)}
            </p>
            <p className="text-[10px] text-amber-600 mt-0.5">Loading / Misc Collected</p>
          </div>
        </div>

        {/* Total Quantity */}
        <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Bags Sold / సంచులు</span>
          </span>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-800 font-mono">
              {financialTotals.items} Bags
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Volume Dispatched</p>
          </div>
        </div>
      </div>

      {/* Cash Register Denomination Calculator */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Daily Cash Denomination Calculator & Tally / నగదు లెక్కింపు క్యాలిక్యులేటర్
              </h3>
              <p className="text-xs text-slate-500">
                Count notes in cash drawer to tally against system recorded cash (₹{financialTotals.cash.toFixed(2)})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Tally Count:</span>
              <span className="font-black text-slate-900 text-sm">₹{countedCash.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Status / Diff:</span>
              <span
                className={`font-black text-sm ${
                  cashDifference === 0
                    ? 'text-emerald-600'
                    : cashDifference > 0
                    ? 'text-indigo-600'
                    : 'text-rose-600'
                }`}
              >
                {cashDifference === 0 ? '✓ Balanced (సరిపోయింది)' : `${cashDifference > 0 ? '+' : ''}₹${cashDifference.toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {[
            { label: '₹500 Notes', count: denom500, set: setDenom500, mul: 500 },
            { label: '₹200 Notes', count: denom200, set: setDenom200, mul: 200 },
            { label: '₹100 Notes', count: denom100, set: setDenom100, mul: 100 },
            { label: '₹50 Notes', count: denom50, set: setDenom50, mul: 50 },
            { label: '₹20 Notes', count: denom20, set: setDenom20, mul: 20 },
            { label: '₹10 Notes', count: denom10, set: setDenom10, mul: 10 }
          ].map((denom) => (
            <div key={denom.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-extrabold text-slate-700 block">{denom.label}</span>
              <input
                type="number"
                min="0"
                value={denom.count || ''}
                onChange={(e) => denom.set(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                = ₹{(denom.count * denom.mul).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* In-Detail Bill-by-Bill Ledger with Exact Timings */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              In-Detail Itemized Sales Ledger / సమయంతో సహా పూర్తి బిల్లుల వివరాలు ({activeSales.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Live Sync</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse text-slate-800">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date & Exact Time</th>
                <th className="py-3 px-4">Store Branch</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Detailed Items Sold</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Extra Fee</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold">No sales records found for selected filter</p>
                  </td>
                </tr>
              ) : (
                activeSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>
                          {new Date(sale.createdAt).toLocaleDateString('en-IN')},{' '}
                          {new Date(sale.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">
                      {sale.storeName || 'krupa'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{sale.employeeName}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {sale.customer?.name ? `${sale.customer.name} (${sale.customer.phone || ''})` : 'Walk-in'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        {sale.items.map((it, idx) => (
                          <p key={idx} className="font-mono text-[11px] text-slate-700">
                            • <span className="font-bold">{it.productName}</span> × {it.quantity}{' '}
                            <span className="text-slate-400">(@ ₹{it.actualPrice})</span>
                          </p>
                        ))}
                      </div>
                    </td>
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
                      {sale.extraAmount && sale.extraAmount > 0 ? (
                        <span>
                          +₹{sale.extraAmount.toFixed(2)}
                          {sale.extraAmountReason ? ` (${sale.extraAmountReason})` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      ₹{sale.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          const doc = generateInvoicePDF(sale, null, null, 'thermal');
                          doc.save(`${sale.invoiceNumber}_thermal.pdf`);
                          success(`Downloaded ${sale.invoiceNumber}`);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        title="Download Thermal PDF"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
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

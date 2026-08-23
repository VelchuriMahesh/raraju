import React, { useMemo } from 'react';
import {
  Banknote,
  QrCode,
  CreditCard,
  PlusCircle,
  Receipt,
  Store as StoreIcon,
  Clock,
  TrendingUp,
  ArrowUpRight
} from 'lucide-react';
import { Sale } from '../../types/sale';
import { Store } from '../../types/store';
import { useLanguage } from '../../context/LanguageContext';

interface LiveStoreCashMonitorProps {
  stores: Store[];
  sales: Sale[];
  onViewStoreSales?: (storeId: string) => void;
}

export const LiveStoreCashMonitor: React.FC<LiveStoreCashMonitorProps> = ({
  stores,
  sales,
  onViewStoreSales
}) => {
  const { language } = useLanguage();

  // Filter sales for today
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todaySales = useMemo(() => {
    return sales.filter(
      (s) =>
        s.status === 'COMPLETED' &&
        (s.createdAt.startsWith(todayDateStr) || s.createdAt.includes(todayDateStr))
    );
  }, [sales, todayDateStr]);

  // Aggregate by store - ONLY for real stores created by Admin
  const storeBreakdowns = useMemo(() => {
    return stores.map((store) => {
      const storeTodaySales = todaySales.filter(
        (s) =>
          s.storeId === store.id ||
          s.storeName.toLowerCase() === store.name.toLowerCase() ||
          (store.code && s.storeId.toLowerCase().includes(store.code.toLowerCase())) ||
          (stores.length === 1) // If single branch exists, aggregate all sales to it
      );

      let cashTotal = 0;
      let upiTotal = 0;
      let cardTotal = 0;
      let extraTotal = 0;
      let grandTotal = 0;
      let itemsTotal = 0;

      storeTodaySales.forEach((s) => {
        grandTotal += s.grandTotal;
        itemsTotal += s.itemCount;
        extraTotal += s.extraAmount || 0;

        if (s.paymentMethod === 'CASH') {
          cashTotal += s.grandTotal;
        } else if (s.paymentMethod === 'UPI') {
          upiTotal += s.grandTotal;
        } else if (s.paymentMethod === 'CARD') {
          cardTotal += s.grandTotal;
        } else if (s.paymentMethod === 'SPLIT' && s.splitPayments) {
          s.splitPayments.forEach((sp) => {
            if (sp.method === 'CASH') cashTotal += sp.amount;
            else if (sp.method === 'UPI') upiTotal += sp.amount;
            else if (sp.method === 'CARD') cardTotal += sp.amount;
          });
        }
      });

      return {
        store,
        billsCount: storeTodaySales.length,
        cashTotal,
        upiTotal,
        cardTotal,
        extraTotal,
        grandTotal,
        itemsTotal,
        latestSale: storeTodaySales[0] || null
      };
    });
  }, [stores, todaySales]);

  // Total daily metrics across all stores
  const totalDailyCash = useMemo(() => {
    return todaySales
      .filter((s) => s.paymentMethod === 'CASH')
      .reduce((sum, s) => sum + s.grandTotal, 0);
  }, [todaySales]);

  const totalDailyGrand = useMemo(() => {
    return todaySales.reduce((sum, s) => sum + s.grandTotal, 0);
  }, [todaySales]);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600" />
              <span>
                Instant Real-Time Branch Cash & Sales Monitor / ప్రత్యక్ష బ్రాంచ్ నగదు & అమ్మకాల మానిటర్
              </span>
            </h3>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              INSTANT LIVE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Immediately updates as cash & UPI payments are collected at each branch / స్టోర్లలో నగదు వసూలు కాగానే ఇక్కడ తక్షణమే కనిపిస్తుంది
          </p>
        </div>

        {/* Global Today Cash Bar */}
        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200 self-start sm:self-auto">
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Today's Cash / నేటి నగదు
            </span>
            <span className="font-mono font-black text-emerald-600 text-base">
              ₹{totalDailyCash.toFixed(2)}
            </span>
          </div>

          <div className="w-px h-8 bg-slate-200" />

          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Today's Revenue / నేటి రాబడి
            </span>
            <span className="font-mono font-black text-slate-900 text-base">
              ₹{totalDailyGrand.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Store Cards Grid - Only Real Stores */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {storeBreakdowns.map((sb) => (
          <div
            key={sb.store.id}
            className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
          >
            {/* Top Store Header */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    {sb.store.code || 'S1'}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">{sb.store.name}</h4>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {sb.billsCount} Bills generated Today / నేడు బిల్లులు
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-black text-slate-900 text-base">
                    ₹{sb.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Cash & UPI Quick Breakdown */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {/* Cash in Drawer */}
                <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <Banknote className="w-3 h-3 text-emerald-600" />
                    <span>CASH (నగదు)</span>
                  </span>
                  <p className="font-mono font-black text-emerald-700 text-sm mt-0.5">
                    ₹{sb.cashTotal.toFixed(2)}
                  </p>
                </div>

                {/* UPI Scanned */}
                <div className="p-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-200">
                  <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1">
                    <QrCode className="w-3 h-3 text-indigo-600" />
                    <span>UPI (యూపీఐ)</span>
                  </span>
                  <p className="font-mono font-black text-indigo-700 text-sm mt-0.5">
                    ₹{sb.upiTotal.toFixed(2)}
                  </p>
                </div>

                {/* Card */}
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-slate-400" />
                    <span>CARD (కార్డు)</span>
                  </span>
                  <p className="font-mono font-bold text-slate-700 text-xs mt-0.5">
                    ₹{sb.cardTotal.toFixed(2)}
                  </p>
                </div>

                {/* Extra Fees */}
                <div className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <PlusCircle className="w-3 h-3 text-amber-600" />
                    <span>EXTRA FEES (అదనపు)</span>
                  </span>
                  <p className="font-mono font-black text-amber-700 text-xs mt-0.5">
                    +₹{sb.extraTotal.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Footer / Action */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 font-mono">
                {sb.itemsTotal} Bags sold / సంచులు
              </span>

              {onViewStoreSales && (
                <button
                  onClick={() => onViewStoreSales(sb.store.id)}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
                >
                  <span>View Details / వివరాలు</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Store as StoreIcon,
  Loader2
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { DailyClosing as DailyClosingType } from '../../types/dailyClosing';
import { Store } from '../../types/store';
import { getDailyClosings } from '../../services/closingService';
import { getStores } from '../../services/storeService';

export const DailyClosing: React.FC = () => {
  const { error } = useToast();
  const { language } = useLanguage();

  const [closings, setClosings] = useState<DailyClosingType[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [storeFilter, setStoreFilter] = useState<string>('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const [closingsData, storesData] = await Promise.all([
        getDailyClosings(),
        getStores()
      ]);
      setClosings(closingsData);
      setStores(storesData);
    } catch (err: any) {
      error('Failed to load daily closings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredClosings = closings.filter(
    (c) => storeFilter === 'ALL' || c.storeId === storeFilter
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            <span>{language === 'te' ? 'స్టోర్ల రోజువారీ నగదు ముగింపు' : 'Store Daily Cash Register Closings'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'te'
              ? 'ప్రతి స్టోర్ బ్రాంచ్ షిఫ్ట్ ముగింపు నగదు లెక్కలు మరియు తేడాలను తనిఖీ చేయండి'
              : 'Review end-of-shift register cash reconciliations, cash discrepancies, and cashier submissions'}
          </p>
        </div>

        <select
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:outline-none self-start sm:self-auto"
        >
          <option value="ALL">All Store Branches</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Closings Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs">Loading daily closing logs...</span>
          </div>
        ) : filteredClosings.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6">
            <ClipboardList className="w-12 h-12 mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No shift closings recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Closing Date</th>
                  <th className="py-3.5 px-4">Store Branch</th>
                  <th className="py-3.5 px-4">Total Sales</th>
                  <th className="py-3.5 px-4">Cash Sales</th>
                  <th className="py-3.5 px-4">UPI / Card</th>
                  <th className="py-3.5 px-4">Expected Cash</th>
                  <th className="py-3.5 px-4">Actual Cash</th>
                  <th className="py-3.5 px-4">Difference</th>
                  <th className="py-3.5 px-4">Closed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClosings.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {c.closingDate}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {c.storeName}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-emerald-600 text-sm">
                      ₹{c.totalSales.toFixed(2)} ({c.totalBills} bills)
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-800 font-bold">
                      ₹{c.cashSales.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      UPI: ₹{c.upiSales} • Card: ₹{c.cardSales}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      ₹{c.expectedCash.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      ₹{c.actualCash.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black">
                      <span
                        className={
                          c.cashDifference === 0
                            ? 'text-emerald-600'
                            : c.cashDifference > 0
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }
                      >
                        {c.cashDifference >= 0 ? '+' : ''}₹{c.cashDifference.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-600">
                      {c.closedByName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

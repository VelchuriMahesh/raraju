import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Calendar,
  CheckCircle2,
  Lock,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { DailyClosing } from '../../types/dailyClosing';
import {
  calculateExpectedClosing,
  submitDailyClosing,
  getDailyClosings
} from '../../services/closingService';
import { getTodayDateString } from '../../services/stockAssignmentService';

export const StoreDailyClosing: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const { language } = useLanguage();

  const [closingDate, setClosingDate] = useState<string>(getTodayDateString());
  const [openingCash, setOpeningCash] = useState<string>('0');
  const [actualCash, setActualCash] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');

  const [expectedData, setExpectedData] = useState<{
    cashSales: number;
    upiSales: number;
    cardSales: number;
    creditSales: number;
    totalSales: number;
    totalBills: number;
    expectedCash: number;
  } | null>(null);

  const [pastClosings, setPastClosings] = useState<DailyClosing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const storeId = currentUser?.storeId;
  const storeName = currentUser?.storeName || 'Store Branch';

  const loadData = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [calc, history] = await Promise.all([
        calculateExpectedClosing(storeId, closingDate, parseFloat(openingCash) || 0),
        getDailyClosings(storeId)
      ]);
      setExpectedData(calc);
      setPastClosings(history);
    } catch (err: any) {
      error('Failed to calculate closing summary: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [storeId, closingDate, openingCash]);

  const handleSubmitClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !storeId) return;

    const countedCash = parseFloat(actualCash);
    if (isNaN(countedCash) || countedCash < 0) {
      error('Please enter the physical cash counted in the register.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitDailyClosing(
        {
          storeId,
          storeName,
          closingDate,
          openingCash: parseFloat(openingCash) || 0,
          actualCash: countedCash,
          closingNotes: closingNotes.trim()
        },
        currentUser
      );

      success('Daily cash shift closing submitted successfully.');
      setActualCash('');
      setClosingNotes('');
      loadData();
    } catch (err: any) {
      error('Failed to submit daily closing: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cashDifference =
    expectedData && actualCash !== ''
      ? Math.round((parseFloat(actualCash) - expectedData.expectedCash) * 100) / 100
      : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            <span>{language === 'te' ? 'రోజువారీ నగదు లెక్క ముగింపు' : 'Daily Cash Register Shift Closing'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'te'
              ? 'రోజు ముగింపులో క్యాష్ డ్రాయర్‌లోని నగదును లెక్కించి సబ్మిట్ చేయండి'
              : 'Reconcile physical cash counted in the drawer against expected cash sales for today'}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 text-xs">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <input
            type="date"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            className="bg-transparent font-bold text-slate-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Summary Metrics */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">
              Sales Summary for {closingDate}
            </h3>

            {loading ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : expectedData ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-semibold block">Total Bills</span>
                    <span className="text-xl font-black text-slate-900 font-mono mt-1 block">
                      {expectedData.totalBills}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-semibold block">Total Sales</span>
                    <span className="text-xl font-black text-emerald-600 font-mono mt-1 block">
                      ₹{expectedData.totalSales.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-semibold block">Cash Sales</span>
                    <span className="text-xl font-black text-slate-900 font-mono mt-1 block">
                      ₹{expectedData.cashSales.toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 font-semibold block">UPI / Card</span>
                    <span className="text-xl font-black text-indigo-600 font-mono mt-1 block">
                      ₹{(expectedData.upiSales + expectedData.cardSales).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold text-indigo-900 block">Expected Cash in Drawer:</span>
                    <span className="text-[11px] text-indigo-700">Opening Cash (₹{openingCash}) + Cash Sales (₹{expectedData.cashSales})</span>
                  </div>
                  <span className="text-2xl font-black text-indigo-900 font-mono">
                    ₹{expectedData.expectedCash.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: Closing Submission Form */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-3">
            Submit Physical Cash Count
          </h3>

          <form onSubmit={handleSubmitClosing} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Morning Opening Cash (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Actual Physical Cash Counted (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="e.g. 25000"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-black text-lg focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            {cashDifference !== null && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                  cashDifference === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : cashDifference > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <span className="font-bold">
                  {cashDifference === 0
                    ? 'Exact Match (సరిపోయింది)'
                    : cashDifference > 0
                    ? 'Surplus Cash (+ అదనపు నగదు)'
                    : 'Shortage (- తక్కువ నగదు)'}
                </span>
                <span className="text-base font-black font-mono">
                  {cashDifference >= 0 ? '+' : ''}₹{cashDifference.toFixed(2)}
                </span>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Shift Notes (Optional)</label>
              <textarea
                rows={2}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="e.g. Register balanced, ₹10 shortage accounted for"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit End-of-Shift Closing'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  CircleDollarSign,
  Plus,
  Search,
  Store as StoreIcon,
  Loader2,
  Calendar,
  X,
  Check,
  Tag
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Expense, ExpenseCategory } from '../../types/expense';
import { Store } from '../../types/store';
import { getExpenses, createExpense } from '../../services/expenseService';
import { getStores } from '../../services/storeService';

export const Expenses: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [category, setCategory] = useState<ExpenseCategory>('Rent');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const expenseCategories: ExpenseCategory[] = [
    'Rent',
    'Electricity',
    'Transport',
    'Salary',
    'Maintenance',
    'Packaging',
    'Tea & Refreshment',
    'Stationery',
    'Marketing',
    'Other'
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const [expData, storesData] = await Promise.all([
        getExpenses(),
        getStores()
      ]);
      setExpenses(expData);
      setStores(storesData);
    } catch (err: any) {
      error('Failed to load expenses: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      error('Please enter a valid expense amount.');
      return;
    }

    const storeObj = stores.find((s) => s.id === selectedStoreId);

    setIsSubmitting(true);
    try {
      await createExpense(
        {
          storeId: storeObj?.id,
          storeName: storeObj?.name,
          category,
          amount: amt,
          description: description.trim(),
          paymentMode,
          expenseDate
        },
        currentUser
      );

      success('Expense recorded successfully.');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      error('Failed to save expense: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalExpenseAmt = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <CircleDollarSign className="w-6 h-6 text-brand-400" />
            <span>Business Expenses</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track branch operating expenses to calculate true estimated Net Profit
          </p>
        </div>

        <button
          onClick={() => {
            setCategory('Rent');
            setAmount('');
            setDescription('');
            setSelectedStoreId('');
            setPaymentMode('CASH');
            setExpenseDate(new Date().toISOString().split('T')[0]);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense</span>
        </button>
      </div>

      {/* Expense Total Card */}
      <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 font-semibold uppercase">Total Operating Expenses</span>
          <p className="text-2xl font-black text-rose-400 font-mono mt-0.5">₹{totalExpenseAmt.toFixed(2)}</p>
        </div>
        <span className="text-xs text-slate-500">{expenses.length} entries recorded</span>
      </div>

      {/* Expenses Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            <span className="text-xs">Loading expenses...</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6">
            <CircleDollarSign className="w-12 h-12 mb-2 text-slate-700" />
            <p className="text-sm font-semibold text-slate-400">No expenses recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Store Branch</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Payment Mode</th>
                  <th className="py-3.5 px-4">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {exp.expenseDate}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      {exp.category}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {exp.storeName || 'Global Business'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {exp.description}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-rose-400 text-sm">
                      ₹{exp.amount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300">
                        {exp.paymentMode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-400">
                      {exp.createdByName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-white">Record Operating Expense</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
                  >
                    {expenseCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Store (Optional)</label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
                  >
                    <option value="">Global / Headquarters</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description *</label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Electricity bill payment for Main branch"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-600/30"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

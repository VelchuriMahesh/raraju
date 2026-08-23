import React, { useState, useEffect } from 'react';
import {
  Users as UsersIcon,
  Search,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Calendar,
  DollarSign,
  ShoppingBag
} from 'lucide-react';
import { Customer } from '../../types/settings';
import { getCustomers } from '../../services/customerService';
import { useToast } from '../../context/ToastContext';

export const Customers: React.FC = () => {
  const { error } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (err: any) {
      error('Failed to load customer directory: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <UsersIcon className="w-6 h-6 text-brand-400" />
            <span>Customer Directory & Purchase Loyalty</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track customer contact details, lifetime order counts, and total revenue spent
          </p>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name or phone..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            <span className="text-xs">Loading customer directory...</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6">
            <UsersIcon className="w-12 h-12 mb-2 text-slate-700" />
            <p className="text-sm font-semibold text-slate-400">No customers registered yet</p>
            <p className="text-xs text-slate-600 mt-1">Customer profiles are automatically saved during POS checkout</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">WhatsApp Phone</th>
                  <th className="py-3.5 px-4">Address / GST</th>
                  <th className="py-3.5 px-4">Lifetime Orders</th>
                  <th className="py-3.5 px-4">Total Amount Spent</th>
                  <th className="py-3.5 px-4">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {c.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-brand-400">
                      {c.phone}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {c.address || c.gstin || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                      {c.totalOrders} bills
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-emerald-400 text-sm">
                      ₹{c.totalSpent.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString('en-IN') : '—'}
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

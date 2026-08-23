import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Shield,
  Loader2,
  Calendar,
  User
} from 'lucide-react';
import { AuditLog } from '../../types/auditLog';
import { getAuditLogs } from '../../services/auditService';
import { useToast } from '../../context/ToastContext';

export const AuditLogs: React.FC = () => {
  const { error } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs(200);
      setLogs(data);
    } catch (err: any) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchAction = actionFilter === 'ALL' || log.action === actionFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      log.userName.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      (log.storeName && log.storeName.toLowerCase().includes(q));

    return matchAction && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-brand-400" />
            <span>Immutable Security Audit Logs</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete tamper-proof timeline of all system, price, inventory, user, and authorization events
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 px-3.5 py-1.5 rounded-2xl border border-emerald-800/60 font-semibold self-start sm:self-auto">
          <Shield className="w-4 h-4" />
          <span>Append-Only Ledger Active</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit details, user..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Event Types</option>
            <option value="SALE_CREATED">Sales Completed</option>
            <option value="CUSTOMER_RATE_USED">Customer Rates Used</option>
            <option value="STOCK_ADDED">Stock Inwarded</option>
            <option value="STOCK_ADJUSTED">Stock Adjusted</option>
            <option value="STOCK_TRANSFERRED">Stock Transferred</option>
            <option value="PRICE_CHANGED">Price Changed</option>
            <option value="USER_CREATED">Users Created</option>
            <option value="USER_STATUS_CHANGED">User Status Changed</option>
            <option value="STORE_CREATED">Stores Created</option>
            <option value="SETTINGS_UPDATED">Settings Updated</option>
          </select>
        </div>

        <span className="text-xs text-slate-400">
          Showing <strong>{filteredLogs.length}</strong> logged events
        </span>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            <span className="text-xs">Loading immutable timeline...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6">
            <History className="w-12 h-12 mb-2 text-slate-700" />
            <p className="text-sm font-semibold text-slate-400">No matching audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">User & Role</th>
                  <th className="py-3.5 px-4">Store Context</th>
                  <th className="py-3.5 px-4">Entity</th>
                  <th className="py-3.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-800 font-mono font-bold text-[10px] text-brand-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-white">{log.userName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{log.userRole}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {log.storeName || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {log.entity}
                    </td>
                    <td className="py-3.5 px-4 text-slate-200 leading-relaxed max-w-md">
                      {log.details}
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

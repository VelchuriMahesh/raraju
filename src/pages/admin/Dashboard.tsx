import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  Store,
  Package,
  Boxes,
  Loader2,
  Calendar,
  Building2,
  ArrowUpRight,
  Banknote
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { getStores, subscribeToStores } from '../../services/storeService';
import { getProducts, subscribeToProducts } from '../../services/productService';
import { getSales, subscribeToSales } from '../../services/saleService';
import { calculateDashboardMetrics, DashboardMetrics } from '../../services/reportService';
import { Sale } from '../../types/sale';
import { Store as StoreType } from '../../types/store';
import { Product } from '../../types/product';
import { getAllInventory, subscribeToAllInventory } from '../../services/inventoryService';
import { StoreInventory } from '../../types/inventory';
import { LiveStoreCashMonitor } from '../../components/admin/LiveStoreCashMonitor';
import { useNavigate } from 'react-router-dom';

interface DashboardProps {
  onNavigate?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { language, t } = useLanguage();

  const [stores, setStores] = useState<StoreType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [inventories, setInventories] = useState<StoreInventory[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  // Real-time live listeners for instant live updates
  useEffect(() => {
    let unsubs: Array<() => void> = [];

    const initRealtime = async () => {
      const unsubStores = subscribeToStores((liveStores) => {
        setStores(liveStores);
      });
      const unsubProds = subscribeToProducts((liveProds) => {
        setProducts(liveProds);
      });
      const unsubSales = subscribeToSales((liveSales) => {
        setSales(liveSales);
        setLoading(false);
      });
      const unsubInvs = subscribeToAllInventory((liveInvs) => {
        setInventories(liveInvs);
      });

      unsubs = [unsubStores, unsubProds, unsubSales, unsubInvs];
    };

    initRealtime();

    return () => {
      unsubs.forEach((u) => u && u());
    };
  }, []);

  // Recalculate metrics whenever live data or time filter changes
  useEffect(() => {
    const now = new Date();
    let filteredSales = sales;
    if (timeFilter === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      filteredSales = sales.filter((s) => s.createdAt.startsWith(todayStr));
    } else if (timeFilter === 'week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      filteredSales = sales.filter((s) => s.createdAt >= sevenDaysAgo);
    } else if (timeFilter === 'month') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      filteredSales = sales.filter((s) => s.createdAt >= thirtyDaysAgo);
    }

    const calculated = calculateDashboardMetrics(filteredSales, [], inventories, products);
    setMetrics(calculated);
  }, [sales, inventories, products, timeFilter]);

  if (loading && sales.length === 0 && stores.length === 0) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-bold text-slate-600">Connecting to live real-time business stream...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-indigo-600" />
              <span>Live Real-Time Business Dashboard / లైవ్ బిజినెస్ డ్యాష్‌బోర్డ్</span>
            </h1>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              LIVE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time live sync of sales, branch performance, and stock levels across all stores / రియల్ టైమ్ అమ్మకాలు మరియు స్టోర్ల లెక్కలు
          </p>
        </div>

        {/* Time Filter Pill */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start sm:self-auto text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1" />
          <button
            onClick={() => setTimeFilter('today')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              timeFilter === 'today' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Today / ఈ రోజు
          </button>
          <button
            onClick={() => setTimeFilter('week')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              timeFilter === 'week' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            This Week / ఈ వారం
          </button>
          <button
            onClick={() => setTimeFilter('month')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              timeFilter === 'month' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            This Month / ఈ నెల
          </button>
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              timeFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Time / మొత్తం సమయం
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              REVENUE / మొత్తం రాబడి
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 font-mono">
              ₹{(metrics?.totalSales || 0).toFixed(2)}
            </p>
            <p className="text-[11px] text-emerald-600 font-bold mt-1">Live Sales Revenue / లైవ్ అమ్మకాలు</p>
          </div>
        </div>

        {/* Total Invoices */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              TOTAL BILLS / మొత్తం బిల్లులు
            </span>
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 font-mono">{metrics?.totalBills || 0}</p>
            <p className="text-[11px] text-slate-500 mt-1">Completed bills generated / బిల్లుల సంఖ్య</p>
          </div>
        </div>

        {/* Total Stores */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              STORES / స్టోర్లు / బ్రాంచ్‌లు
            </span>
            <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 font-mono">{stores.length}</p>
            <p className="text-[11px] text-purple-600 font-bold mt-1">Active branch stores / క్రియాశీల స్టోర్లు</p>
          </div>
        </div>

        {/* Total Products */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              PRODUCTS / ఉత్పత్తులు
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 font-mono">{products.length}</p>
            <p className="text-[11px] text-slate-500 mt-1">Catalog items listed / వస్తువుల సంఖ్య</p>
          </div>
        </div>
      </div>

      {/* Instant Real-Time Cash & Sales Monitor for each store */}
      <LiveStoreCashMonitor
        stores={stores}
        sales={sales}
        onViewStoreSales={(storeId) => navigate('/admin/daily-history')}
      />
    </div>
  );
};

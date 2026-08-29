import React, { useState, useEffect } from 'react';
import {
  CheckCheck,
  Store as StoreIcon,
  Search,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  History,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Store } from '../../types/store';
import { Product } from '../../types/product';
import { getStores } from '../../services/storeService';
import { getProducts } from '../../services/productService';
import { getStoreInventory, reconcileStoreStock } from '../../services/inventoryService';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { StockReconciliationReport } from '../../types/inventory';

interface ReconRow {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  systemStock: number;
  physicalStock: string; // string input
  reason: string;
}

export const Reconciliation: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const { confirm } = useConfirm();

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [pastReports, setPastReports] = useState<StockReconciliationReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [storesData, prodsData] = await Promise.all([
        getStores(true),
        getProducts(true)
      ]);
      setStores(storesData);
      setProducts(prodsData);

      if (storesData.length > 0) {
        setSelectedStoreId(storesData[0].id);
        await loadStoreStock(storesData[0].id, prodsData);
      }
    } catch (err: any) {
      error('Failed to load reconciliation data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStoreStock = async (storeId: string, prods: Product[]) => {
    try {
      const invs = await getStoreInventory(storeId);
      const invMap: { [prodId: string]: number } = {};
      invs.forEach((inv) => {
        invMap[inv.productId] = inv.quantity;
      });

      const initialRows: ReconRow[] = prods.map((p) => {
        const currentStock = invMap[p.id] || 0;
        return {
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          unit: p.unit,
          systemStock: currentStock,
          physicalStock: String(currentStock),
          reason: ''
        };
      });

      setRows(initialRows);

      // Load past reports
      const reportsSnap = await getDocs(
        // Must match RECONCILIATION_COLLECTION in inventoryService.ts. This read used to
        // point at 'stockReconciliations' while reconcileStoreStock() wrote to
        // 'reconciliations', so the audit history here was always empty.
        query(collection(db, 'reconciliations'), orderBy('timestamp', 'desc'))
      );
      setPastReports(
        reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StockReconciliationReport))
      );
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  const handleStoreChange = async (storeId: string) => {
    setSelectedStoreId(storeId);
    setLoading(true);
    await loadStoreStock(storeId, products);
    setLoading(false);
  };

  const handlePhysicalStockChange = (productId: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, physicalStock: val } : r))
    );
  };

  const handleReasonChange = (productId: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, reason: val } : r))
    );
  };

  const handleSubmitReconciliation = async () => {
    if (!currentUser) return;
    const storeObj = stores.find((s) => s.id === selectedStoreId);
    if (!storeObj) return;

    // Filter discrepancies
    const discrepancyItems = rows
      .map((r) => {
        const physical = parseFloat(r.physicalStock);
        const diff = isNaN(physical) ? 0 : physical - r.systemStock;
        return {
          productId: r.productId,
          productName: r.productName,
          sku: r.sku,
          unit: r.unit,
          systemStock: r.systemStock,
          physicalStock: isNaN(physical) ? r.systemStock : physical,
          difference: diff,
          reason: r.reason
        };
      })
      .filter((it) => it.difference !== 0);

    if (discrepancyItems.length === 0) {
      success('No discrepancies found! Physical count matches recorded system inventory.');
      return;
    }

    const confirmed = await confirm({
      title: 'Commit Physical Stock Reconciliation?',
      message: `You are about to adjust ${discrepancyItems.length} inventory items in "${storeObj.name}" to match your physical audit count. This will update live stock and create stock movement entries.`,
      confirmText: 'Commit Reconcile',
      isDestructive: false
    });

    if (confirmed) {
      setIsSubmitting(true);
      try {
        await reconcileStoreStock(storeObj.id, storeObj.name, discrepancyItems, currentUser);
        success(`Stock reconciliation completed for ${storeObj.name}!`);
        await loadStoreStock(storeObj.id, products);
      } catch (err: any) {
        error('Failed to commit reconciliation: ' + err.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const filteredRows = rows.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return r.productName.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q);
  });

  const discrepanciesCount = rows.filter((r) => {
    const physical = parseFloat(r.physicalStock);
    return !isNaN(physical) && physical !== r.systemStock;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <CheckCheck className="w-6 h-6 text-brand-400" />
            <span>Store Stock Physical Reconciliation</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Compare recorded system stock against physical warehouse audits and auto-reconcile variances
          </p>
        </div>

        {/* Store Selector */}
        <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-2xl border border-slate-800 self-start sm:self-auto">
          <StoreIcon className="w-4 h-4 text-brand-400" />
          <select
            value={selectedStoreId}
            onChange={(e) => handleStoreChange(e.target.value)}
            className="bg-transparent text-white text-xs font-bold focus:outline-none"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Discrepancy Banner & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items in audit..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-3">
          {discrepanciesCount > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-800 text-amber-300 text-xs font-bold">
              {discrepanciesCount} Discrepancies Detected
            </span>
          )}

          <button
            onClick={handleSubmitReconciliation}
            disabled={isSubmitting || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving Adjustments...' : 'Commit Reconciliation'}</span>
          </button>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            <span className="text-xs">Loading audit counts...</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6">
            <p className="text-sm font-semibold text-slate-400">No products to reconcile</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">System Stock</th>
                  <th className="py-3.5 px-4 w-36">Physical Audit Count</th>
                  <th className="py-3.5 px-4">Variance / Diff</th>
                  <th className="py-3.5 px-4">Variance Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredRows.map((row) => {
                  const physical = parseFloat(row.physicalStock);
                  const diff = isNaN(physical) ? 0 : physical - row.systemStock;
                  const hasDiscrepancy = diff !== 0;

                  return (
                    <tr
                      key={row.productId}
                      className={`transition-colors ${
                        hasDiscrepancy ? 'bg-amber-950/20 hover:bg-amber-950/30' : 'hover:bg-slate-900/50'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-100">
                        {row.productName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {row.sku}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                        {row.systemStock} {row.unit}
                      </td>
                      <td className="py-3.5 px-4">
                        <input
                          type="number"
                          value={row.physicalStock}
                          onChange={(e) => handlePhysicalStockChange(row.productId, e.target.value)}
                          className={`w-28 px-3 py-1.5 rounded-xl font-mono font-bold text-xs bg-slate-900 border focus:outline-none ${
                            hasDiscrepancy
                              ? 'border-amber-500 text-amber-300'
                              : 'border-slate-700 text-white'
                          }`}
                        />
                      </td>
                      <td className="py-3.5 px-4 font-mono font-black text-sm">
                        {diff === 0 ? (
                          <span className="text-emerald-400">0</span>
                        ) : diff > 0 ? (
                          <span className="text-emerald-400">+{diff}</span>
                        ) : (
                          <span className="text-rose-400">{diff}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {hasDiscrepancy && (
                          <input
                            type="text"
                            value={row.reason}
                            onChange={(e) => handleReasonChange(row.productId, e.target.value)}
                            placeholder="Reason (e.g. Broken packaging)"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

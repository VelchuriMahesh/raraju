import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  ArrowRight,
  Store,
  Loader2,
  Trash2,
  X,
  Check,
  Package
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StockTransfer, StockTransferItem } from '../../types/stockTransfer';
import { Store as StoreType } from '../../types/store';
import { Product } from '../../types/product';
import { getTransfers, transferStock } from '../../services/transferService';
import { getStores } from '../../services/storeService';
import { getProducts } from '../../services/productService';
import { getStoreInventory } from '../../services/inventoryService';

export const Transfers: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [transferItems, setTransferItems] = useState<StockTransferItem[]>([]);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Available stock in source store
  const [sourceStockMap, setSourceStockMap] = useState<{ [prodId: string]: number }>({});
  const [selectedProdId, setSelectedProdId] = useState('');
  const [transferQty, setTransferQty] = useState('10');

  const loadData = async () => {
    setLoading(true);
    try {
      const [transData, storesData, prodsData] = await Promise.all([
        getTransfers(),
        getStores(true),
        getProducts(true)
      ]);
      setTransfers(transData);
      setStores(storesData);
      setProducts(prodsData);

      if (storesData.length >= 2) {
        setFromStoreId(storesData[0].id);
        setToStoreId(storesData[1].id);
        await updateSourceStoreStock(storesData[0].id);
      }
      if (prodsData.length > 0) {
        setSelectedProdId(prodsData[0].id);
      }
    } catch (err: any) {
      error('Failed to load transfers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSourceStoreStock = async (storeId: string) => {
    try {
      const invs = await getStoreInventory(storeId);
      const map: { [prodId: string]: number } = {};
      invs.forEach((inv) => {
        map[inv.productId] = inv.quantity;
      });
      setSourceStockMap(map);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFromStoreChange = async (storeId: string) => {
    setFromStoreId(storeId);
    await updateSourceStoreStock(storeId);
    setTransferItems([]);
  };

  const openNewTransferModal = async () => {
    if (stores.length < 2) {
      error('At least 2 stores are required to transfer stock.');
      return;
    }
    setFromStoreId(stores[0].id);
    setToStoreId(stores[1].id);
    await updateSourceStoreStock(stores[0].id);
    setTransferItems([]);
    setReason('');
    setIsModalOpen(true);
  };

  const handleAddItemToTransfer = () => {
    const prod = products.find((p) => p.id === selectedProdId);
    const qty = parseInt(transferQty, 10);
    const available = sourceStockMap[selectedProdId] || 0;

    if (!prod || isNaN(qty) || qty <= 0) {
      error('Please select product and valid quantity.');
      return;
    }

    if (qty > available) {
      error(`Source store only has ${available} ${prod.unit} in stock.`);
      return;
    }

    setTransferItems((prev) => {
      const existing = prev.find((it) => it.productId === prod.id);
      if (existing) {
        if (existing.quantity + qty > available) {
          error(`Cannot transfer more than available stock (${available} ${prod.unit}).`);
          return prev;
        }
        return prev.map((it) =>
          it.productId === prod.id ? { ...it, quantity: it.quantity + qty } : it
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          quantity: qty
        }
      ];
    });

    setTransferQty('10');
  };

  const handleRemoveTransferItem = (prodId: string) => {
    setTransferItems((prev) => prev.filter((it) => it.productId !== prodId));
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (fromStoreId === toStoreId) {
      error('Source and Destination stores cannot be identical.');
      return;
    }
    if (transferItems.length === 0) {
      error('Please add at least one product to transfer.');
      return;
    }

    const fromStore = stores.find((s) => s.id === fromStoreId);
    const toStore = stores.find((s) => s.id === toStoreId);

    if (!fromStore || !toStore) return;

    setIsSubmitting(true);
    try {
      await transferStock(
        fromStore.id,
        fromStore.name,
        toStore.id,
        toStore.name,
        transferItems,
        reason.trim(),
        currentUser
      );

      success(`Transferred stock from ${fromStore.name} to ${toStore.name}.`);
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      error(err.message || 'Failed to complete stock transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-brand-400" />
            <span>Inter-Store Stock Transfers</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Transfer inventory between branches atomically with full dual-ledger debit and credit entries
          </p>
        </div>

        <button
          onClick={openNewTransferModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Transfer</span>
        </button>
      </div>

      {/* Transfers List */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            <span className="text-xs">Loading stock transfers...</span>
          </div>
        ) : transfers.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6">
            <Truck className="w-12 h-12 mb-2 text-slate-700" />
            <p className="text-sm font-semibold text-slate-400">No stock transfers recorded</p>
            <p className="text-xs text-slate-600 mt-1">Move products between branches as inventory demands shift</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Transfer #</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Source Store</th>
                  <th className="py-3.5 px-4">Destination Store</th>
                  <th className="py-3.5 px-4">Items Transferred</th>
                  <th className="py-3.5 px-4">Total Qty</th>
                  <th className="py-3.5 px-4">Authorized By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {transfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-brand-400">
                      {tr.transferNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {new Date(tr.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-rose-300">
                      {tr.fromStoreName}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-300">
                      {tr.toStoreName}
                    </td>
                    <td className="py-3.5 px-4">
                      {tr.items.map((it, idx) => (
                        <div key={idx} className="text-[11px] text-slate-300">
                          {it.productName} ({it.quantity} {it.unit})
                        </div>
                      ))}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-white text-sm">
                      {tr.totalQuantity} units
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-400">
                      {tr.transferredByName}
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-white">New Inter-Store Transfer</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTransfer} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <label className="block font-semibold text-rose-400 mb-1">From Store (Debit) *</label>
                  <select
                    value={fromStoreId}
                    onChange={(e) => handleFromStoreChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-emerald-400 mb-1">To Store (Credit) *</label>
                  <select
                    value={toStoreId}
                    onChange={(e) => setToStoreId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
                  >
                    {stores
                      .filter((s) => s.id !== fromStoreId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Add Item */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <p className="font-bold text-slate-200">Select Products to Transfer</p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-7">
                    <label className="block text-slate-400 mb-1">Product</label>
                    <select
                      value={selectedProdId}
                      onChange={(e) => setSelectedProdId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
                    >
                      {products.map((p) => {
                        const avail = sourceStockMap[p.id] || 0;
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} (Avail: {avail} {p.unit})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1">Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={transferQty}
                      onChange={(e) => setTransferQty(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleAddItemToTransfer}
                      className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-md transition-colors"
                    >
                      Add Item
                    </button>
                  </div>
                </div>

                {/* Transfer items list */}
                {transferItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-900 space-y-1.5">
                    {transferItems.map((it) => (
                      <div key={it.productId} className="flex items-center justify-between p-2 rounded-xl bg-slate-900 text-xs">
                        <span className="font-bold text-white">
                          {it.productName} ({it.quantity} {it.unit})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTransferItem(it.productId)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Reason / Notes</label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Stock balancing for weekend rush..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
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
                  disabled={isSubmitting || transferItems.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-600/30 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Transferring...' : 'Execute Stock Transfer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Store as StoreIcon,
  Loader2,
  Package,
  X,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { Product } from '../../types/product';
import { Store } from '../../types/store';
import { StoreInventory } from '../../types/inventory';
import { getProducts, subscribeToProducts } from '../../services/productService';
import { getStores, subscribeToStores } from '../../services/storeService';
import { getAllInventory, adjustStock, subscribeToAllInventory } from '../../services/inventoryService';

export const Inventory: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const { language } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [inventories, setInventories] = useState<StoreInventory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('ALL');

  // Adjust Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [adjustQuantity, setAdjustQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubInvs = subscribeToAllInventory((liveInvs) => {
      setInventories(liveInvs);
      setLoading(false);
    });
    const unsubProds = subscribeToProducts((liveProds) => {
      setProducts(liveProds);
    });
    const unsubStores = subscribeToStores((liveStores) => {
      setStores(liveStores);
    });

    return () => {
      unsubInvs();
      unsubProds();
      unsubStores();
    };
  }, []);

  const openAdjustModal = (storeId?: string, productId?: string) => {
    setSelectedStoreId(storeId || stores[0]?.id || '');
    setSelectedProductId(productId || products[0]?.id || '');
    setAdjustQuantity('');
    setReason('');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const qty = parseInt(adjustQuantity, 10);
    if (isNaN(qty) || qty === 0) {
      error('Please enter a non-zero quantity change.');
      return;
    }

    const targetStore = stores.find((s) => s.id === selectedStoreId);
    const targetProd = products.find((p) => p.id === selectedProductId);

    if (!targetStore || !targetProd) {
      error('Store or Product selection invalid.');
      return;
    }

    setIsSubmitting(true);
    try {
      await adjustStock(
        targetStore.id,
        targetStore.name,
        targetProd,
        qty,
        'ADMIN_ADJUSTMENT',
        reason.trim() || 'Manual stock update',
        '',
        currentUser
      );

      success(`Stock updated: ${qty > 0 ? '+' : ''}${qty} units of ${targetProd.name}`);
      setIsAdjustModalOpen(false);
    } catch (err: any) {
      error(err.message || 'Failed to adjust stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute map
  const invMap: { [key: string]: number } = {};
  inventories.forEach((i) => {
    invMap[`${i.storeId}_${i.productId}`] = i.quantity;
  });

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-indigo-600" />
            <span>{language === 'te' ? 'స్టోర్ ఇన్వెంటరీ & స్టాక్' : 'Store Inventory & Stock Levels'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'te'
              ? 'ప్రతి బ్రాంచ్‌లో అందుబాటులో ఉన్న నిల్వలను చూడండి మరియు నవీకరించండి'
              : 'Monitor real-time product quantities across all store locations and adjust stock'}
          </p>
        </div>

        <button
          onClick={() => openAdjustModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'te' ? '+ స్టాక్ జోడించు / సవరించు' : '+ Adjust / Add Stock'}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product name, SKU..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <StoreIcon className="w-4 h-4 text-indigo-600" />
          <select
            value={selectedStoreFilter}
            onChange={(e) => setSelectedStoreFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:outline-none"
          >
            <option value="ALL">All Store Branches</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs">Loading store stock...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6">
            <Package className="w-12 h-12 mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Packing</th>
                  <th className="py-3.5 px-4">Price</th>
                  {stores
                    .filter((s) => selectedStoreFilter === 'ALL' || s.id === selectedStoreFilter)
                    .map((s) => (
                      <th key={s.id} className="py-3.5 px-4 font-mono">
                        {s.name} ({s.code})
                      </th>
                    ))}
                  <th className="py-3.5 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      {prod.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold">
                        {prod.unit || '25 kg'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      ₹{prod.standardPrice.toFixed(2)}
                    </td>
                    {stores
                      .filter((s) => selectedStoreFilter === 'ALL' || s.id === selectedStoreFilter)
                      .map((s) => {
                        const qty = invMap[`${s.id}_${prod.id}`] ?? 0;
                        return (
                          <td key={s.id} className="py-3.5 px-4 font-mono font-bold">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs ${
                                qty > 0
                                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                  : 'text-rose-700 bg-rose-50 border border-rose-200'
                              }`}
                            >
                              {qty} {qty === 1 ? 'Bag' : 'Bags'}
                            </span>
                          </td>
                        );
                      })}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openAdjustModal(stores[0]?.id, prod.id)}
                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs transition-colors"
                      >
                        Adjust Stock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-800 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">Adjust Store Stock</h3>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Store Branch *</label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-indigo-500 focus:bg-white"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Product *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-indigo-500 focus:bg-white"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit || '25 kg'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Quantity Change in Bags (+ సంచులు జోడించు, - తీసివేయి) *
                </label>
                <input
                  type="number"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  placeholder="e.g. 50 Bags or -10 Bags"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-black text-base focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Inward arrival, Correction, Damaged stock"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : 'Apply Stock Change'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

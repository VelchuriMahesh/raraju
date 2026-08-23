import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Store as StoreIcon,
  Loader2,
  Trash2,
  X,
  Check,
  Building2,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Purchase, PurchaseItem } from '../../types/purchase';
import { Store } from '../../types/store';
import { Product } from '../../types/product';
import { getPurchases, createPurchase } from '../../services/purchaseService';
import { getStores } from '../../services/storeService';
import { getProducts } from '../../services/productService';

export const Purchases: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Item form inputs
  const [selectedProdId, setSelectedProdId] = useState('');
  const [itemQty, setItemQty] = useState('10');
  const [itemPrice, setItemPrice] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [purchasesData, storesData, prodsData] = await Promise.all([
        getPurchases(),
        getStores(true),
        getProducts(true)
      ]);
      setPurchases(purchasesData);
      setStores(storesData);
      setProducts(prodsData);

      if (storesData.length > 0 && !selectedStoreId) setSelectedStoreId(storesData[0].id);
      if (prodsData.length > 0 && !selectedProdId) {
        setSelectedProdId(prodsData[0].id);
        setItemPrice(String(prodsData[0].purchasePrice));
      }
    } catch (err: any) {
      error('Failed to load purchases: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewPurchaseModal = () => {
    setSupplierName('');
    setSupplierContact('');
    setSupplierInvoiceNumber('');
    setSelectedStoreId(stores[0]?.id || '');
    setPurchaseItems([]);
    setNotes('');
    if (products.length > 0) {
      setSelectedProdId(products[0].id);
      setItemPrice(String(products[0].purchasePrice));
      setItemQty('10');
    }
    setIsModalOpen(true);
  };

  const handleProductSelectChange = (prodId: string) => {
    setSelectedProdId(prodId);
    const p = products.find((pr) => pr.id === prodId);
    if (p) setItemPrice(String(p.purchasePrice));
  };

  const handleAddItemToPurchase = () => {
    const prod = products.find((p) => p.id === selectedProdId);
    const qty = parseInt(itemQty, 10);
    const price = parseFloat(itemPrice);

    if (!prod || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
      error('Please enter valid product, quantity, and purchase price.');
      return;
    }

    setPurchaseItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.productId === prod.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += qty;
        updated[existingIdx].purchasePrice = price;
        updated[existingIdx].total = updated[existingIdx].quantity * price;
        return updated;
      }
      return [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          quantity: qty,
          purchasePrice: price,
          total: qty * price
        }
      ];
    });

    // Reset item inputs
    setItemQty('10');
  };

  const handleRemoveItem = (prodId: string) => {
    setPurchaseItems((prev) => prev.filter((it) => it.productId !== prodId));
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!supplierName.trim()) {
      error('Supplier name is required.');
      return;
    }
    if (purchaseItems.length === 0) {
      error('Please add at least one item to this inward purchase.');
      return;
    }

    const storeObj = stores.find((s) => s.id === selectedStoreId);
    if (!storeObj) {
      error('Invalid store branch.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createPurchase(
        {
          supplierName: supplierName.trim(),
          supplierContact: supplierContact.trim(),
          supplierInvoiceNumber: supplierInvoiceNumber.trim(),
          storeId: storeObj.id,
          storeName: storeObj.name,
          items: purchaseItems,
          notes: notes.trim()
        },
        currentUser
      );

      success(`Inward purchase recorded! Stock credited to ${storeObj.name}.`);
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      error('Failed to create purchase: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPurchaseAmt = purchaseItems.reduce((sum, it) => sum + it.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <ShoppingCart className="w-6 h-6 text-brand-400" />
            <span>Supplier Purchases & Inward Stock</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Receive inward supplier goods and automatically increment store inventory balances
          </p>
        </div>

        <button
          onClick={openNewPurchaseModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Purchase</span>
        </button>
      </div>

      {/* Purchases List */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            <span className="text-xs">Loading purchase records...</span>
          </div>
        ) : purchases.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6">
            <ShoppingCart className="w-12 h-12 mb-2 text-slate-700" />
            <p className="text-sm font-semibold text-slate-400">No purchase records yet</p>
            <p className="text-xs text-slate-600 mt-1">Record purchases to replenish store inventories</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">PO Number</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4">Receiving Store</th>
                  <th className="py-3.5 px-4">Items Inwarded</th>
                  <th className="py-3.5 px-4">Total Value</th>
                  <th className="py-3.5 px-4">Created By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-brand-400">
                      {p.purchaseNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {new Date(p.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-100">
                      {p.supplierName}
                      {p.supplierInvoiceNumber && (
                        <p className="text-[10px] text-slate-500 font-mono">Inv: {p.supplierInvoiceNumber}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      {p.storeName}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.items.map((it, idx) => (
                        <div key={idx} className="text-[11px] text-slate-300">
                          {it.productName} ({it.quantity} {it.unit} @ ₹{it.purchasePrice})
                        </div>
                      ))}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-emerald-400 text-sm">
                      ₹{p.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-400">
                      {p.createdByName}
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-white">Record Inward Supplier Purchase</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPurchase} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Sona Mills Ltd"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Supplier Invoice #</label>
                  <input
                    type="text"
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-8821"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Receiving Store *</label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add Item Row */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <p className="font-bold text-slate-200">Add Products to Purchase</p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-slate-400 mb-1">Product</label>
                    <select
                      value={selectedProdId}
                      onChange={(e) => handleProductSelectChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1">Purchase Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItemToPurchase}
                      className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-md transition-colors"
                    >
                      Add Item
                    </button>
                  </div>
                </div>

                {/* Items in Cart */}
                {purchaseItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-900 space-y-1.5">
                    {purchaseItems.map((item) => (
                      <div key={item.productId} className="flex items-center justify-between p-2 rounded-xl bg-slate-900 text-xs">
                        <div>
                          <span className="font-bold text-white">{item.productName}</span>
                          <span className="text-slate-400 ml-2 font-mono">
                            ({item.quantity} {item.unit} @ ₹{item.purchasePrice})
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-emerald-400">₹{item.total.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.productId)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 text-sm font-bold text-white">
                      <span>Total Purchase Value:</span>
                      <span className="text-emerald-400 font-mono text-base">₹{totalPurchaseAmt.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Truck number, delivery receipt details..."
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
                  disabled={isSubmitting || purchaseItems.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Inwarding Stock...' : 'Save & Receive Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

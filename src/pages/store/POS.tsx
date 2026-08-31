import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Product } from '../../types/product';
import { Sale, PaymentMethod, SplitPaymentDetail, SaleCustomerInfo } from '../../types/sale';
import { subscribeToProducts, getProducts } from '../../services/productService';
import {
  subscribeToDailyAssignments,
  getDailyAssignments,
  normalizeDateString,
  getTodayDateString
} from '../../services/stockAssignmentService';
import {
  subscribeToAllInventory,
  getAllInventory,
  subscribeToStoreInventory,
  getStoreInventory
} from '../../services/inventoryService';
import { subscribeToStores, getStores } from '../../services/storeService';
import { completeSaleTransaction } from '../../services/saleService';
import { ProductGrid } from '../../components/pos/ProductGrid';
import { Cart, CartItem } from '../../components/pos/Cart';
import { PaymentModal } from '../../components/pos/PaymentModal';
import { InvoiceSuccessModal } from '../../components/pos/InvoiceSuccessModal';
import { Loader2, RefreshCw, AlertTriangle, Store as StoreIcon } from 'lucide-react';
import { getLocalData, setLocalData, INITIAL_PRODUCTS, INITIAL_INVENTORIES } from '../../services/fallbackData';
import { Store } from '../../types/store';
import { DailyStockAssignment } from '../../types/stockAssignment';
import { StoreInventory } from '../../types/inventory';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';

const parseTimestamp = (val?: string): number => {
  if (!val) return 0;
  if (/^\d{2}-\d{2}-\d{4}/.test(val)) {
    const parts = val.split('-');
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime() || 0;
  }
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
};

export const POS: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const { success, error, warning } = useToast();

  const [resolvedStore, setResolvedStore] = useState<Store | null>(() => {
    const localStores = getLocalData<Store[]>('stores', []);
    return (
      localStores.find((s) => s.id === currentUser?.storeId) ||
      localStores.find(
        (s) => s.code?.toLowerCase() === currentUser?.storeId?.toLowerCase()
      ) ||
      localStores.find(
        (s) => s.loginEmail?.toLowerCase() === currentUser?.email?.toLowerCase()
      ) ||
      localStores.find((s) => s.name?.toLowerCase().includes('krupa')) ||
      localStores[0] ||
      null
    );
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const liveStores = await getStores();
        if (cancelled) return;
        const match =
          liveStores.find((s) => s.id === currentUser?.storeId) ||
          liveStores.find(
            (s) => s.code?.toLowerCase() === currentUser?.storeId?.toLowerCase()
          ) ||
          liveStores.find(
            (s) => s.loginEmail?.toLowerCase() === currentUser?.email?.toLowerCase()
          ) ||
          liveStores.find((s) => s.name?.toLowerCase().includes('krupa')) ||
          liveStores[0] ||
          null;
        setResolvedStore(match);
        console.log('[POS STORE RESOLUTION]', {
          currentUserStoreId: currentUser?.storeId,
          matchedStoreId: match?.id,
          matchedStoreName: match?.name
        });
      } catch (e) {
        console.error('[POS STORE RESOLUTION ERROR]', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.storeId, currentUser?.email]);

  const storeId = resolvedStore?.id || currentUser?.storeId || '';
  const storeName = resolvedStore?.name || currentUser?.storeName || 'krupa';

  // Synchronous initial cache loads for zero-latency frame 1 rendering
  const [products, setProducts] = useState<Product[]>(() =>
    getLocalData<Product[]>('products', [])
  );
  const [assignments, setAssignments] = useState<DailyStockAssignment[]>(() =>
    getLocalData<DailyStockAssignment[]>('dailyStockAssignments', [])
  );
  const [inventoryList, setInventoryList] = useState<StoreInventory[]>(() =>
    getLocalData<StoreInventory[]>('inventory', [])
  );

  const [cart, setCart] = useState<CartItem[]>([]);
  const [extraAmount, setExtraAmount] = useState<number>(0);
  const [extraAmountReason, setExtraAmountReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isProcessingSale, setIsProcessingSale] = useState<boolean>(false);

  const todayDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const inventoryMap = useMemo(() => {
    const map: { [productId: string]: number } = {};
    const normToday = normalizeDateString(todayDate);

    products.forEach((prod) => {
      const dsaMatches = assignments.filter((a) => {
        if (!a) return false;
        const storeMatch =
          a.storeId === storeId ||
          (resolvedStore?.id && a.storeId === resolvedStore.id) ||
          (resolvedStore?.code && a.storeCode?.toLowerCase() === resolvedStore.code.toLowerCase()) ||
          (resolvedStore?.name && a.storeName?.toLowerCase().trim() === resolvedStore.name.toLowerCase().trim()) ||
          (currentUser?.storeId && a.storeId?.toLowerCase() === currentUser.storeId.toLowerCase()) ||
          (currentUser?.storeName && a.storeName?.toLowerCase() === currentUser.storeName.toLowerCase());

        const dateMatch =
          !a.date ||
          a.date === todayDate ||
          normalizeDateString(a.date) === normToday;

        const prodMatch =
          a.productId === prod.id ||
          (a.sku && prod.sku && a.sku.toLowerCase().trim() === prod.sku.toLowerCase().trim()) ||
          (a.productName && prod.name && a.productName.toLowerCase().trim() === prod.name.toLowerCase().trim());

        return storeMatch && dateMatch && prodMatch;
      });

      let dsaStock: number | null = null;
      if (dsaMatches.length > 0) {
        dsaMatches.sort((a, b) => {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return timeB - timeA;
        });
        const match = dsaMatches[0];
        dsaStock = match.remainingQuantity !== undefined ? match.remainingQuantity : match.assignedQuantity;
      }

      const invMatch = inventoryList.find((i) => {
        if (!i) return false;
        const storeMatch =
          i.storeId === storeId ||
          (resolvedStore?.id && i.storeId === resolvedStore.id) ||
          (currentUser?.storeId && i.storeId?.toLowerCase() === currentUser.storeId.toLowerCase());
        const prodMatch =
          i.productId === prod.id ||
          (i.sku && prod.sku && i.sku.toLowerCase().trim() === prod.sku.toLowerCase().trim());
        return storeMatch && prodMatch;
      });
      const invStock = invMatch?.quantity ?? null;

      const resolvedQty = dsaStock !== null ? dsaStock : invStock !== null ? invStock : 0;
      map[prod.id] = Math.max(0, Number(resolvedQty) || 0);
    });

    console.log('[POS INVENTORY FINAL STATE]', {
      storeId,
      storeName,
      todayDate,
      stockMap: map,
      assignmentsCount: assignments.length,
      assignments
    });

    return map;
  }, [products, assignments, inventoryList, storeId, storeName, todayDate, resolvedStore, currentUser]);

  const refreshData = useCallback(async () => {
    if (!storeId) return;
    try {
      setFirestoreError(null);
      const liveAssignments = await getDailyAssignments(todayDate, storeId);
      setAssignments(liveAssignments);
      // NOTE: do not setLocalData here. getDailyAssignments already caches the full
      // collection; writing this store/date-filtered subset back used to erase every
      // other row from the shared cache (and wiped it entirely when the query was empty).
    } catch (e: any) {
      console.error('[POS INVENTORY FETCH ERROR]', e);
      if (e?.code === 'permission-denied') {
        setFirestoreError('Database permission denied: Unable to access store inventory.');
      }
    }

    try {
      const liveInvs = await getStoreInventory(storeId);
      setInventoryList(liveInvs);
      // Merge (never replace) so this store's rows do not evict other stores' cache entries.
      const cachedInvs = getLocalData<StoreInventory[]>('inventory', []);
      setLocalData('inventory', [
        ...liveInvs,
        ...cachedInvs.filter((c) => !liveInvs.some((l) => l.id === c.id))
      ]);
    } catch (e) {
      console.error('[POS INVENTORY DOCS ERROR]', e);
    }

    try {
      const prodsSnap = await getProducts(true);
      if (prodsSnap && prodsSnap.length > 0) setProducts(prodsSnap);
    } catch (e) {}
  }, [storeId, todayDate]);

  useEffect(() => {
    const unsubProds = subscribeToProducts((liveProds) => setProducts(liveProds), true);

    // Scope the live feed to THIS store and TODAY, otherwise the cashier's stock map is
    // built from every store's and every date's assignment rows.
    const unsubAssignments = subscribeToDailyAssignments(
      (items) => {
        setAssignments(items);
      },
      todayDate,
      storeId || undefined
    );

    let unsubInvs = () => {};
    if (storeId) {
      unsubInvs = subscribeToStoreInventory(storeId, (items) => {
        setInventoryList(items);
      });
    }

    refreshData();

    return () => {
      unsubProds();
      unsubAssignments();
      unsubInvs();
    };
  }, [storeId, todayDate, refreshData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => {
      setIsRefreshing(false);
      success('Live store stock refreshed.');
    }, 300);
  };

  const handleAddToCart = (product: Product) => {
    const recordedStock = inventoryMap[product.id];
    const availableStock = recordedStock !== undefined ? recordedStock : 0;

    if (availableStock <= 0) {
      warning(`Product "${product.name}" has 0 stock available. Please assign stock in Daily Stock Assign.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= availableStock) {
          warning(`Only ${availableStock} ${availableStock === 1 ? 'Bag' : 'Bags'} available in store stock.`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          actualPrice: product.standardPrice,
          customerRateApplied: false,
          discount: 0
        }
      ];
    });
  };

  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }
    const recordedStock = inventoryMap[productId] ?? 0;

    if (newQty > recordedStock) {
      warning(`Only ${recordedStock} Bags available in store stock.`);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setExtraAmount(0);
    setExtraAmountReason('');
  };

  const handleCompleteSale = async (paymentData: {
    paymentMethod: PaymentMethod;
    splitPayments?: SplitPaymentDetail[];
    amountPaid: number;
    customer?: SaleCustomerInfo;
    notes?: string;
  }) => {
    if (!currentUser) {
      error('User session not active.');
      return;
    }

    setIsProcessingSale(true);
    try {
      const payload = {
        storeId,
        storeName,
        customer: paymentData.customer,
        items: cart.map((it) => ({
          productId: it.product.id,
          productName: it.product.name,
          sku: it.product.sku,
          unit: it.product.unit || 'Bag',
          quantity: it.quantity,
          standardPrice: it.product.standardPrice,
          actualPrice: it.actualPrice,
          customerRateApplied: false,
          discount: 0
        })),
        extraAmount,
        extraAmountReason,
        paymentMethod: paymentData.paymentMethod,
        splitPayments: paymentData.splitPayments,
        amountPaid: paymentData.amountPaid,
        notes: paymentData.notes
      };

      const sale = await completeSaleTransaction(payload, currentUser);
      setCompletedSale(sale);
      setShowPaymentModal(false);
      setCart([]);
      setExtraAmount(0);
      setExtraAmountReason('');

      // Deduct sold quantity from local assignments state immediately
      setAssignments((prev) =>
        prev.map((a) => {
          const soldItem = cart.find((c) => c.product.id === a.productId);
          if (soldItem) {
            const sold = (a.soldQuantity || 0) + soldItem.quantity;
            const remaining = Math.max(0, a.assignedQuantity - sold);
            return { ...a, soldQuantity: sold, remainingQuantity: remaining };
          }
          return a;
        })
      );

      // Deduct sold quantity from local inventory list immediately
      setInventoryList((prev) =>
        prev.map((i) => {
          const soldItem = cart.find((c) => c.product.id === i.productId);
          if (soldItem) {
            const newQty = Math.max(0, i.quantity - soldItem.quantity);
            return { ...i, quantity: newQty };
          }
          return i;
        })
      );

      if ((sale as any)?._cloudSyncWarning) {
        warning(`Sale saved locally as #${sale.invoiceNumber}. Note: Cloud sync pending (${(sale as any)._cloudSyncWarning}).`);
      } else {
        success(`Sale completed successfully! Invoice #${sale.invoiceNumber}`);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      error(err.message || 'Failed to complete sale transaction.');
    } finally {
      setIsProcessingSale(false);
    }
  };

  const handleNewBill = () => {
    setCompletedSale(null);
    setCart([]);
    setExtraAmount(0);
    setExtraAmountReason('');
  };

  let cartSubtotal = 0;
  for (const it of cart) {
    cartSubtotal += it.actualPrice * it.quantity;
  }
  const cartGrandTotal = Math.round((cartSubtotal + extraAmount) * 100) / 100;

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-sm font-bold text-slate-700">Loading store POS terminal...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col lg:flex-row gap-4 pb-2">
      {/* Left Column: Product Search & Grid */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {firestoreError && (
          <div className="mb-2 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{firestoreError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 font-bold text-xs">
              <StoreIcon className="w-3.5 h-3.5" />
              <span>Store: {storeName || 'Store Branch'} ({resolvedStore?.code || 'S1'})</span>
            </div>

            <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">
              ({products.length} catalog items)
            </span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-indigo-600 font-bold bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync Live Stock</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          <ProductGrid
            products={products}
            inventoryMap={inventoryMap}
            onAddToCart={handleAddToCart}
          />
        </div>
      </div>

      {/* Right Column: Checkout Cart & Extra Amount Entry */}
      <div className="w-full lg:w-96 flex flex-col h-full">
        <Cart
          items={cart}
          inventoryMap={inventoryMap}
          extraAmount={extraAmount}
          extraAmountReason={extraAmountReason}
          onUpdateExtraAmount={(amount: number, reason: string) => {
            setExtraAmount(amount);
            setExtraAmountReason(reason);
          }}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onOpenCheckout={() => setShowPaymentModal(true)}
        />
      </div>

      {/* Payment Processing Modal */}
      {showPaymentModal && (
        <PaymentModal
          grandTotal={cartGrandTotal}
          extraAmount={extraAmount}
          extraAmountReason={extraAmountReason}
          isProcessing={isProcessingSale}
          onComplete={handleCompleteSale}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* Post-Sale Thermal Invoice Modal */}
      {completedSale && (
        <InvoiceSuccessModal
          sale={completedSale}
          onNewBill={handleNewBill}
        />
      )}
    </div>
  );
};

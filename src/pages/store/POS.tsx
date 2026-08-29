import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Product } from '../../types/product';
import { Sale, PaymentMethod, SplitPaymentDetail, SaleCustomerInfo } from '../../types/sale';
import { subscribeToProducts, getProducts } from '../../services/productService';
import {
  subscribeToStoreInventory,
  getStoreInventory
} from '../../services/inventoryService';
import { completeSaleTransaction } from '../../services/saleService';
import { ProductGrid } from '../../components/pos/ProductGrid';
import { Cart, CartItem } from '../../components/pos/Cart';
import { PaymentModal } from '../../components/pos/PaymentModal';
import { InvoiceSuccessModal } from '../../components/pos/InvoiceSuccessModal';
import { Loader2, RefreshCw, AlertTriangle, Store as StoreIcon } from 'lucide-react';
import { StoreInventory } from '../../types/inventory';
import { auth, firebaseProjectId } from '../../services/firebase';

export const POS: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error, warning } = useToast();

  const storeId = currentUser?.storeId || '';
  const storeName = currentUser?.storeName || 'Store Branch';

  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryList, setInventoryList] = useState<StoreInventory[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [extraAmount, setExtraAmount] = useState<number>(0);
  const [extraAmountReason, setExtraAmountReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isProcessingSale, setIsProcessingSale] = useState<boolean>(false);

  const inventoryMap = useMemo(() => {
    const liveInventoryByProduct = new Map<string, number>();
    inventoryList.forEach((item) => {
      liveInventoryByProduct.set(item.productId, Math.max(0, Number(item.quantity) || 0));
    });

    const map: { [productId: string]: number } = {};
    products.forEach((prod) => {
      map[prod.id] = liveInventoryByProduct.get(prod.id) ?? 0;
    });

    return map;
  }, [products, inventoryList]);

  useEffect(() => {
    if (!storeId) return;

    console.info('[STORE POS READ]', {
      firebaseProject: firebaseProjectId,
      authenticatedUid: auth.currentUser?.uid || currentUser?.id,
      storeId,
      listener: 'CONNECTED',
      inventoryRows: inventoryList.map((item) => ({
        productId: item.productId,
        firestoreQuantity: item.quantity
      }))
    });
  }, [storeId, inventoryList, currentUser?.id]);

  const refreshData = useCallback(async () => {
    if (!storeId) {
      setFirestoreError('This store user is not assigned to a canonical store ID.');
      setLoading(false);
      return;
    }

    try {
      setFirestoreError(null);
      const [liveInventory, liveProducts] = await Promise.all([
        getStoreInventory(storeId),
        getProducts(true)
      ]);
      setInventoryList(liveInventory);
      setProducts(liveProducts);
    } catch (e: any) {
      console.error('[POS FIRESTORE REFRESH ERROR]', e);
      setFirestoreError(e?.message || 'Unable to read live store inventory from Firestore.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!storeId) {
      setFirestoreError('This store user is not assigned to a canonical store ID.');
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setFirestoreError(null);

    const unsubProds = subscribeToProducts((liveProds) => {
      setProducts(liveProds);
      setLoading(false);
    }, true);

    const unsubInvs = subscribeToStoreInventory(
      storeId,
      (items) => {
        setInventoryList(items);
        setLoading(false);
      },
      (err) => {
        setFirestoreError(err.message || 'Unable to subscribe to live store inventory.');
        setLoading(false);
      }
    );

    refreshData();

    return () => {
      unsubProds();
      unsubInvs();
    };
  }, [storeId, refreshData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => {
      setIsRefreshing(false);
      success('Live store stock refreshed.');
    }, 300);
  };

  const handleAddToCart = (product: Product) => {
    const availableStock = inventoryMap[product.id] ?? 0;

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
    if (!storeId) {
      error('This store user is not assigned to a canonical store ID.');
      return;
    }
    if (cart.length === 0) {
      warning('Cart is empty.');
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
      success(`Sale completed successfully! Invoice #${sale.invoiceNumber}`);
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
              <span>Store: {storeName} ({storeId || 'Unassigned'})</span>
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

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
  onSnapshot
} from 'firebase/firestore';
import { db, stripUndefined } from './firebase';
import { Sale, SaleItem, PaymentMethod, SplitPaymentDetail, SaleCustomerInfo } from '../types/sale';
import { StockMovement } from '../types/inventory';
import { UserProfile } from '../types/auth';
import { Store } from '../types/store';
import { logAudit } from './auditService';
import { getInventoryDocId } from './inventoryService';
import { sendNotification } from './notificationService';
import { recordSaleInDailyAssignment } from './stockAssignmentService';
import { INITIAL_SALES, getLocalData, setLocalData, INITIAL_INVENTORIES } from './fallbackData';

const SALES_COLLECTION = 'sales';
const INVENTORY_COLLECTION = 'inventory';
const MOVEMENTS_COLLECTION = 'stockMovements';
const COUNTERS_COLLECTION = 'counters';
const STORES_COLLECTION = 'stores';

export interface CheckoutPayload {
  storeId: string;
  storeName: string;
  items: {
    productId: string;
    productName: string;
    sku: string;
    unit: string;
    quantity: number;
    standardPrice: number;
    actualPrice: number;
    customerRateApplied: boolean;
    customerRateReason?: string;
    discount?: number;
  }[];
  paymentMethod: PaymentMethod;
  splitPayments?: SplitPaymentDetail[];
  amountPaid?: number;
  customer?: SaleCustomerInfo;
  extraAmount?: number;
  extraAmountReason?: string;
  notes?: string;
}

/**
 * Normalizes legacy sales so "Main Branch" is converted to the active branch name
 */
const normalizeSalesData = (rawSales: Sale[]): Sale[] => {
  const stores = getLocalData<Store[]>(STORES_COLLECTION, []);
  const defaultStore = stores[0];

  return rawSales.map((s) => {
    let storeName = s.storeName;
    let storeId = s.storeId;

    if (
      !storeName ||
      storeName.includes('Main Branch') ||
      storeName.includes('ప్రధాన బ్రాంచ్') ||
      storeId === 'store_1_main' ||
      storeName === 'Store Branch'
    ) {
      if (defaultStore) {
        storeName = defaultStore.name;
        storeId = defaultStore.id;
      } else {
        storeName = 'krupa';
        storeId = 's1';
      }
    }

    return {
      ...s,
      storeName,
      storeId
    };
  });
};

export const completeSaleTransaction = async (
  payload: CheckoutPayload,
  user: UserProfile
): Promise<Sale> => {
  const {
    storeId,
    storeName,
    items,
    paymentMethod,
    splitPayments,
    amountPaid,
    customer,
    extraAmount = 0,
    extraAmountReason,
    notes
  } = payload;

  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];
  let generatedInvoiceNumber = '';
  let completedSale: Sale | null = null;

  try {
    const saleDocRef = doc(collection(db, SALES_COLLECTION));
    const counterRef = doc(db, COUNTERS_COLLECTION, `invoice_${storeId}`);
    const storeRef = doc(db, STORES_COLLECTION, storeId);

    await runTransaction(db, async (transaction) => {
      // 1. ALL READS FIRST
      const counterSnap = await transaction.get(counterRef);
      const storeSnap = await transaction.get(storeRef);

      const invSnaps: { [productId: string]: { ref: any; currentQty: number; lastPrice: number } } = {};
      for (const item of items) {
        const invDocId = getInventoryDocId(storeId, item.productId);
        const invRef = doc(db, INVENTORY_COLLECTION, invDocId);
        const snap = await transaction.get(invRef);
        invSnaps[item.productId] = {
          ref: invRef,
          currentQty: snap.exists() ? snap.data().quantity || 0 : 0,
          lastPrice: snap.exists() ? snap.data().lastPurchasePrice || 0 : item.standardPrice * 0.8
        };
      }

      // Sequential Invoice Number
      let nextSeq = 1;
      if (counterSnap.exists()) {
        nextSeq = (counterSnap.data().lastNumber || 0) + 1;
      }
      const invoicePrefix = storeSnap.exists() ? storeSnap.data().invoicePrefix || 'S1-' : 'S1-';
      generatedInvoiceNumber = `${invoicePrefix}${String(nextSeq).padStart(6, '0')}`;

      // 2. ALL WRITES AFTER READS
      transaction.set(counterRef, { lastNumber: nextSeq }, { merge: true });

      const saleItems: SaleItem[] = [];
      let subtotal = 0;
      let totalDiscount = 0;
      let totalCustomerRateDifference = 0;
      let totalCOGS = 0;

      for (const item of items) {
        const invInfo = invSnaps[item.productId];
        const newQty = Math.max(0, invInfo.currentQty - item.quantity);

        transaction.set(
          invInfo.ref,
          {
            quantity: newQty,
            updatedAt: now
          },
          { merge: true }
        );

        // Record stock movement ledger
        const movementRef = doc(collection(db, MOVEMENTS_COLLECTION));
        const movement: StockMovement = {
          id: movementRef.id,
          storeId,
          storeName,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          type: 'SALE',
          quantity: -item.quantity,
          previousQuantity: invInfo.currentQty,
          newQuantity: newQty,
          referenceId: generatedInvoiceNumber,
          userId: user.id,
          userName: user.fullName,
          userRole: user.role,
          timestamp: now
        };
        transaction.set(movementRef, stripUndefined(movement));

        const itemActualPrice = item.actualPrice;
        const discount = item.discount || 0;
        const itemSubtotal = itemActualPrice * item.quantity - discount;
        const itemTotal = itemSubtotal;
        const rateDiff = (itemActualPrice - item.standardPrice) * item.quantity;

        subtotal += itemSubtotal;
        totalDiscount += discount;
        totalCustomerRateDifference += rateDiff;
        totalCOGS += invInfo.lastPrice * item.quantity;

        saleItems.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          unit: item.unit,
          quantity: item.quantity,
          purchasePrice: invInfo.lastPrice,
          standardPrice: item.standardPrice,
          actualPrice: itemActualPrice,
          rateDifference: itemActualPrice - item.standardPrice,
          customerRateApplied: item.customerRateApplied,
          customerRateReason: item.customerRateReason,
          gstRate: 0,
          gstAmount: 0,
          discount,
          total: itemTotal
        });
      }

      const grandTotal = subtotal + extraAmount;
      const grossProfit = grandTotal - totalCOGS;
      const changeDue = Math.max(0, (amountPaid || grandTotal) - grandTotal);

      completedSale = {
        id: saleDocRef.id,
        invoiceNumber: generatedInvoiceNumber,
        storeId,
        storeName,
        employeeId: user.employeeId || 'STAFF',
        employeeName: user.fullName,
        customer,
        items: saleItems,
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
        subtotal,
        totalGst: 0,
        totalDiscount,
        totalCustomerRateDifference,
        extraAmount,
        extraAmountReason,
        grandTotal,
        totalCostOfGoodsSold: totalCOGS,
        grossProfit,
        paymentMethod,
        splitPayments: paymentMethod === 'SPLIT' ? splitPayments : undefined,
        amountPaid: amountPaid !== undefined ? amountPaid : grandTotal,
        changeDue,
        status: 'COMPLETED',
        notes,
        createdAt: now
      };

      // stripUndefined: `customer`, `notes` and `splitPayments` are optional, and an
      // undefined field aborts the whole Firestore write.
      transaction.set(saleDocRef, stripUndefined(completedSale));
    });
  } catch (error) {
    console.warn('Firestore runTransaction notice, executing direct write fallback:', error);

    const saleId = `sale_${Date.now()}`;
    const allStores = getLocalData<Store[]>(STORES_COLLECTION, []);
    const storeObj = allStores.find((s) => s.id === storeId);
    const storeNameStr = storeObj ? storeObj.name : storeName || 'krupa';
    const prefix = storeObj?.invoicePrefix || 'S1-';
    generatedInvoiceNumber = `${prefix}${String(Date.now()).slice(-6)}`;

    let subtotal = 0;
    const saleItems: SaleItem[] = [];
    const allInvs = getLocalData<any[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES);

    for (const reqItem of items) {
      const actualPrice = reqItem.actualPrice;
      const discount = reqItem.discount || 0;
      const itemSubtotal = actualPrice * reqItem.quantity - discount;
      subtotal += itemSubtotal;

      saleItems.push({
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: reqItem.productId,
        productName: reqItem.productName,
        sku: reqItem.sku,
        unit: reqItem.unit,
        quantity: reqItem.quantity,
        purchasePrice: reqItem.standardPrice * 0.8,
        standardPrice: reqItem.standardPrice,
        actualPrice,
        rateDifference: actualPrice - reqItem.standardPrice,
        customerRateApplied: reqItem.customerRateApplied,
        customerRateReason: reqItem.customerRateReason,
        gstRate: 0,
        gstAmount: 0,
        discount,
        total: itemSubtotal
      });

      const invDocId = getInventoryDocId(storeId, reqItem.productId);
      const targetInv = allInvs.find(
        (i) => i.id === invDocId || (i.storeId === storeId && i.productId === reqItem.productId)
      );
      if (targetInv) {
        targetInv.quantity = Math.max(0, targetInv.quantity - reqItem.quantity);
      }
    }

    setLocalData(INVENTORY_COLLECTION, allInvs);
    const grandTotal = subtotal + extraAmount;

    completedSale = {
      id: saleId,
      invoiceNumber: generatedInvoiceNumber,
      storeId,
      storeName: storeNameStr,
      employeeId: user.employeeId || 'STAFF',
      employeeName: user.fullName,
      customer,
      items: saleItems,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal,
      totalGst: 0,
      totalDiscount: 0,
      totalCustomerRateDifference: 0,
      extraAmount,
      extraAmountReason,
      grandTotal,
      totalCostOfGoodsSold: subtotal * 0.8,
      grossProfit: subtotal * 0.2,
      paymentMethod,
      splitPayments,
      amountPaid: amountPaid !== undefined ? amountPaid : grandTotal,
      changeDue: Math.max(0, (amountPaid || grandTotal) - grandTotal),
      status: 'COMPLETED',
      notes,
      createdAt: now
    };
  }

  let cloudSaleError: any = null;
  if (completedSale) {
    // Cloud setDoc. This is the only place the invoice becomes visible to head office,
    // so a failure here is reported rather than swallowed.
    try {
      await setDoc(doc(db, SALES_COLLECTION, completedSale.id), stripUndefined(completedSale));
    } catch (e: any) {
      console.error('Firestore sale write FAILED (invoice saved locally only):', e);
      cloudSaleError = e;
    }

    // Update local storage with normalized names
    const allSales = normalizeSalesData(getLocalData<Sale[]>(SALES_COLLECTION, INITIAL_SALES));
    const updated = [completedSale, ...allSales.filter((s) => s.id !== completedSale!.id)];
    setLocalData(SALES_COLLECTION, updated);

    // Broadcast event
    try {
      window.dispatchEvent(new CustomEvent('raraju_sales_updated', { detail: completedSale }));
    } catch (e) {}

    // Daily stock ledger update
    for (const soldItem of completedSale.items) {
      try {
        await recordSaleInDailyAssignment(
          dateStr,
          completedSale.storeId,
          soldItem.productId,
          soldItem.quantity
        );
      } catch (err) {}
    }

    const itemsSummary = completedSale.items.map((i) => `${i.productName} × ${i.quantity}`).join(', ');

    // Send Notification to Admin
    try {
      await sendNotification({
        recipientRole: 'SUPER_ADMIN',
        type: 'SALE_COMPLETED',
        title: `Sale at ${completedSale.storeName}`,
        titleTe: `${completedSale.storeName} వద్ద అమ్మకం జరిగింది`,
        message: `${completedSale.employeeName} collected ₹${completedSale.grandTotal.toFixed(2)} via ${completedSale.paymentMethod} (Bill #${completedSale.invoiceNumber}) - ${itemsSummary}`,
        messageTe: `${completedSale.employeeName} ${completedSale.paymentMethod} ద్వారా ₹${completedSale.grandTotal.toFixed(2)} వసూలు చేశారు (బిల్ #${completedSale.invoiceNumber}) - ${itemsSummary}`,
        storeId: completedSale.storeId,
        storeName: completedSale.storeName,
        amount: completedSale.grandTotal,
        paymentMethod: completedSale.paymentMethod,
        invoiceNumber: completedSale.invoiceNumber
      });
    } catch (notifErr) {}

    // Send Notification to Storekeeper
    try {
      await sendNotification({
        recipientRole: 'STORE_STAFF',
        storeId: completedSale.storeId,
        storeName: completedSale.storeName,
        type: 'SALE_COMPLETED',
        title: `Sale Completed #${completedSale.invoiceNumber}`,
        titleTe: `అమ్మకం పూర్తయింది #${completedSale.invoiceNumber}`,
        message: `Collected ₹${completedSale.grandTotal.toFixed(2)} via ${completedSale.paymentMethod} (${itemsSummary})`,
        messageTe: `${completedSale.paymentMethod} ద్వారా ₹${completedSale.grandTotal.toFixed(2)} వసూలు చేయబడింది (${itemsSummary})`,
        amount: completedSale.grandTotal,
        paymentMethod: completedSale.paymentMethod,
        invoiceNumber: completedSale.invoiceNumber
      });
    } catch (notifErr) {}
  }

  if (cloudSaleError && completedSale) {
    (completedSale as any)._cloudSyncWarning = cloudSaleError.code || cloudSaleError.message || 'permission-denied';
    console.warn(`[SALE CLOUD SYNC NOTICE] Bill ${completedSale.invoiceNumber} saved locally:`, cloudSaleError);
  }

  return completedSale!;
};

export const getSales = async (
  storeIdFilter?: string,
  startDate?: string,
  endDate?: string,
  limitCount = 100
): Promise<Sale[]> => {
  try {
    // where('storeId') + orderBy('createdAt') needs a composite index; without one the
    // query threw and every caller silently fell back to the stale local cache.
    const q = storeIdFilter
      ? query(collection(db, SALES_COLLECTION), where('storeId', '==', storeIdFilter))
      : query(collection(db, SALES_COLLECTION), orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const raw = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
      let sales = normalizeSalesData(raw).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      // Cache the unfiltered result only, so one store's view cannot evict the rest.
      if (!storeIdFilter) setLocalData(SALES_COLLECTION, sales);
      if (startDate) sales = sales.filter((s) => s.createdAt >= startDate);
      if (endDate) sales = sales.filter((s) => s.createdAt <= endDate);
      return sales.slice(0, limitCount);
    }
  } catch (error) {
    console.warn('Firestore getSales notice, using local cache:', error);
  }

  let sales = normalizeSalesData(getLocalData<Sale[]>(SALES_COLLECTION, INITIAL_SALES));
  if (storeIdFilter) sales = sales.filter((s) => s.storeId === storeIdFilter);
  if (startDate) sales = sales.filter((s) => s.createdAt >= startDate);
  if (endDate) sales = sales.filter((s) => s.createdAt <= endDate);
  return sales.slice(0, limitCount);
};

export const syncLocalSalesToCloud = async (): Promise<void> => {
  try {
    const rawSales = getLocalData<Sale[]>(SALES_COLLECTION, []);
    const localSales = normalizeSalesData(rawSales);
    if (!localSales || localSales.length === 0) return;

    for (const s of localSales) {
      try {
        const saleDocRef = doc(db, SALES_COLLECTION, s.id);
        await setDoc(saleDocRef, s, { merge: true });
      } catch (e) {}
    }
  } catch (err) {}
};

export const subscribeToSales = (
  callback: (sales: Sale[]) => void,
  storeIdFilter?: string
): (() => void) => {
  // 1. Initial emission from local storage
  const localSales = normalizeSalesData(getLocalData<Sale[]>(SALES_COLLECTION, INITIAL_SALES));
  callback(storeIdFilter ? localSales.filter((s) => s.storeId === storeIdFilter) : localSales);

  syncLocalSalesToCloud();

  // 2. Cross-tab storage listener
  const handleUpdate = () => {
    const updated = normalizeSalesData(getLocalData<Sale[]>(SALES_COLLECTION, INITIAL_SALES));
    callback(storeIdFilter ? updated.filter((s) => s.storeId === storeIdFilter) : updated);
  };

  window.addEventListener('storage', handleUpdate);
  window.addEventListener('raraju_sales_updated', handleUpdate);

  // 3. Firestore live snapshot listener
  let unsubscribeFirestore = () => {};
  try {
    unsubscribeFirestore = onSnapshot(
      collection(db, SALES_COLLECTION),
      (snapshot) => {
        if (!snapshot.empty) {
          const raw = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Sale));
          raw.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          const firestoreSales = normalizeSalesData(raw);
          setLocalData(SALES_COLLECTION, firestoreSales);
          callback(storeIdFilter ? firestoreSales.filter((s) => s.storeId === storeIdFilter) : firestoreSales);
        } else {
          const local = normalizeSalesData(getLocalData<Sale[]>(SALES_COLLECTION, []));
          callback(storeIdFilter ? local.filter((s) => s.storeId === storeIdFilter) : local);
        }
      },
      (error) => {
        console.warn('Firestore subscribeToSales notice:', error);
        const local = normalizeSalesData(getLocalData<Sale[]>(SALES_COLLECTION, []));
        callback(storeIdFilter ? local.filter((s) => s.storeId === storeIdFilter) : local);
      }
    );
  } catch (err) {}

  return () => {
    window.removeEventListener('storage', handleUpdate);
    window.removeEventListener('raraju_sales_updated', handleUpdate);
    unsubscribeFirestore();
  };
};

export const getSaleById = async (saleId: string): Promise<Sale | null> => {
  try {
    const docRef = doc(db, SALES_COLLECTION, saleId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const [normalized] = normalizeSalesData([{ id: snap.id, ...snap.data() } as Sale]);
      return normalized;
    }
  } catch (error) {
    console.warn(`Firestore getSaleById notice (${saleId}), using local cache:`, error);
  }

  const sales = normalizeSalesData(getLocalData<Sale[]>(SALES_COLLECTION, INITIAL_SALES));
  return sales.find((s) => s.id === saleId) || null;
};

export const cancelSale = async (
  saleId: string,
  reason: string,
  adminUser: UserProfile,
  restoreStock = true
): Promise<void> => {
  const now = new Date().toISOString();
  try {
    const saleRef = doc(db, SALES_COLLECTION, saleId);
    const saleSnap = await getDoc(saleRef);
    if (saleSnap.exists()) {
      const saleData = saleSnap.data() as Sale;
      await updateDoc(saleRef, {
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledBy: adminUser.fullName,
        cancelledAt: now
      });

      if (restoreStock && saleData.items) {
        for (const item of saleData.items) {
          const invDocId = getInventoryDocId(saleData.storeId, item.productId);
          const invRef = doc(db, INVENTORY_COLLECTION, invDocId);
          const invSnap = await getDoc(invRef);
          if (invSnap.exists()) {
            const current = invSnap.data().quantity || 0;
            await updateDoc(invRef, {
              quantity: current + item.quantity,
              updatedAt: now
            });
          }
        }
      }

      await logAudit(
        adminUser.id,
        adminUser.fullName,
        adminUser.role,
        'SALE_CANCELLED',
        'Sales',
        `Cancelled Invoice #${saleData.invoiceNumber} (${saleData.storeName}) for ₹${saleData.grandTotal}. Reason: ${reason}`,
        {
          entityId: saleId,
          storeId: saleData.storeId,
          storeName: saleData.storeName,
          oldValue: 'COMPLETED',
          newValue: 'CANCELLED'
        }
      );
    }
  } catch (err) {
    console.warn('Firestore cancelSale notice, updating local cache:', err);
  }

  const sales = getLocalData<Sale[]>(SALES_COLLECTION, INITIAL_SALES);
  const updated = sales.map((s) => (s.id === saleId ? { ...s, status: 'CANCELLED' as const } : s));
  setLocalData(SALES_COLLECTION, updated);
  try {
    window.dispatchEvent(new CustomEvent('raraju_sales_updated'));
  } catch (e) {}
};

export const deleteSale = async (
  saleId: string,
  adminUser: UserProfile,
  restoreStock = true
): Promise<void> => {
  try {
    const saleRef = doc(db, SALES_COLLECTION, saleId);
    const saleSnap = await getDoc(saleRef);
    if (saleSnap.exists()) {
      const saleData = saleSnap.data() as Sale;

      if (restoreStock && saleData.items) {
        for (const item of saleData.items) {
          const invDocId = getInventoryDocId(saleData.storeId, item.productId);
          const invRef = doc(db, INVENTORY_COLLECTION, invDocId);
          const invSnap = await getDoc(invRef);
          if (invSnap.exists()) {
            const current = invSnap.data().quantity || 0;
            await updateDoc(invRef, {
              quantity: current + item.quantity,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      await deleteDoc(saleRef);

      await logAudit(
        adminUser.id,
        adminUser.fullName,
        adminUser.role,
        'SALE_DELETED',
        'Sales',
        `Permanently Deleted Invoice #${saleData.invoiceNumber} (${saleData.storeName}) for ₹${saleData.grandTotal}`,
        {
          entityId: saleId,
          storeId: saleData.storeId,
          storeName: saleData.storeName,
          oldValue: saleData
        }
      );
    }
  } catch (err) {
    console.warn('Firestore deleteSale notice, updating local cache:', err);
  }

  const sales = getLocalData<Sale[]>(SALES_COLLECTION, INITIAL_SALES);
  const updated = sales.filter((s) => s.id !== saleId);
  setLocalData(SALES_COLLECTION, updated);
  try {
    window.dispatchEvent(new CustomEvent('raraju_sales_updated'));
  } catch (e) {}
};

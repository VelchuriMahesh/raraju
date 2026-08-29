import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { Sale, SaleItem, PaymentMethod, SplitPaymentDetail, SaleCustomerInfo } from '../types/sale';
import { StockMovement } from '../types/inventory';
import { UserProfile } from '../types/auth';
import { logAudit } from './auditService';
import { getInventoryDocId } from './inventoryService';
import { sendNotification } from './notificationService';
import { getAssignmentDocId, getTodayDateString, normalizeDateString } from './stockAssignmentService';

const SALES_COLLECTION = 'sales';
const INVENTORY_COLLECTION = 'inventory';
const MOVEMENTS_COLLECTION = 'stockMovements';
const COUNTERS_COLLECTION = 'counters';
const STORES_COLLECTION = 'stores';
const ASSIGNMENTS_COLLECTION = 'dailyStockAssignments';

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

const toSale = (id: string, data: any): Sale => ({
  id,
  ...(data as Omit<Sale, 'id'>)
});

const sortSales = (sales: Sale[]): Sale[] =>
  [...sales].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

const assertCanUseStore = (storeId: string, user: UserProfile) => {
  if (!storeId) throw new Error('A canonical store ID is required before completing a sale.');
  if (user.role !== 'SUPER_ADMIN' && user.storeId !== storeId) {
    throw new Error('This user is not authorized to sell from the selected store.');
  }
};

const assertValidSaleItems = (items: CheckoutPayload['items']) => {
  if (!items || items.length === 0) {
    throw new Error('Cannot complete a sale with an empty cart.');
  }

  items.forEach((item) => {
    if (!item.productId) throw new Error('Every sale item must contain a product ID.');
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error(`Invalid quantity for "${item.productName}".`);
    }
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

  assertCanUseStore(storeId, user);
  assertValidSaleItems(items);

  const now = new Date().toISOString();
  const businessDate = getTodayDateString();
  const saleDocRef = doc(collection(db, SALES_COLLECTION));
  const counterRef = doc(db, COUNTERS_COLLECTION, `invoice_${storeId}`);
  const storeRef = doc(db, STORES_COLLECTION, storeId);

  let generatedInvoiceNumber = '';

  const completedSale = await runTransaction(db, async (transaction): Promise<Sale> => {
    const counterSnap = await transaction.get(counterRef);
    const storeSnap = await transaction.get(storeRef);

    const invSnaps: {
      [productId: string]: {
        ref: ReturnType<typeof doc>;
        currentQty: number;
        lastPrice: number;
      };
    } = {};
    const assignmentSnaps: {
      [productId: string]: {
        ref: ReturnType<typeof doc>;
        assignedQuantity: number;
        soldQuantity: number;
        exists: boolean;
      };
    } = {};

    for (const item of items) {
      const invDocId = getInventoryDocId(storeId, item.productId);
      const invRef = doc(db, INVENTORY_COLLECTION, invDocId);
      const invSnap = await transaction.get(invRef);
      const currentQty = invSnap.exists() ? Number(invSnap.data().quantity || 0) : 0;

      if (!invSnap.exists() || currentQty < item.quantity) {
        throw new Error(
          `Insufficient stock for "${item.productName}". Available: ${currentQty}, requested: ${item.quantity}.`
        );
      }

      invSnaps[item.productId] = {
        ref: invRef,
        currentQty,
        lastPrice: invSnap.exists() ? Number(invSnap.data().lastPurchasePrice || 0) : item.standardPrice * 0.8
      };

      const assignmentDocId = getAssignmentDocId(businessDate, storeId, item.productId);
      const assignmentRef = doc(db, ASSIGNMENTS_COLLECTION, assignmentDocId);
      const assignmentSnap = await transaction.get(assignmentRef);
      assignmentSnaps[item.productId] = {
        ref: assignmentRef,
        assignedQuantity: assignmentSnap.exists() ? Number(assignmentSnap.data().assignedQuantity || 0) : 0,
        soldQuantity: assignmentSnap.exists() ? Number(assignmentSnap.data().soldQuantity || 0) : 0,
        exists: assignmentSnap.exists()
      };
    }

    let nextSeq = 1;
    if (counterSnap.exists()) {
      nextSeq = Number(counterSnap.data().lastNumber || 0) + 1;
    }
    const invoicePrefix = storeSnap.exists() ? storeSnap.data().invoicePrefix || `${storeId}-` : `${storeId}-`;
    generatedInvoiceNumber = `${invoicePrefix}${String(nextSeq).padStart(6, '0')}`;

    transaction.set(
      counterRef,
      {
        storeId,
        lastNumber: nextSeq,
        updatedAt: now,
        updatedAtServer: serverTimestamp()
      },
      { merge: true }
    );

    const saleItems: SaleItem[] = [];
    let subtotal = 0;
    let totalDiscount = 0;
    let totalCustomerRateDifference = 0;
    let totalCOGS = 0;

    for (const item of items) {
      const invInfo = invSnaps[item.productId];
      const newQty = invInfo.currentQty - item.quantity;

      transaction.set(
        invInfo.ref,
        {
          quantity: newQty,
          updatedAt: now,
          updatedAtServer: serverTimestamp()
        },
        { merge: true }
      );

      const assignmentInfo = assignmentSnaps[item.productId];
      if (assignmentInfo.exists) {
        const newSold = assignmentInfo.soldQuantity + item.quantity;
        const newRemaining = Math.max(0, assignmentInfo.assignedQuantity - newSold);
        transaction.set(
          assignmentInfo.ref,
          {
            soldQuantity: newSold,
            remainingQuantity: newRemaining,
            updatedAt: now,
            updatedAtServer: serverTimestamp()
          },
          { merge: true }
        );
      }

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
        referenceId: saleDocRef.id,
        referenceNumber: generatedInvoiceNumber,
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        timestamp: now
      };
      transaction.set(movementRef, {
        ...movement,
        timestampServer: serverTimestamp()
      });

      const itemActualPrice = item.actualPrice;
      const discount = item.discount || 0;
      const itemSubtotal = itemActualPrice * item.quantity - discount;
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
        total: itemSubtotal
      });
    }

    const grandTotal = subtotal + extraAmount;
    const grossProfit = grandTotal - totalCOGS;
    const changeDue = Math.max(0, (amountPaid || grandTotal) - grandTotal);

    const completedSale: Sale = {
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

    transaction.set(saleDocRef, {
      ...completedSale,
      businessDate,
      createdAtServer: serverTimestamp()
    });

    return completedSale;
  });

  const itemsSummary = completedSale.items.map((i) => `${i.productName} × ${i.quantity}`).join(', ');

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

  return completedSale;
};

export const getSales = async (
  storeIdFilter?: string,
  startDate?: string,
  endDate?: string,
  limitCount = 100
): Promise<Sale[]> => {
  const salesRef = collection(db, SALES_COLLECTION);
  const salesQuery = storeIdFilter ? query(salesRef, where('storeId', '==', storeIdFilter)) : salesRef;
  const snapshot = await getDocs(salesQuery);
  let sales = sortSales(snapshot.docs.map((d) => toSale(d.id, d.data())));

  if (startDate) sales = sales.filter((s) => s.createdAt >= startDate);
  if (endDate) sales = sales.filter((s) => s.createdAt <= endDate);
  return sales.slice(0, limitCount);
};

export const subscribeToSales = (
  callback: (sales: Sale[]) => void,
  storeIdFilter?: string,
  onError?: (error: Error) => void
): (() => void) => {
  const salesRef = collection(db, SALES_COLLECTION);
  const salesQuery = storeIdFilter ? query(salesRef, where('storeId', '==', storeIdFilter)) : salesRef;

  return onSnapshot(
    salesQuery,
    (snapshot) => {
      callback(sortSales(snapshot.docs.map((d) => toSale(d.id, d.data()))));
    },
    (error) => {
      console.error('Firestore subscribeToSales error:', error);
      onError?.(error);
      callback([]);
    }
  );
};

export const getSaleById = async (saleId: string): Promise<Sale | null> => {
  const docRef = doc(db, SALES_COLLECTION, saleId);
  const snap = await getDoc(docRef);
  return snap.exists() ? toSale(snap.id, snap.data()) : null;
};

export const cancelSale = async (
  saleId: string,
  reason: string,
  adminUser: UserProfile,
  restoreStock = true
): Promise<void> => {
  const now = new Date().toISOString();
  const saleData = await runTransaction(db, async (transaction): Promise<Sale> => {
    const saleRef = doc(db, SALES_COLLECTION, saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) {
      throw new Error(`Sale ${saleId} was not found.`);
    }

    const saleData = toSale(saleSnap.id, saleSnap.data());
    const inventoryReads: Array<{
      item: SaleItem;
      ref: ReturnType<typeof doc>;
      currentQuantity: number;
    }> = [];
    const assignmentReads: Array<{
      item: SaleItem;
      ref: ReturnType<typeof doc>;
      assignedQuantity: number;
      soldQuantity: number;
      exists: boolean;
    }> = [];

    if (restoreStock) {
      for (const item of saleData.items) {
        const invRef = doc(db, INVENTORY_COLLECTION, getInventoryDocId(saleData.storeId, item.productId));
        const invSnap = await transaction.get(invRef);
        inventoryReads.push({
          item,
          ref: invRef,
          currentQuantity: invSnap.exists() ? Number(invSnap.data().quantity || 0) : 0
        });

        const assignmentDate = normalizeDateString(saleData.createdAt);
        const assignmentRef = doc(
          db,
          ASSIGNMENTS_COLLECTION,
          getAssignmentDocId(assignmentDate, saleData.storeId, item.productId)
        );
        const assignmentSnap = await transaction.get(assignmentRef);
        assignmentReads.push({
          item,
          ref: assignmentRef,
          assignedQuantity: assignmentSnap.exists() ? Number(assignmentSnap.data().assignedQuantity || 0) : 0,
          soldQuantity: assignmentSnap.exists() ? Number(assignmentSnap.data().soldQuantity || 0) : 0,
          exists: assignmentSnap.exists()
        });
      }
    }

    transaction.set(
      saleRef,
      {
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledBy: adminUser.fullName,
        cancelledAt: now,
        updatedAtServer: serverTimestamp()
      },
      { merge: true }
    );

    inventoryReads.forEach(({ item, ref, currentQuantity }) => {
      transaction.set(
        ref,
        {
          quantity: currentQuantity + item.quantity,
          updatedAt: now,
          updatedAtServer: serverTimestamp()
        },
        { merge: true }
      );
    });

    assignmentReads.forEach(({ item, ref, assignedQuantity, soldQuantity, exists }) => {
      if (!exists) return;
      const newSold = Math.max(0, soldQuantity - item.quantity);
      transaction.set(
        ref,
        {
          soldQuantity: newSold,
          remainingQuantity: Math.max(0, assignedQuantity - newSold),
          updatedAt: now,
          updatedAtServer: serverTimestamp()
        },
        { merge: true }
      );
    });

    return saleData;
  });

  try {
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
  } catch (err) {
    console.warn('Firestore cancelSale audit notice:', err);
  }
};

export const deleteSale = async (
  saleId: string,
  adminUser: UserProfile,
  restoreStock = true
): Promise<void> => {
  const now = new Date().toISOString();

  const saleData = await runTransaction(db, async (transaction): Promise<Sale> => {
    const saleRef = doc(db, SALES_COLLECTION, saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) {
      throw new Error(`Sale ${saleId} was not found.`);
    }

    const saleData = toSale(saleSnap.id, saleSnap.data());
    const inventoryReads: Array<{
      item: SaleItem;
      ref: ReturnType<typeof doc>;
      currentQuantity: number;
    }> = [];
    const assignmentReads: Array<{
      item: SaleItem;
      ref: ReturnType<typeof doc>;
      assignedQuantity: number;
      soldQuantity: number;
      exists: boolean;
    }> = [];

    if (restoreStock) {
      for (const item of saleData.items) {
        const invRef = doc(db, INVENTORY_COLLECTION, getInventoryDocId(saleData.storeId, item.productId));
        const invSnap = await transaction.get(invRef);
        inventoryReads.push({
          item,
          ref: invRef,
          currentQuantity: invSnap.exists() ? Number(invSnap.data().quantity || 0) : 0
        });

        const assignmentDate = normalizeDateString(saleData.createdAt);
        const assignmentRef = doc(
          db,
          ASSIGNMENTS_COLLECTION,
          getAssignmentDocId(assignmentDate, saleData.storeId, item.productId)
        );
        const assignmentSnap = await transaction.get(assignmentRef);
        assignmentReads.push({
          item,
          ref: assignmentRef,
          assignedQuantity: assignmentSnap.exists() ? Number(assignmentSnap.data().assignedQuantity || 0) : 0,
          soldQuantity: assignmentSnap.exists() ? Number(assignmentSnap.data().soldQuantity || 0) : 0,
          exists: assignmentSnap.exists()
        });
      }
    }

    inventoryReads.forEach(({ item, ref, currentQuantity }) => {
      transaction.set(
        ref,
        {
          quantity: currentQuantity + item.quantity,
          updatedAt: now,
          updatedAtServer: serverTimestamp()
        },
        { merge: true }
      );
    });

    assignmentReads.forEach(({ item, ref, assignedQuantity, soldQuantity, exists }) => {
      if (!exists) return;
      const newSold = Math.max(0, soldQuantity - item.quantity);
      transaction.set(
        ref,
        {
          soldQuantity: newSold,
          remainingQuantity: Math.max(0, assignedQuantity - newSold),
          updatedAt: now,
          updatedAtServer: serverTimestamp()
        },
        { merge: true }
      );
    });

    transaction.delete(saleRef);
    return saleData;
  });

  try {
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
  } catch (err) {
    console.warn('Firestore deleteSale audit notice:', err);
  }
};

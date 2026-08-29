import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import {
  StoreInventory,
  StockMovement,
  StockMovementType,
  StockReconciliationItem,
  StockReconciliationReport
} from '../types/inventory';
import { Product } from '../types/product';
import { logAudit } from './auditService';
import { sendNotification } from './notificationService';
import { UserProfile } from '../types/auth';

const INVENTORY_COLLECTION = 'inventory';
const MOVEMENTS_COLLECTION = 'stockMovements';
const RECONCILIATION_COLLECTION = 'reconciliations';

export const getInventoryDocId = (storeId: string, productId: string) => `${storeId}_${productId}`;

const toInventory = (id: string, data: any): StoreInventory => ({
  id,
  ...(data as Omit<StoreInventory, 'id'>)
});

const sortInventory = (items: StoreInventory[]): StoreInventory[] =>
  [...items].sort((a, b) => {
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });

export const getAllInventory = async (): Promise<StoreInventory[]> => {
  const snapshot = await getDocs(collection(db, INVENTORY_COLLECTION));
  return sortInventory(snapshot.docs.map((d) => toInventory(d.id, d.data())));
};

export const subscribeToAllInventory = (
  callback: (inventories: StoreInventory[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  return onSnapshot(
    collection(db, INVENTORY_COLLECTION),
    (snapshot) => {
      callback(sortInventory(snapshot.docs.map((d) => toInventory(d.id, d.data()))));
    },
    (error) => {
      console.error('Firestore subscribeToAllInventory error:', error);
      onError?.(error);
      callback([]);
    }
  );
};

export const getStoreInventory = async (storeId: string): Promise<StoreInventory[]> => {
  if (!storeId) return [];

  const q = query(
    collection(db, INVENTORY_COLLECTION),
    where('storeId', '==', storeId)
  );
  const snapshot = await getDocs(q);
  return sortInventory(snapshot.docs.map((d) => toInventory(d.id, d.data())));
};

export const subscribeToStoreInventory = (
  storeId: string,
  callback: (inventories: StoreInventory[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  if (!storeId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, INVENTORY_COLLECTION),
    where('storeId', '==', storeId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(sortInventory(snapshot.docs.map((d) => toInventory(d.id, d.data()))));
    },
    (error) => {
      console.error('Firestore subscribeToStoreInventory error:', error);
      onError?.(error);
      callback([]);
    }
  );
};

export const getProductInventoryInStore = async (
  storeId: string,
  productId: string
): Promise<StoreInventory | null> => {
  if (!storeId || !productId) return null;

  const invDocId = getInventoryDocId(storeId, productId);
  const docRef = doc(db, INVENTORY_COLLECTION, invDocId);
  const snap = await getDoc(docRef);
  return snap.exists() ? toInventory(snap.id, snap.data()) : null;
};

export const adjustStock = async (
  storeId: string,
  storeName: string,
  productOrId: Product | string,
  quantityChange: number,
  movementType: StockMovementType,
  reason: string,
  notes: string,
  user: UserProfile,
  referenceId?: string,
  productObj?: Product
): Promise<StoreInventory> => {
  if (!storeId) throw new Error('A canonical store ID is required before adjusting stock.');
  if (!Number.isFinite(quantityChange) || quantityChange === 0) {
    throw new Error('Stock adjustment quantity must be a non-zero number.');
  }

  const productId = typeof productOrId === 'string' ? productOrId : productOrId.id;
  const productName = typeof productOrId === 'string' ? productObj?.name || 'Product' : productOrId.name;
  const sku = typeof productOrId === 'string' ? productObj?.sku || '' : productOrId.sku;
  const purchasePrice = typeof productOrId === 'string' ? productObj?.purchasePrice || 0 : productOrId.purchasePrice;

  if (!productId) throw new Error('A product ID is required before adjusting stock.');

  const invDocId = getInventoryDocId(storeId, productId);
  const invRef = doc(db, INVENTORY_COLLECTION, invDocId);
  const movementRef = doc(collection(db, MOVEMENTS_COLLECTION));
  const now = new Date().toISOString();

  let updatedInventory: StoreInventory | null = null;
  let previousQty = 0;
  let newQty = 0;

  await runTransaction(db, async (transaction) => {
    const invSnap = await transaction.get(invRef);
    previousQty = invSnap.exists() ? Number(invSnap.data().quantity || 0) : 0;
    const lastPurchasePrice = invSnap.exists()
      ? Number(invSnap.data().lastPurchasePrice || purchasePrice)
      : purchasePrice;

    newQty = previousQty + quantityChange;
    if (newQty < 0) {
      throw new Error(
        `Cannot adjust stock below 0. Current stock is ${previousQty}, requested reduction is ${Math.abs(quantityChange)}.`
      );
    }

    updatedInventory = {
      id: invDocId,
      storeId,
      storeName,
      productId,
      productName,
      sku,
      quantity: newQty,
      lastPurchasePrice,
      updatedAt: now
    };

    transaction.set(
      invRef,
      {
        ...updatedInventory,
        updatedAtServer: serverTimestamp()
      },
      { merge: true }
    );

    const movement: StockMovement = {
      id: movementRef.id,
      storeId,
      storeName,
      productId,
      productName,
      sku,
      type: movementType,
      quantity: quantityChange,
      previousQuantity: previousQty,
      newQuantity: newQty,
      reason,
      referenceId,
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      timestamp: now
    };
    transaction.set(movementRef, {
      ...movement,
      timestampServer: serverTimestamp()
    });
  });

  try {
    await logAudit(
      user.id,
      user.fullName,
      user.role,
      'STOCK_ADJUSTED',
      'Inventory',
      `Adjusted stock for "${productName}" in "${storeName}" by ${quantityChange > 0 ? '+' : ''}${quantityChange} (${previousQty} -> ${newQty}). Reason: ${reason}`,
      { storeId, storeName, entityId: invDocId, oldValue: previousQty, newValue: newQty }
    );
  } catch (err) {
    console.warn('Firestore adjustStock audit notice:', err);
  }

  try {
    await sendNotification({
      recipientRole: 'STORE_STAFF',
      storeId,
      storeName,
      type: 'STOCK_UPDATE',
      title: `Stock Updated: ${productName}`,
      titleTe: `స్టాక్ నవీకరించబడింది: ${productName}`,
      message: `${user.fullName} adjusted ${quantityChange > 0 ? '+' : ''}${quantityChange} Bags. Current stock: ${newQty} Bags.`,
      messageTe: `${user.fullName} ${quantityChange > 0 ? '+' : ''}${quantityChange} సంచులు సర్దుబాటు చేశారు. ప్రస్తుత నిల్వ: ${newQty} సంచులు.`
    });
  } catch (e) {}

  return updatedInventory!;
};

export const reconcileStoreStock = async (
  storeId: string,
  storeName: string,
  items: StockReconciliationItem[],
  user: UserProfile
): Promise<StockReconciliationReport> => {
  const now = new Date().toISOString();
  let totalDiscrepancyUnits = 0;

  for (const item of items) {
    if (item.difference !== 0) {
      totalDiscrepancyUnits += Math.abs(item.difference);
      await adjustStock(
        storeId,
        storeName,
        item.productId,
        item.difference,
        'RECONCILIATION',
        item.reason || 'Physical inventory audit variance adjustment',
        item.notes || '',
        user
      );
    }
  }

  const reportRef = doc(collection(db, RECONCILIATION_COLLECTION));
  const report: StockReconciliationReport = {
    id: reportRef.id,
    storeId,
    storeName,
    reconciledBy: user.id,
    reconciledByName: user.fullName,
    items,
    totalDiscrepancyUnits,
    timestamp: now
  };

  await setDoc(reportRef, {
    ...report,
    timestampServer: serverTimestamp()
  });

  return report;
};

export const getStockMovements = async (
  storeId?: string,
  productId?: string,
  maxLimit = 100
): Promise<StockMovement[]> => {
  try {
    let q = query(collection(db, MOVEMENTS_COLLECTION), orderBy('timestamp', 'desc'));
    if (storeId && productId) {
      q = query(
        collection(db, MOVEMENTS_COLLECTION),
        where('storeId', '==', storeId),
        where('productId', '==', productId),
        orderBy('timestamp', 'desc')
      );
    } else if (storeId) {
      q = query(
        collection(db, MOVEMENTS_COLLECTION),
        where('storeId', '==', storeId),
        orderBy('timestamp', 'desc')
      );
    }
    const snapshot = await getDocs(q);
    return snapshot.docs
      .slice(0, maxLimit)
      .map((d) => ({ id: d.id, ...d.data() } as StockMovement));
  } catch (error) {
    console.warn('Firestore getStockMovements notice, returning empty list:', error);
  }
  return [];
};

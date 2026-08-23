import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot
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
import {
  INITIAL_INVENTORIES,
  getLocalData,
  setLocalData
} from './fallbackData';

const INVENTORY_COLLECTION = 'inventory';
const MOVEMENTS_COLLECTION = 'stockMovements';
const RECONCILIATION_COLLECTION = 'reconciliations';

export const getInventoryDocId = (storeId: string, productId: string) => `${storeId}_${productId}`;

export const getAllInventory = async (): Promise<StoreInventory[]> => {
  try {
    const snapshot = await getDocs(collection(db, INVENTORY_COLLECTION));
    if (!snapshot.empty) {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StoreInventory));
      setLocalData(INVENTORY_COLLECTION, items);
      return items;
    }
  } catch (error) {
    console.warn('Firestore getAllInventory notice, using local cache:', error);
  }
  return getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES);
};

export const subscribeToAllInventory = (
  callback: (inventories: StoreInventory[]) => void
): (() => void) => {
  try {
    return onSnapshot(
      collection(db, INVENTORY_COLLECTION),
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StoreInventory));
          setLocalData(INVENTORY_COLLECTION, items);
          callback(items);
        } else {
          const cached = getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES);
          callback(cached);
        }
      },
      (error) => {
        console.warn('Firestore subscribeToAllInventory fallback:', error);
        callback(getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES));
      }
    );
  } catch (err) {
    callback(getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES));
    return () => {};
  }
};

export const getStoreInventory = async (storeId: string): Promise<StoreInventory[]> => {
  try {
    const q = query(
      collection(db, INVENTORY_COLLECTION),
      where('storeId', '==', storeId)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StoreInventory));
      return items;
    }
  } catch (error) {
    console.warn(`Firestore getStoreInventory notice (${storeId}), using local cache:`, error);
  }

  const allInvs = getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES);
  return allInvs.filter((inv) => inv.storeId === storeId);
};

export const subscribeToStoreInventory = (
  storeId: string,
  callback: (inventories: StoreInventory[]) => void
): (() => void) => {
  try {
    const q = query(
      collection(db, INVENTORY_COLLECTION),
      where('storeId', '==', storeId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StoreInventory));
          callback(items);
        } else {
          const all = getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES);
          callback(all.filter((i) => i.storeId === storeId));
        }
      },
      (error) => {
        console.warn('Firestore subscribeToStoreInventory fallback:', error);
        const all = getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES);
        callback(all.filter((i) => i.storeId === storeId));
      }
    );
  } catch (err) {
    const all = getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES);
    callback(all.filter((i) => i.storeId === storeId));
    return () => {};
  }
};

export const getProductInventoryInStore = async (
  storeId: string,
  productId: string
): Promise<StoreInventory | null> => {
  const invDocId = getInventoryDocId(storeId, productId);
  try {
    const docRef = doc(db, INVENTORY_COLLECTION, invDocId);
    const snap = await getDoc(docRef);
    if (snap.exists()) return { id: snap.id, ...snap.data() } as StoreInventory;
  } catch (error) {
    console.warn(`Firestore getProductInventoryInStore notice (${invDocId}), using local cache:`, error);
  }

  const allInvs = getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES);
  return allInvs.find((inv) => inv.storeId === storeId && inv.productId === productId) || null;
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
  const productId = typeof productOrId === 'string' ? productOrId : productOrId.id;
  const productName = typeof productOrId === 'string' ? productObj?.name || 'Product' : productOrId.name;
  const sku = typeof productOrId === 'string' ? productObj?.sku || '' : productOrId.sku;
  const purchasePrice = typeof productOrId === 'string' ? productObj?.purchasePrice || 0 : productOrId.purchasePrice;

  const invDocId = getInventoryDocId(storeId, productId);
  const now = new Date().toISOString();

  let previousQty = 0;
  let lastPurchasePrice = purchasePrice;

  try {
    const invRef = doc(db, INVENTORY_COLLECTION, invDocId);
    const invSnap = await getDoc(invRef);
    if (invSnap.exists()) {
      const currentData = invSnap.data() as StoreInventory;
      previousQty = currentData.quantity;
      lastPurchasePrice = currentData.lastPurchasePrice || purchasePrice;
    }
  } catch (e) {
    const allInvs = getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES);
    const existing = allInvs.find((i) => i.storeId === storeId && i.productId === productId);
    if (existing) {
      previousQty = existing.quantity;
      lastPurchasePrice = existing.lastPurchasePrice || purchasePrice;
    }
  }

  const newQty = previousQty + quantityChange;
  if (newQty < 0) {
    throw new Error(
      `Cannot adjust stock below 0. Current stock is ${previousQty}, requested reduction is ${Math.abs(quantityChange)}.`
    );
  }

  const updatedInventory: StoreInventory = {
    id: invDocId,
    storeId,
    productId,
    productName,
    sku,
    quantity: newQty,
    lastPurchasePrice,
    updatedAt: now
  };

  try {
    const invRef = doc(db, INVENTORY_COLLECTION, invDocId);
    await setDoc(invRef, updatedInventory);

    // Record stock movement ledger
    const movementRef = doc(collection(db, MOVEMENTS_COLLECTION));
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
    await setDoc(movementRef, movement);

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
    console.warn('Firestore adjustStock notice, updating local cache:', err);
  }

  const allInvs = getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, INITIAL_INVENTORIES);
  const updatedAll = [updatedInventory, ...allInvs.filter((i) => i.id !== invDocId)];
  setLocalData(INVENTORY_COLLECTION, updatedAll);

  // Notify Store Staff of stock adjustment
  try {
    sendNotification({
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

  return updatedInventory;
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

  const reportId = `recon_${Date.now()}`;
  const report: StockReconciliationReport = {
    id: reportId,
    storeId,
    storeName,
    reconciledBy: user.id,
    reconciledByName: user.fullName,
    items,
    totalDiscrepancyUnits,
    timestamp: now
  };

  try {
    const reportRef = doc(collection(db, RECONCILIATION_COLLECTION));
    report.id = reportRef.id;
    await setDoc(reportRef, report);
  } catch (e) {}

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
    if (!snapshot.empty) {
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StockMovement));
    }
  } catch (error) {
    console.warn('Firestore getStockMovements notice, returning empty list:', error);
  }
  return [];
};

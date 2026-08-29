import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  increment
} from 'firebase/firestore';
import { db, stripUndefined } from './firebase';
import { DailyStockAssignment } from '../types/stockAssignment';
import { UserProfile } from '../types/auth';
import { logAudit } from './auditService';
import { getInventoryDocId } from './inventoryService';
import { getLocalData, setLocalData } from './fallbackData';
import { StoreInventory } from '../types/inventory';

const ASSIGNMENTS_COLLECTION = 'dailyStockAssignments';
const INVENTORY_COLLECTION = 'inventory';

/**
 * Returns today's date string formatted as YYYY-MM-DD in local time
 */
export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Standardizes any date format to YYYY-MM-DD
 */
export const normalizeDateString = (dateStr?: string): string => {
  if (!dateStr) return getTodayDateString();
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}
  return dateStr;
};

export const getAssignmentDocId = (date: string, storeId: string, productId: string) => {
  const normDate = normalizeDateString(date);
  return `dsa_${normDate}_${storeId}_${productId}`;
};

const isStoreMatch = (a: DailyStockAssignment, sId?: string): boolean => {
  if (!sId) return true;
  const clean = sId.toLowerCase().trim();
  return Boolean(
    a.storeId === sId ||
    (a.storeId && a.storeId.toLowerCase().trim() === clean) ||
    (a.storeCode && a.storeCode.toLowerCase().trim() === clean) ||
    (a.storeName && a.storeName.toLowerCase().trim() === clean)
  );
};

export const getDailyAssignments = async (
  date?: string,
  storeId?: string
): Promise<DailyStockAssignment[]> => {
  const targetDate = date ? normalizeDateString(date) : undefined;
  try {
    const snapshot = await getDocs(collection(db, ASSIGNMENTS_COLLECTION));
    if (!snapshot.empty) {
      const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DailyStockAssignment));
      // Cache the FULL collection. Caching the filtered subset used to wipe every
      // other store's / date's rows out of the shared offline cache.
      setLocalData(ASSIGNMENTS_COLLECTION, all);
      let items = all;
      if (targetDate) items = items.filter((i) => normalizeDateString(i.date) === targetDate);
      if (storeId) items = items.filter((i) => isStoreMatch(i, storeId));
      return items;
    }
  } catch (error) {
    console.warn('Firestore getDailyAssignments notice, using local cache:', error);
  }

  const all = getLocalData<DailyStockAssignment[]>(ASSIGNMENTS_COLLECTION, []);
  return all.filter((a) => {
    if (targetDate && normalizeDateString(a.date) !== targetDate) return false;
    if (storeId && !isStoreMatch(a, storeId)) return false;
    return true;
  });
};

export const subscribeToDailyAssignments = (
  callback: (assignments: DailyStockAssignment[]) => void,
  date?: string,
  storeId?: string
): (() => void) => {
  const targetDate = date ? normalizeDateString(date) : undefined;

  const emitLocal = () => {
    const cached = getLocalData<DailyStockAssignment[]>(ASSIGNMENTS_COLLECTION, []);
    const filtered = cached.filter((a) => {
      if (targetDate && normalizeDateString(a.date) !== targetDate) return false;
      if (storeId && !isStoreMatch(a, storeId)) return false;
      return true;
    });
    callback(filtered);
  };

  emitLocal();

  const handleUpdate = () => emitLocal();
  window.addEventListener('storage', handleUpdate);
  window.addEventListener('raraju_stock_assigned', handleUpdate);

  let unsubscribeFirestore = () => {};
  try {
    unsubscribeFirestore = onSnapshot(
      collection(db, ASSIGNMENTS_COLLECTION),
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DailyStockAssignment));
          setLocalData(ASSIGNMENTS_COLLECTION, items);
          const filtered = items.filter((a) => {
            if (targetDate && normalizeDateString(a.date) !== targetDate) return false;
            if (storeId && !isStoreMatch(a, storeId)) return false;
            return true;
          });
          callback(filtered);
        } else {
          emitLocal();
        }
      },
      () => {
        emitLocal();
      }
    );
  } catch (e) {
    emitLocal();
  }

  return () => {
    window.removeEventListener('storage', handleUpdate);
    window.removeEventListener('raraju_stock_assigned', handleUpdate);
    unsubscribeFirestore();
  };
};

export const assignDailyStock = async (
  date: string,
  storeId: string,
  storeName: string,
  storeCode: string,
  productId: string,
  productName: string,
  sku: string,
  unit: string,
  assignedQuantity: number,
  adminUser: UserProfile,
  notes?: string
): Promise<DailyStockAssignment> => {
  const normDate = normalizeDateString(date);
  const docId = getAssignmentDocId(normDate, storeId, productId);
  const now = new Date().toISOString();

  let existingSold = 0;
  try {
    const existingDoc = await getDoc(doc(db, ASSIGNMENTS_COLLECTION, docId));
    if (existingDoc.exists()) {
      existingSold = existingDoc.data().soldQuantity || 0;
    }
  } catch (e) {}

  const remaining = Math.max(0, assignedQuantity - existingSold);

  const assignment: DailyStockAssignment = {
    id: docId,
    date: normDate,
    storeId,
    storeName,
    storeCode,
    productId,
    productName,
    sku,
    unit,
    assignedQuantity,
    soldQuantity: existingSold,
    remainingQuantity: remaining,
    assignedByUserId: adminUser.id,
    assignedByUserName: adminUser.fullName,
    notes,
    createdAt: now,
    updatedAt: now
  };

  // 1. Cloud Firestore write
  let cloudError: any = null;
  try {
    const docRef = doc(db, ASSIGNMENTS_COLLECTION, docId);
    await setDoc(docRef, stripUndefined(assignment));

    // Sync Store Inventory quantity directly so POS cashier has the assigned quantity
    const invDocId = getInventoryDocId(storeId, productId);
    const invRef = doc(db, INVENTORY_COLLECTION, invDocId);
    await setDoc(
      invRef,
      stripUndefined({
        id: invDocId,
        storeId,
        storeName,
        productId,
        productName,
        sku,
        quantity: remaining,
        reorderPoint: 5,
        idealStockLevel: assignedQuantity,
        updatedAt: now
      }),
      { merge: true }
    );

    await logAudit(
      adminUser.id,
      adminUser.fullName,
      adminUser.role,
      'STOCK_ADJUSTED',
      'Inventory',
      `Assigned daily stock: ${assignedQuantity} Bags of "${productName}" to "${storeName}" on ${normDate}`,
      {
        entityId: docId,
        storeId,
        storeName,
        newValue: { date: normDate, assignedQuantity, remaining }
      }
    );
  } catch (err) {
    cloudError = err;
    console.error('Firestore assignDailyStock FAILED (cloud not updated):', err);
  }

  // 2. Update local assignments cache
  const cachedAssignments = getLocalData<DailyStockAssignment[]>(ASSIGNMENTS_COLLECTION, []);
  const updatedAssignments = [assignment, ...cachedAssignments.filter((a) => a.id !== docId && !(a.date === normDate && a.productId === productId && a.storeId === storeId))];
  setLocalData(ASSIGNMENTS_COLLECTION, updatedAssignments);

  // 3. Update local inventory cache
  const invDocId = getInventoryDocId(storeId, productId);
  const cachedInvs = getLocalData<StoreInventory[]>(INVENTORY_COLLECTION, []);
  const updatedInvs = [
    {
      id: invDocId,
      storeId,
      storeName,
      productId,
      productName,
      sku,
      quantity: remaining,
      reorderPoint: 5,
      idealStockLevel: assignedQuantity,
      updatedAt: now
    },
    ...cachedInvs.filter((i) => i.id !== invDocId && !(i.storeId === storeId && i.productId === productId))
  ];
  setLocalData(INVENTORY_COLLECTION, updatedInvs);

  // 4. Trigger Cross-Tab Broadcast Event
  try {
    window.dispatchEvent(new CustomEvent('raraju_stock_assigned', { detail: assignment }));
  } catch (e) {}

  // 5. A local-cache-only save is NOT a successful assignment: the store cashier runs
  // on a different device and will never see it. Surface the failure to the admin
  // instead of showing a false "saved" toast.
  if (cloudError) {
    throw new Error(
      `"${productName}" could not be saved to the cloud, so ${storeName} will not receive it. ` +
        `(${cloudError.code || 'error'}: ${cloudError.message || cloudError})`
    );
  }

  return assignment;
};

/**
 * Automatically invoked upon completing a sale to update sold & remaining quantities
 */
export const recordSaleInDailyAssignment = async (
  date: string,
  storeId: string,
  productId: string,
  soldQty: number
): Promise<void> => {
  const normDate = normalizeDateString(date);
  const docId = getAssignmentDocId(normDate, storeId, productId);
  const now = new Date().toISOString();

  try {
    const docRef = doc(db, ASSIGNMENTS_COLLECTION, docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const current = snap.data() as DailyStockAssignment;
      const newSold = (current.soldQuantity || 0) + soldQty;
      const newRemaining = Math.max(0, current.assignedQuantity - newSold);
      await updateDoc(docRef, {
        soldQuantity: newSold,
        remainingQuantity: newRemaining,
        updatedAt: now
      });
    }
  } catch (e) {}

  const cached = getLocalData<DailyStockAssignment[]>(ASSIGNMENTS_COLLECTION, []);
  const target = cached.find((a) => a.id === docId || (normalizeDateString(a.date) === normDate && a.productId === productId));
  if (target) {
    target.soldQuantity = (target.soldQuantity || 0) + soldQty;
    target.remainingQuantity = Math.max(0, target.assignedQuantity - target.soldQuantity);
    target.updatedAt = now;
    setLocalData(ASSIGNMENTS_COLLECTION, cached);
  }
};

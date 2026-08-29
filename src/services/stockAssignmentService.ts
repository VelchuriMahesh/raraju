import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type QueryConstraint
} from 'firebase/firestore';
import { db, firebaseProjectId } from './firebase';
import { DailyStockAssignment } from '../types/stockAssignment';
import { UserProfile } from '../types/auth';
import { logAudit } from './auditService';
import { getInventoryDocId } from './inventoryService';
import { StockMovement } from '../types/inventory';

const ASSIGNMENTS_COLLECTION = 'dailyStockAssignments';
const INVENTORY_COLLECTION = 'inventory';
const MOVEMENTS_COLLECTION = 'stockMovements';

/**
 * Returns today's date string formatted as YYYY-MM-DD in local time.
 */
export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Standardizes any date format to YYYY-MM-DD.
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

const toAssignment = (id: string, data: any): DailyStockAssignment => ({
  id,
  ...(data as Omit<DailyStockAssignment, 'id'>)
});

const sortAssignments = (items: DailyStockAssignment[]): DailyStockAssignment[] =>
  [...items].sort((a, b) => {
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });

const assignmentQueryConstraints = (date?: string, storeId?: string): QueryConstraint[] => {
  const constraints: QueryConstraint[] = [];
  if (date) constraints.push(where('date', '==', normalizeDateString(date)));
  if (storeId) constraints.push(where('storeId', '==', storeId));
  return constraints;
};

const assertSuperAdmin = (adminUser: UserProfile) => {
  if (adminUser.role !== 'SUPER_ADMIN') {
    throw new Error('Only Super Admin users can assign daily stock.');
  }
};

const assertValidStockInput = (storeId: string, productId: string, assignedQuantity: number) => {
  if (!storeId) throw new Error('A canonical store ID is required before assigning stock.');
  if (!productId) throw new Error('A product ID is required before assigning stock.');
  if (!Number.isFinite(assignedQuantity) || assignedQuantity < 0) {
    throw new Error('Assigned quantity must be a non-negative number.');
  }
};

export const getDailyAssignments = async (
  date?: string,
  storeId?: string
): Promise<DailyStockAssignment[]> => {
  const constraints = assignmentQueryConstraints(date, storeId);
  const assignmentsRef = collection(db, ASSIGNMENTS_COLLECTION);
  const assignmentsQuery = constraints.length > 0 ? query(assignmentsRef, ...constraints) : assignmentsRef;
  const snapshot = await getDocs(assignmentsQuery);
  return sortAssignments(snapshot.docs.map((d) => toAssignment(d.id, d.data())));
};

export const subscribeToDailyAssignments = (
  callback: (assignments: DailyStockAssignment[]) => void,
  date?: string,
  storeId?: string,
  onError?: (error: Error) => void
): (() => void) => {
  const constraints = assignmentQueryConstraints(date, storeId);
  const assignmentsRef = collection(db, ASSIGNMENTS_COLLECTION);
  const assignmentsQuery = constraints.length > 0 ? query(assignmentsRef, ...constraints) : assignmentsRef;

  return onSnapshot(
    assignmentsQuery,
    (snapshot) => {
      callback(sortAssignments(snapshot.docs.map((d) => toAssignment(d.id, d.data()))));
    },
    (error) => {
      console.error('Firestore subscribeToDailyAssignments error:', error);
      onError?.(error);
      callback([]);
    }
  );
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
  assertSuperAdmin(adminUser);
  assertValidStockInput(storeId, productId, assignedQuantity);

  const normDate = normalizeDateString(date);
  const docId = getAssignmentDocId(normDate, storeId, productId);
  const invDocId = getInventoryDocId(storeId, productId);
  const now = new Date().toISOString();
  const assignmentRef = doc(db, ASSIGNMENTS_COLLECTION, docId);
  const invRef = doc(db, INVENTORY_COLLECTION, invDocId);
  const movementRef = doc(collection(db, MOVEMENTS_COLLECTION));

  let savedAssignment: DailyStockAssignment | null = null;
  let remaining = 0;
  let previousInventoryQuantity = 0;

  await runTransaction(db, async (transaction) => {
    const assignmentSnap = await transaction.get(assignmentRef);
    const inventorySnap = await transaction.get(invRef);
    const existingAssignment = assignmentSnap.exists()
      ? ({ id: assignmentSnap.id, ...assignmentSnap.data() } as DailyStockAssignment)
      : null;

    const existingSold = Number(existingAssignment?.soldQuantity || 0);
    remaining = Math.max(0, assignedQuantity - existingSold);
    previousInventoryQuantity = inventorySnap.exists() ? Number(inventorySnap.data().quantity || 0) : 0;

    const nextAssignment: DailyStockAssignment = {
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
      createdAt: existingAssignment?.createdAt || now,
      updatedAt: now
    };
    savedAssignment = nextAssignment;

    transaction.set(
      assignmentRef,
      {
        ...nextAssignment,
        updatedAtServer: serverTimestamp(),
        createdAtServer: existingAssignment ? (assignmentSnap.data()?.createdAtServer || serverTimestamp()) : serverTimestamp()
      },
      { merge: true }
    );

    transaction.set(
      invRef,
      {
        id: invDocId,
        storeId,
        storeName,
        storeCode,
        productId,
        productName,
        sku,
        unit,
        quantity: remaining,
        reorderPoint: 5,
        idealStockLevel: assignedQuantity,
        updatedAt: now,
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
      type: 'ADMIN_ADJUSTMENT',
      quantity: remaining - previousInventoryQuantity,
      previousQuantity: previousInventoryQuantity,
      newQuantity: remaining,
      referenceId: docId,
      reason: `Daily stock assignment for ${normDate}`,
      userId: adminUser.id,
      userName: adminUser.fullName,
      userRole: adminUser.role,
      timestamp: now
    };
    transaction.set(movementRef, movement);
  });

  const [assignmentVerifySnap, inventoryVerifySnap] = await Promise.all([
    getDoc(assignmentRef),
    getDoc(invRef)
  ]);

  if (!assignmentVerifySnap.exists()) {
    throw new Error(`Firestore verification failed: assignment ${docId} was not written.`);
  }
  if (!inventoryVerifySnap.exists()) {
    throw new Error(`Firestore verification failed: inventory ${invDocId} was not written.`);
  }

  const verifiedAssignment = assignmentVerifySnap.data() as DailyStockAssignment;
  const verifiedInventory = inventoryVerifySnap.data();
  const verifiedAssignedQuantity = Number(verifiedAssignment.assignedQuantity);
  const verifiedInventoryQuantity = Number(verifiedInventory.quantity);

  if (verifiedAssignedQuantity !== assignedQuantity) {
    throw new Error(
      `Firestore verification failed: assignment quantity is ${verifiedAssignedQuantity}, expected ${assignedQuantity}.`
    );
  }
  if (verifiedInventoryQuantity !== remaining) {
    throw new Error(
      `Firestore verification failed: inventory quantity is ${verifiedInventoryQuantity}, expected ${remaining}.`
    );
  }

  console.info('[ADMIN STOCK WRITE]', {
    firebaseProject: firebaseProjectId,
    storeId,
    productId,
    businessDate: normDate,
    assignedQuantity,
    inventoryQuantity: remaining,
    assignmentPath: `${ASSIGNMENTS_COLLECTION}/${docId}`,
    inventoryPath: `${INVENTORY_COLLECTION}/${invDocId}`,
    movementPath: `${MOVEMENTS_COLLECTION}/${movementRef.id}`,
    writeResult: 'SUCCESS'
  });
  console.info('[ADMIN STOCK VERIFY]', {
    firestoreAssignedQuantity: verifiedAssignedQuantity,
    firestoreInventoryQuantity: verifiedInventoryQuantity
  });

  try {
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
    console.warn('Firestore stock assignment audit notice:', err);
  }

  return savedAssignment!;
};

/**
 * Updates the daily assignment ledger after a completed sale.
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
  const assignmentRef = doc(db, ASSIGNMENTS_COLLECTION, docId);

  await runTransaction(db, async (transaction) => {
    const assignmentSnap = await transaction.get(assignmentRef);
    if (!assignmentSnap.exists()) return;

    const current = assignmentSnap.data() as DailyStockAssignment;
    const newSold = Number(current.soldQuantity || 0) + soldQty;
    const assignedQuantity = Number(current.assignedQuantity || 0);
    const newRemaining = Math.max(0, assignedQuantity - newSold);

    transaction.set(
      assignmentRef,
      {
        soldQuantity: newSold,
        remainingQuantity: newRemaining,
        updatedAt: now,
        updatedAtServer: serverTimestamp()
      },
      { merge: true }
    );
  });
};

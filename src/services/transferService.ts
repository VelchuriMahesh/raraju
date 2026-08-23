import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { StockTransfer, StockTransferItem } from '../types/stockTransfer';
import { StockMovement } from '../types/inventory';
import { UserProfile } from '../types/auth';
import { logAudit } from './auditService';
import { getInventoryDocId } from './inventoryService';

const TRANSFERS_COLLECTION = 'stockTransfers';
const INVENTORY_COLLECTION = 'inventory';
const MOVEMENTS_COLLECTION = 'stockMovements';

export const transferStock = async (
  fromStoreId: string,
  fromStoreName: string,
  toStoreId: string,
  toStoreName: string,
  items: StockTransferItem[],
  reason: string,
  adminUser: UserProfile
): Promise<StockTransfer> => {
  if (fromStoreId === toStoreId) {
    throw new Error('Source store and Destination store cannot be the same.');
  }
  if (!items || items.length === 0) {
    throw new Error('No items selected for transfer.');
  }

  const transferRef = doc(collection(db, TRANSFERS_COLLECTION));
  const transferNumber = `TR-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();

  const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);

  const transferDoc: StockTransfer = {
    id: transferRef.id,
    transferNumber,
    fromStoreId,
    fromStoreName,
    toStoreId,
    toStoreName,
    items,
    totalQuantity,
    reason: reason || 'Inter-store inventory transfer',
    status: 'COMPLETED',
    transferredBy: adminUser.id,
    transferredByName: adminUser.fullName,
    createdAt: now
  };

  await runTransaction(db, async (transaction) => {
    // 1. Check all source store inventories
    for (const item of items) {
      const sourceDocId = getInventoryDocId(fromStoreId, item.productId);
      const sourceRef = doc(db, INVENTORY_COLLECTION, sourceDocId);
      const sourceSnap = await transaction.get(sourceRef);

      const sourceQty = sourceSnap.exists() ? (sourceSnap.data().quantity || 0) : 0;
      if (sourceQty < item.quantity) {
        throw new Error(
          `Insufficient stock in ${fromStoreName} for "${item.productName}". Available: ${sourceQty}, Requested: ${item.quantity}.`
        );
      }
    }

    // 2. Perform transfer writes
    for (const item of items) {
      // Source store deduction
      const sourceDocId = getInventoryDocId(fromStoreId, item.productId);
      const sourceRef = doc(db, INVENTORY_COLLECTION, sourceDocId);
      const sourceSnap = await transaction.get(sourceRef);
      const sourcePrevQty = sourceSnap.exists() ? (sourceSnap.data().quantity || 0) : 0;
      const sourceNewQty = sourcePrevQty - item.quantity;

      transaction.update(sourceRef, {
        quantity: sourceNewQty,
        updatedAt: now
      });

      // Movement OUT
      const movOutRef = doc(collection(db, MOVEMENTS_COLLECTION));
      const movementOut: StockMovement = {
        id: movOutRef.id,
        storeId: fromStoreId,
        storeName: fromStoreName,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        type: 'STOCK_TRANSFER_OUT',
        quantity: -item.quantity,
        previousQuantity: sourcePrevQty,
        newQuantity: sourceNewQty,
        referenceId: transferRef.id,
        referenceNumber: transferNumber,
        reason: `Transfer to ${toStoreName} (${transferNumber})`,
        userId: adminUser.id,
        userName: adminUser.fullName,
        userRole: adminUser.role,
        timestamp: now
      };
      transaction.set(movOutRef, movementOut);

      // Destination store addition
      const destDocId = getInventoryDocId(toStoreId, item.productId);
      const destRef = doc(db, INVENTORY_COLLECTION, destDocId);
      const destSnap = await transaction.get(destRef);
      const destPrevQty = destSnap.exists() ? (destSnap.data().quantity || 0) : 0;
      const destNewQty = destPrevQty + item.quantity;

      if (!destSnap.exists()) {
        transaction.set(destRef, {
          id: destDocId,
          storeId: toStoreId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: destNewQty,
          updatedAt: now
        });
      } else {
        transaction.update(destRef, {
          quantity: destNewQty,
          updatedAt: now
        });
      }

      // Movement IN
      const movInRef = doc(collection(db, MOVEMENTS_COLLECTION));
      const movementIn: StockMovement = {
        id: movInRef.id,
        storeId: toStoreId,
        storeName: toStoreName,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        type: 'STOCK_TRANSFER_IN',
        quantity: item.quantity,
        previousQuantity: destPrevQty,
        newQuantity: destNewQty,
        referenceId: transferRef.id,
        referenceNumber: transferNumber,
        reason: `Transfer from ${fromStoreName} (${transferNumber})`,
        userId: adminUser.id,
        userName: adminUser.fullName,
        userRole: adminUser.role,
        timestamp: now
      };
      transaction.set(movInRef, movementIn);
    }

    // 3. Save transfer record
    transaction.set(transferRef, transferDoc);
  });

  await logAudit(
    adminUser.id,
    adminUser.fullName,
    adminUser.role,
    'STOCK_TRANSFERRED',
    'StockTransfer',
    `Transferred ${totalQuantity} units from "${fromStoreName}" to "${toStoreName}" (${transferNumber})`,
    {
      entityId: transferRef.id,
      newValue: transferDoc
    }
  );

  return transferDoc;
};

export const getTransfers = async (): Promise<StockTransfer[]> => {
  try {
    const q = query(collection(db, TRANSFERS_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StockTransfer));
  } catch (error) {
    console.error('Error fetching stock transfers:', error);
    throw error;
  }
};

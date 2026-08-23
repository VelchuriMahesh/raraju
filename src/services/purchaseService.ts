import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { Purchase, PurchaseItem } from '../types/purchase';
import { StockMovement } from '../types/inventory';
import { UserProfile } from '../types/auth';
import { logAudit } from './auditService';
import { getInventoryDocId } from './inventoryService';

const PURCHASES_COLLECTION = 'purchases';
const INVENTORY_COLLECTION = 'inventory';
const MOVEMENTS_COLLECTION = 'stockMovements';

export const createPurchase = async (
  purchaseData: {
    supplierName: string;
    supplierContact?: string;
    supplierInvoiceNumber?: string;
    storeId: string;
    storeName: string;
    items: PurchaseItem[];
    notes?: string;
  },
  adminUser: UserProfile
): Promise<Purchase> => {
  const purchaseRef = doc(collection(db, PURCHASES_COLLECTION));
  const now = new Date().toISOString();
  const purchaseNumber = `PO-${Date.now().toString().slice(-6)}`;

  const totalAmount = purchaseData.items.reduce((sum, it) => sum + it.total, 0);

  const newPurchase: Purchase = {
    id: purchaseRef.id,
    purchaseNumber,
    supplierName: purchaseData.supplierName,
    supplierContact: purchaseData.supplierContact || '',
    supplierInvoiceNumber: purchaseData.supplierInvoiceNumber || '',
    storeId: purchaseData.storeId,
    storeName: purchaseData.storeName,
    items: purchaseData.items,
    totalAmount,
    notes: purchaseData.notes || '',
    createdBy: adminUser.id,
    createdByName: adminUser.fullName,
    createdAt: now
  };

  await runTransaction(db, async (transaction) => {
    // 1. Save purchase doc
    transaction.set(purchaseRef, newPurchase);

    // 2. Increment store inventory for each item
    for (const item of purchaseData.items) {
      const invDocId = getInventoryDocId(purchaseData.storeId, item.productId);
      const invRef = doc(db, INVENTORY_COLLECTION, invDocId);
      const invSnap = await transaction.get(invRef);

      const prevQty = invSnap.exists() ? (invSnap.data().quantity || 0) : 0;
      const newQty = prevQty + item.quantity;

      if (!invSnap.exists()) {
        transaction.set(invRef, {
          id: invDocId,
          storeId: purchaseData.storeId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: newQty,
          lastPurchasePrice: item.purchasePrice,
          updatedAt: now
        });
      } else {
        transaction.update(invRef, {
          quantity: newQty,
          lastPurchasePrice: item.purchasePrice,
          updatedAt: now
        });
      }

      // 3. Record stock movement
      const movRef = doc(collection(db, MOVEMENTS_COLLECTION));
      const movement: StockMovement = {
        id: movRef.id,
        storeId: purchaseData.storeId,
        storeName: purchaseData.storeName,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        type: 'PURCHASE',
        quantity: item.quantity,
        previousQuantity: prevQty,
        newQuantity: newQty,
        referenceId: purchaseRef.id,
        referenceNumber: purchaseNumber,
        reason: `Purchase from ${purchaseData.supplierName} (PO: ${purchaseNumber})`,
        userId: adminUser.id,
        userName: adminUser.fullName,
        userRole: adminUser.role,
        timestamp: now
      };
      transaction.set(movRef, movement);
    }
  });

  await logAudit(
    adminUser.id,
    adminUser.fullName,
    adminUser.role,
    'PURCHASE_CREATED',
    'Purchase',
    `Created purchase ${purchaseNumber} from "${purchaseData.supplierName}" for store "${purchaseData.storeName}" (Total: ₹${totalAmount})`,
    {
      storeId: purchaseData.storeId,
      storeName: purchaseData.storeName,
      entityId: purchaseRef.id,
      newValue: newPurchase
    }
  );

  return newPurchase;
};

export const getPurchases = async (storeIdFilter?: string): Promise<Purchase[]> => {
  try {
    const q = query(collection(db, PURCHASES_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    let purchases = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Purchase));
    if (storeIdFilter) {
      purchases = purchases.filter((p) => p.storeId === storeIdFilter);
    }
    return purchases;
  } catch (error) {
    console.error('Error fetching purchases:', error);
    throw error;
  }
};

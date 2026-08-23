export type StockMovementType =
  | 'OPENING_STOCK'
  | 'PURCHASE'
  | 'SALE'
  | 'SALES_RETURN'
  | 'STOCK_TRANSFER_OUT'
  | 'STOCK_TRANSFER_IN'
  | 'ADMIN_ADJUSTMENT'
  | 'DAMAGE'
  | 'LOSS'
  | 'CORRECTION'
  | 'RECONCILIATION';

export interface StoreInventory {
  id: string; // Composite key: `${storeId}_${productId}`
  storeId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  lastPurchasePrice?: number;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  storeId: string;
  storeName?: string;
  productId: string;
  productName: string;
  sku: string;
  type: StockMovementType;
  quantity: number; // positive for additions, negative for deductions
  previousQuantity: number;
  newQuantity: number;
  referenceId?: string; // saleId, purchaseId, transferId, or adjustmentId
  referenceNumber?: string; // invoice number, PO number, transfer number
  reason?: string;
  userId: string;
  userName: string;
  userRole: string;
  timestamp: string; // ISO 8601 string
}

export interface StockReconciliationItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  systemStock: number; // Current recorded stock
  physicalStock: number; // Physical count entered by admin
  difference: number; // physicalStock - systemStock
  reason?: string;
  notes?: string;
}

export interface StockReconciliationReport {
  id: string;
  storeId: string;
  storeName: string;
  reconciledBy: string;
  reconciledByName: string;
  items: StockReconciliationItem[];
  totalDiscrepancyUnits: number;
  timestamp: string;
}

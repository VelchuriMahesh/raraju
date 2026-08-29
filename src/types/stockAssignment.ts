export interface DailyStockAssignment {
  id: string; // e.g. "dsa_2026-08-22_store1_prod1"
  date: string; // "YYYY-MM-DD"
  storeId: string;
  storeName: string;
  storeCode: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string; // e.g. "25 kg" or "50 kg"
  assignedQuantity: number; // No. of Bags assigned for this date
  soldQuantity: number; // No. of Bags sold on this date
  remainingQuantity: number; // assignedQuantity - soldQuantity
  assignedByUserId: string;
  assignedByUserName: string;
  cloudSynced?: boolean;
  syncError?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BulkDailyAssignmentInput {
  date: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  assignments: {
    productId: string;
    productName: string;
    sku: string;
    unit: string;
    assignedQuantity: number;
  }[];
}

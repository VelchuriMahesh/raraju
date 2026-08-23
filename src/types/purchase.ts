export interface PurchaseItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  purchasePrice: number;
  total: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string; // e.g. "PO-2026-0001"
  supplierName: string;
  supplierContact?: string;
  supplierInvoiceNumber?: string;
  storeId: string;
  storeName: string;
  items: PurchaseItem[];
  totalAmount: number;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

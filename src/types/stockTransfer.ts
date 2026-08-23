export interface StockTransferItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string; // e.g. "TR-2026-0001"
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
  items: StockTransferItem[];
  totalQuantity: number;
  reason?: string;
  status: 'COMPLETED' | 'CANCELLED';
  transferredBy: string;
  transferredByName: string;
  createdAt: string;
}

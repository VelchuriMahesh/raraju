export type ProductUnit = string;

export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export interface CustomerRatePolicy {
  enabled: boolean;
  minAllowedPrice?: number; // Minimum price staff can enter
  maxAllowedPrice?: number; // Maximum price staff can enter
  maxIncrease?: number; // Max amount above standard price (e.g., ₹100)
  allowDecrease?: boolean; // If false, staff can only increase price
  requireReason?: boolean; // If true, staff must select/enter a reason
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  categoryName?: string;
  brand?: string;
  description?: string;
  unit: ProductUnit;
  purchasePrice: number;
  standardPrice: number; // Standard selling price
  gstRate?: number; // in percentage, e.g., 0, 5, 12, 18, 28
  hsnCode?: string;
  minStockAlert?: number; // Low stock threshold
  maxStockAlert?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  imageDeleteUrl?: string;
  customerRatePolicy?: CustomerRatePolicy;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

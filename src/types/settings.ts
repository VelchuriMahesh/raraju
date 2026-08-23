export interface BusinessSettings {
  id: string; // 'general'
  businessName: string;
  legalName?: string;
  tagline?: string;
  logoUrl?: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  gstin?: string;
  pan?: string;
  currencySymbol: string; // '₹'
  defaultGstRate: number; // 0, 5, 12, 18, 28
  
  // UPI Payment Configuration
  upiId?: string; // e.g. "raraju@oksbi" or "9876543210@upi"
  upiPayeeName?: string; // e.g. "RARAJU ENTERPRISES"

  // POS Rules
  allowNegativeStock: boolean;
  allowBackorders: boolean;
  enableCustomerRate: boolean;
  defaultCustomerRateMaxIncrease: number;
  requireCustomerRateReason: boolean;
  allowDiscountInPOS: boolean;
  maxDiscountPercentage: number;
  
  // Invoice Rules
  invoicePrefix: string; // e.g. "INV-"
  defaultPrinterType: 'THERMAL_80MM' | 'A4';
  invoiceFooterMessage: string;
  invoiceTermsAndConditions?: string;
  
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  totalOrders: number;
  totalSpent: number;
  lastPurchaseDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'SPLIT';

export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export interface SaleItem {
  id?: string;
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  unit: string;
  imageUrl?: string;
  quantity: number;
  purchasePrice?: number; // Stored at time of sale for profit calculation
  standardPrice: number; // Base selling price
  actualPrice: number; // Actual selling price after customer rate
  rateDifference: number; // actualPrice - standardPrice
  customerRateApplied: boolean;
  customerRateReason?: string;
  gstRate: number; // percentage
  gstAmount: number;
  discount: number; // item discount if any
  total: number; // quantity * actualPrice - discount
}

export interface SplitPaymentDetail {
  method: 'CASH' | 'UPI' | 'CARD' | 'CREDIT';
  amount: number;
  referenceNumber?: string;
}

export interface SaleCustomerInfo {
  name?: string;
  phone?: string;
  address?: string;
  gstin?: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string; // e.g. "S1-000001"
  storeId: string;
  storeName: string;
  employeeId: string;
  employeeName: string;
  customer?: SaleCustomerInfo;
  items: SaleItem[];
  itemCount: number;
  subtotal: number;
  totalGst: number;
  totalDiscount: number;
  totalCustomerRateDifference: number; // sum of (rateDiff * qty)
  extraAmount?: number; // Custom additional amount entered by cashier
  extraAmountReason?: string; // Reason or label for extra amount
  grandTotal: number;
  totalCostOfGoodsSold: number; // sum of (purchasePrice * qty) for profit reporting
  grossProfit: number; // grandTotal - totalGst - totalCostOfGoodsSold
  paymentMethod: PaymentMethod;
  splitPayments?: SplitPaymentDetail[];
  amountPaid: number;
  changeDue: number;
  status: SaleStatus;
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdAt: string;
}

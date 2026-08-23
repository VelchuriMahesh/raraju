export type StoreStatus = 'ACTIVE' | 'INACTIVE';

export type PrinterType = 'THERMAL_80MM' | 'A4' | 'BOTH';

export interface Store {
  id: string;
  name: string;
  code: string; // e.g. "S1", "S2"
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone: string;
  email?: string;
  gstin?: string;
  upiId?: string; // Store specific UPI ID (e.g. "rarajustore1@oksbi")
  upiPayeeName?: string;
  invoicePrefix: string; // e.g. "S1-", "INV-S1-"
  printerType: PrinterType;
  receiptHeader?: string;
  receiptFooter?: string;
  loginEmail?: string;
  loginPassword?: string;
  status: StoreStatus;
  createdAt: string;
  updatedAt: string;
}

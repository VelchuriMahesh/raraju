export type ExpenseCategory =
  | 'Rent'
  | 'Electricity'
  | 'Transport'
  | 'Salary'
  | 'Maintenance'
  | 'Packaging'
  | 'Tea & Refreshment'
  | 'Stationery'
  | 'Marketing'
  | 'Other';

export interface Expense {
  id: string;
  storeId?: string; // Optional: empty if global business expense
  storeName?: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  receiptUrl?: string;
  expenseDate: string; // YYYY-MM-DD
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

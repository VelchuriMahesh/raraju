export interface DailyClosing {
  id: string;
  storeId: string;
  storeName: string;
  closingDate: string; // YYYY-MM-DD
  openingCash: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  creditSales: number;
  totalSales: number;
  totalBills: number;
  expectedCash: number; // openingCash + cashSales - (cash expenses if any)
  actualCash: number; // counted by cashier
  cashDifference: number; // actualCash - expectedCash
  closingNotes?: string;
  closedBy: string;
  closedByName: string;
  closedAt: string;
}

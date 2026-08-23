import { Sale } from '../types/sale';
import { Expense } from '../types/expense';
import { StoreInventory } from '../types/inventory';
import { Product } from '../types/product';

export interface DashboardMetrics {
  totalSales: number;
  totalBills: number;
  totalItemsSold: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  estimatedNetProfit: number;
  lowStockCount: number;
  outOfStockCount: number;
  storeSales: { [storeId: string]: { storeName: string; sales: number; bills: number } };
}

export interface CustomerRateReportItem {
  invoiceNumber: string;
  storeName: string;
  employeeName: string;
  productName: string;
  sku: string;
  standardPrice: number;
  actualPrice: number;
  difference: number;
  quantity: number;
  totalDifference: number;
  reason?: string;
  date: string;
}

export const calculateDashboardMetrics = (
  sales: Sale[],
  expenses: Expense[],
  inventories: StoreInventory[],
  products: Product[]
): DashboardMetrics => {
  const activeSales = sales.filter((s) => s.status === 'COMPLETED');

  let totalSales = 0;
  let totalItemsSold = 0;
  let totalCOGS = 0;
  let grossProfit = 0;
  const storeSales: { [storeId: string]: { storeName: string; sales: number; bills: number } } = {};

  for (const s of activeSales) {
    totalSales += s.grandTotal;
    totalItemsSold += s.itemCount || 0;
    totalCOGS += s.totalCostOfGoodsSold || 0;
    grossProfit += s.grossProfit || 0;

    if (!storeSales[s.storeId]) {
      storeSales[s.storeId] = {
        storeName: s.storeName,
        sales: 0,
        bills: 0
      };
    }
    storeSales[s.storeId].sales += s.grandTotal;
    storeSales[s.storeId].bills += 1;
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const estimatedNetProfit = grossProfit - totalExpenses;

  // Inventory thresholds check
  const prodMinAlertMap: { [id: string]: number } = {};
  for (const p of products) {
    prodMinAlertMap[p.id] = p.minStockAlert || 5;
  }

  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const inv of inventories) {
    const minAlert = prodMinAlertMap[inv.productId] || 5;
    if (inv.quantity <= 0) {
      outOfStockCount++;
    } else if (inv.quantity <= minAlert) {
      lowStockCount++;
    }
  }

  return {
    totalSales: Math.round(totalSales * 100) / 100,
    totalBills: activeSales.length,
    totalItemsSold,
    totalCOGS: Math.round(totalCOGS * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    estimatedNetProfit: Math.round(estimatedNetProfit * 100) / 100,
    lowStockCount,
    outOfStockCount,
    storeSales
  };
};

export const extractCustomerRateReport = (sales: Sale[]): CustomerRateReportItem[] => {
  const result: CustomerRateReportItem[] = [];
  const activeSales = sales.filter((s) => s.status === 'COMPLETED');

  for (const sale of activeSales) {
    for (const item of sale.items) {
      if (item.customerRateApplied || item.rateDifference !== 0) {
        result.push({
          invoiceNumber: sale.invoiceNumber,
          storeName: sale.storeName,
          employeeName: sale.employeeName,
          productName: item.productName,
          sku: item.sku,
          standardPrice: item.standardPrice,
          actualPrice: item.actualPrice,
          difference: item.rateDifference,
          quantity: item.quantity,
          totalDifference: Math.round(item.rateDifference * item.quantity * 100) / 100,
          reason: item.customerRateReason || 'Custom rate override',
          date: sale.createdAt
        });
      }
    }
  }

  return result;
};

export const exportToCSV = (filename: string, rows: Record<string, any>[]): void => {
  if (!rows || !rows.length) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

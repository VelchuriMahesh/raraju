import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { DailyClosing } from '../types/dailyClosing';
import { UserProfile } from '../types/auth';
import { logAudit } from './auditService';
import { getSales } from './saleService';
import { getLocalData, setLocalData } from './fallbackData';

const CLOSINGS_COLLECTION = 'dailyClosings';

export const calculateExpectedClosing = async (
  storeId: string,
  dateString: string,
  openingCash: number
): Promise<{
  cashSales: number;
  upiSales: number;
  cardSales: number;
  creditSales: number;
  totalSales: number;
  totalBills: number;
  expectedCash: number;
}> => {
  const startOfDay = `${dateString}T00:00:00.000Z`;
  const endOfDay = `${dateString}T23:59:59.999Z`;

  const sales = await getSales(storeId, startOfDay, endOfDay, 1000);
  const activeSales = sales.filter((s) => s.status === 'COMPLETED');

  let cashSales = 0;
  let upiSales = 0;
  let cardSales = 0;
  let creditSales = 0;

  for (const s of activeSales) {
    if (s.paymentMethod === 'CASH') {
      cashSales += s.grandTotal;
    } else if (s.paymentMethod === 'UPI') {
      upiSales += s.grandTotal;
    } else if (s.paymentMethod === 'CARD') {
      cardSales += s.grandTotal;
    } else if (s.paymentMethod === 'CREDIT') {
      creditSales += s.grandTotal;
    } else if (s.paymentMethod === 'SPLIT' && s.splitPayments) {
      for (const sp of s.splitPayments) {
        if (sp.method === 'CASH') cashSales += sp.amount;
        else if (sp.method === 'UPI') upiSales += sp.amount;
        else if (sp.method === 'CARD') cardSales += sp.amount;
        else if (sp.method === 'CREDIT') creditSales += sp.amount;
      }
    }
  }

  const totalSales = cashSales + upiSales + cardSales + creditSales;
  const expectedCash = openingCash + cashSales;

  return {
    cashSales: Math.round(cashSales * 100) / 100,
    upiSales: Math.round(upiSales * 100) / 100,
    cardSales: Math.round(cardSales * 100) / 100,
    creditSales: Math.round(creditSales * 100) / 100,
    totalSales: Math.round(totalSales * 100) / 100,
    totalBills: activeSales.length,
    expectedCash: Math.round(expectedCash * 100) / 100
  };
};

export const submitDailyClosing = async (
  closingData: {
    storeId: string;
    storeName: string;
    closingDate: string;
    openingCash: number;
    actualCash: number;
    closingNotes?: string;
  },
  user: UserProfile
): Promise<DailyClosing> => {
  const calculations = await calculateExpectedClosing(
    closingData.storeId,
    closingData.closingDate,
    closingData.openingCash
  );

  const cashDifference = Math.round((closingData.actualCash - calculations.expectedCash) * 100) / 100;
  const now = new Date().toISOString();

  const closingRecord: DailyClosing = {
    id: `closing_${Date.now()}`,
    storeId: closingData.storeId,
    storeName: closingData.storeName,
    closingDate: closingData.closingDate,
    openingCash: closingData.openingCash,
    cashSales: calculations.cashSales,
    upiSales: calculations.upiSales,
    cardSales: calculations.cardSales,
    creditSales: calculations.creditSales,
    totalSales: calculations.totalSales,
    totalBills: calculations.totalBills,
    expectedCash: calculations.expectedCash,
    actualCash: closingData.actualCash,
    cashDifference,
    closingNotes: closingData.closingNotes || '',
    closedBy: user.id,
    closedByName: user.fullName,
    closedAt: now
  };

  try {
    const closingRef = doc(collection(db, CLOSINGS_COLLECTION));
    closingRecord.id = closingRef.id;
    await setDoc(closingRef, closingRecord);

    await logAudit(
      user.id,
      user.fullName,
      user.role,
      'DAILY_CLOSING_SUBMITTED',
      'DailyClosing',
      `Submitted daily cash closing for ${closingData.storeName} on ${closingData.closingDate}. Expected: ₹${calculations.expectedCash}, Actual: ₹${closingData.actualCash}, Diff: ₹${cashDifference}`,
      {
        storeId: closingData.storeId,
        storeName: closingData.storeName,
        entityId: closingRef.id,
        newValue: closingRecord
      }
    );
  } catch (err) {
    console.warn('Firestore submitDailyClosing notice, saving to local cache:', err);
  }

  const closings = getLocalData<DailyClosing[]>(CLOSINGS_COLLECTION, []);
  setLocalData(CLOSINGS_COLLECTION, [closingRecord, ...closings]);

  return closingRecord;
};

export const getDailyClosings = async (storeIdFilter?: string): Promise<DailyClosing[]> => {
  try {
    let q = query(collection(db, CLOSINGS_COLLECTION), orderBy('closingDate', 'desc'));
    if (storeIdFilter) {
      q = query(
        collection(db, CLOSINGS_COLLECTION),
        where('storeId', '==', storeIdFilter),
        orderBy('closingDate', 'desc')
      );
    }
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DailyClosing));
      setLocalData(CLOSINGS_COLLECTION, items);
      return items;
    }
  } catch (error) {
    console.warn('Firestore getDailyClosings notice, using local cache:', error);
  }

  const items = getLocalData<DailyClosing[]>(CLOSINGS_COLLECTION, []);
  return storeIdFilter ? items.filter((c) => c.storeId === storeIdFilter) : items;
};

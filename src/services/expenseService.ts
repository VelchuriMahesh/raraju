import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  orderBy,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { Expense, ExpenseCategory } from '../types/expense';
import { UserProfile } from '../types/auth';
import { logAudit } from './auditService';
import { INITIAL_EXPENSES, getLocalData, setLocalData } from './fallbackData';

const EXPENSES_COLLECTION = 'expenses';

export const createExpense = async (
  expenseData: {
    storeId?: string;
    storeName?: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
    paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
    receiptUrl?: string;
    expenseDate: string;
  },
  user: UserProfile
): Promise<Expense> => {
  const now = new Date().toISOString();
  const newExpense: Expense = {
    id: `exp_${Date.now()}`,
    storeId: expenseData.storeId || '',
    storeName: expenseData.storeName || '',
    category: expenseData.category,
    amount: expenseData.amount,
    description: expenseData.description,
    paymentMode: expenseData.paymentMode,
    receiptUrl: expenseData.receiptUrl || '',
    expenseDate: expenseData.expenseDate,
    createdBy: user.id,
    createdByName: user.fullName,
    createdAt: now
  };

  try {
    const expenseRef = doc(collection(db, EXPENSES_COLLECTION));
    newExpense.id = expenseRef.id;
    await setDoc(expenseRef, newExpense);

    await logAudit(
      user.id,
      user.fullName,
      user.role,
      'EXPENSE_RECORDED',
      'Expense',
      `Recorded ₹${newExpense.amount} expense for "${newExpense.category}" (${newExpense.description})`,
      {
        storeId: newExpense.storeId,
        storeName: newExpense.storeName,
        entityId: expenseRef.id,
        newValue: newExpense
      }
    );
  } catch (error) {
    console.warn('Firestore createExpense notice, saving to local cache:', error);
  }

  const allExpenses = getLocalData<Expense[]>(EXPENSES_COLLECTION, INITIAL_EXPENSES);
  const updated = [newExpense, ...allExpenses.filter((e) => e.id !== newExpense.id)];
  setLocalData(EXPENSES_COLLECTION, updated);

  return newExpense;
};

export const getExpenses = async (
  storeIdFilter?: string,
  startDate?: string,
  endDate?: string
): Promise<Expense[]> => {
  try {
    let q = query(collection(db, EXPENSES_COLLECTION), orderBy('expenseDate', 'desc'));
    
    if (storeIdFilter) {
      q = query(
        collection(db, EXPENSES_COLLECTION),
        where('storeId', '==', storeIdFilter),
        orderBy('expenseDate', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      let expenses = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
      if (startDate) expenses = expenses.filter((e) => e.expenseDate >= startDate);
      if (endDate) expenses = expenses.filter((e) => e.expenseDate <= endDate);
      setLocalData(EXPENSES_COLLECTION, expenses);
      return expenses;
    }
  } catch (error) {
    console.warn('Firestore getExpenses notice, using local cache:', error);
  }

  let expenses = getLocalData<Expense[]>(EXPENSES_COLLECTION, INITIAL_EXPENSES);
  if (storeIdFilter) expenses = expenses.filter((e) => e.storeId === storeIdFilter);
  if (startDate) expenses = expenses.filter((e) => e.expenseDate >= startDate);
  if (endDate) expenses = expenses.filter((e) => e.expenseDate <= endDate);
  return expenses;
};

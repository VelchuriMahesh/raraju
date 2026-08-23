import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { Customer } from '../types/settings';
import { getLocalData, setLocalData } from './fallbackData';

const CUSTOMERS_COLLECTION = 'customers';

export const getCustomers = async (): Promise<Customer[]> => {
  try {
    const q = query(collection(db, CUSTOMERS_COLLECTION), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const customers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
      setLocalData(CUSTOMERS_COLLECTION, customers);
      return customers;
    }
  } catch (error) {
    console.warn('Firestore getCustomers notice, using local cache:', error);
  }
  return getLocalData<Customer[]>(CUSTOMERS_COLLECTION, []);
};

export const getCustomerByPhone = async (phone: string): Promise<Customer | null> => {
  try {
    const docRef = doc(db, CUSTOMERS_COLLECTION, phone);
    const snap = await getDoc(docRef);
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Customer;
  } catch (error) {
    console.warn(`Firestore getCustomerByPhone notice (${phone}), using local cache:`, error);
  }

  const customers = getLocalData<Customer[]>(CUSTOMERS_COLLECTION, []);
  return customers.find((c) => c.phone === phone) || null;
};

export const saveCustomer = async (customerData: {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  additionalSpend?: number;
}): Promise<Customer> => {
  const customerId = customerData.phone.replace(/[^0-9]/g, '') || `CUST_${Date.now()}`;
  const now = new Date().toISOString();

  let customerResult: Customer = {
    id: customerId,
    name: customerData.name,
    phone: customerData.phone,
    email: customerData.email || '',
    address: customerData.address || '',
    gstin: customerData.gstin || '',
    totalOrders: customerData.additionalSpend ? 1 : 0,
    totalSpent: customerData.additionalSpend || 0,
    lastPurchaseDate: customerData.additionalSpend ? now : '',
    createdAt: now,
    updatedAt: now
  };

  try {
    const docRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const existing = snap.data() as Customer;
      const updated: Partial<Customer> = {
        name: customerData.name || existing.name,
        email: customerData.email || existing.email,
        address: customerData.address || existing.address,
        gstin: customerData.gstin || existing.gstin,
        totalOrders: (existing.totalOrders || 0) + (customerData.additionalSpend ? 1 : 0),
        totalSpent: (existing.totalSpent || 0) + (customerData.additionalSpend || 0),
        lastPurchaseDate: customerData.additionalSpend ? now : existing.lastPurchaseDate,
        updatedAt: now
      };
      await updateDoc(docRef, updated);
      customerResult = { ...existing, ...updated } as Customer;
    } else {
      await setDoc(docRef, customerResult);
    }
  } catch (err) {
    console.warn('Firestore saveCustomer notice, saving to local cache:', err);
  }

  const customers = getLocalData<Customer[]>(CUSTOMERS_COLLECTION, []);
  const updatedList = [customerResult, ...customers.filter((c) => c.id !== customerId)];
  setLocalData(CUSTOMERS_COLLECTION, updatedList);

  return customerResult;
};

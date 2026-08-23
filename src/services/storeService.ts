import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { Store, StoreStatus } from '../types/store';
import { logAudit } from './auditService';
import { UserProfile } from '../types/auth';
import { INITIAL_STORES, getLocalData, setLocalData } from './fallbackData';

const STORES_COLLECTION = 'stores';

export const getStores = async (onlyActive = false): Promise<Store[]> => {
  try {
    let q = query(collection(db, STORES_COLLECTION), orderBy('createdAt', 'desc'));
    if (onlyActive) {
      q = query(
        collection(db, STORES_COLLECTION),
        where('status', '==', 'ACTIVE'),
        orderBy('createdAt', 'desc')
      );
    }
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const stores = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Store));
      setLocalData(STORES_COLLECTION, stores);
      return stores;
    }
  } catch (error) {
    console.warn('Firestore getStores notice, using local cache:', error);
  }
  const cached = getLocalData<Store[]>(STORES_COLLECTION, INITIAL_STORES);
  return onlyActive ? cached.filter((s) => s.status === 'ACTIVE') : cached;
};

export const subscribeToStores = (
  callback: (stores: Store[]) => void,
  onlyActive = false
): (() => void) => {
  try {
    let q = query(collection(db, STORES_COLLECTION), orderBy('createdAt', 'desc'));
    if (onlyActive) {
      q = query(
        collection(db, STORES_COLLECTION),
        where('status', '==', 'ACTIVE'),
        orderBy('createdAt', 'desc')
      );
    }

    return onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const stores = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Store));
          setLocalData(STORES_COLLECTION, stores);
          callback(stores);
        } else {
          const cached = getLocalData<Store[]>(STORES_COLLECTION, INITIAL_STORES);
          callback(onlyActive ? cached.filter((s) => s.status === 'ACTIVE') : cached);
        }
      },
      (error) => {
        console.warn('Firestore subscribeToStores fallback:', error);
        const cached = getLocalData<Store[]>(STORES_COLLECTION, INITIAL_STORES);
        callback(onlyActive ? cached.filter((s) => s.status === 'ACTIVE') : cached);
      }
    );
  } catch (err) {
    console.warn('Firestore subscribeToStores init error:', err);
    const cached = getLocalData<Store[]>(STORES_COLLECTION, INITIAL_STORES);
    callback(onlyActive ? cached.filter((s) => s.status === 'ACTIVE') : cached);
    return () => {};
  }
};

export const getStoreById = async (storeId: string): Promise<Store | null> => {
  try {
    const docRef = doc(db, STORES_COLLECTION, storeId);
    const snap = await getDoc(docRef);
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Store;
  } catch (error) {
    console.warn(`Firestore getStoreById notice (${storeId}), using local cache:`, error);
  }
  const stores = getLocalData<Store[]>(STORES_COLLECTION, INITIAL_STORES);
  return stores.find((s) => s.id === storeId) || null;
};

export const createStore = async (
  storeData: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>,
  adminUser: UserProfile
): Promise<Store> => {
  const now = new Date().toISOString();
  const newStoreId = `store_${Date.now()}`;
  const newStore: Store = {
    id: newStoreId,
    ...storeData,
    createdAt: now,
    updatedAt: now
  };

  try {
    const storeRef = doc(db, STORES_COLLECTION, newStoreId);
    await setDoc(storeRef, newStore);

    await logAudit(
      adminUser.id,
      adminUser.fullName,
      adminUser.role,
      'STORE_CREATED',
      'Store',
      `Created new store branch "${storeData.name}" (${storeData.code})`,
      {
        entityId: newStoreId,
        newValue: storeData
      }
    );
  } catch (error) {
    console.warn('Firestore createStore notice, saving to local cache:', error);
  }

  const stores = getLocalData<Store[]>(STORES_COLLECTION, INITIAL_STORES);
  const updated = [newStore, ...stores];
  setLocalData(STORES_COLLECTION, updated);

  return newStore;
};

export const updateStore = async (
  storeId: string,
  updates: Partial<Store>,
  adminUser: UserProfile
): Promise<void> => {
  try {
    const storeRef = doc(db, STORES_COLLECTION, storeId);
    await updateDoc(storeRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    await logAudit(
      adminUser.id,
      adminUser.fullName,
      adminUser.role,
      'STORE_UPDATED',
      'Store',
      `Updated store branch details for store ID: ${storeId}`,
      {
        entityId: storeId,
        newValue: updates
      }
    );
  } catch (error) {
    console.warn(`Firestore updateStore notice (${storeId}), updating local cache:`, error);
  }

  const stores = getLocalData<Store[]>(STORES_COLLECTION, INITIAL_STORES);
  const updated = stores.map((s) => (s.id === storeId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s));
  setLocalData(STORES_COLLECTION, updated);
};

export const toggleStoreStatus = async (
  storeId: string,
  status: StoreStatus,
  adminUser: UserProfile
): Promise<void> => {
  await updateStore(storeId, { status }, adminUser);
};

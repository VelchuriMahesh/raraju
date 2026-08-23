import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile, UserRole, UserStatus } from '../types/auth';
import { logAudit } from './auditService';
import { getLocalData, setLocalData } from './fallbackData';

const USERS_COLLECTION = 'users';

const INITIAL_USERS: UserProfile[] = [
  {
    id: 'admin_master_001',
    email: 'admin@raraju.com',
    fullName: 'Super Administrator',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    employeeId: 'EMP-ADM-01',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'admin_raraju_002',
    email: 'raraju@gmail.com',
    fullName: 'RARAJU Admin',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    employeeId: 'EMP-ADM-02',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'staff_ravi_001',
    email: 'ravi@store1.raraju.com',
    fullName: 'Ravi Kumar',
    role: 'STORE_STAFF',
    storeId: 'store_1_main',
    storeName: 'Main Branch (ప్రధాన బ్రాంచ్)',
    employeeId: 'EMP-S1-01',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const normalizeUserProfile = (id: string, rawData: any): UserProfile => {
  const email = (rawData.email || '').toLowerCase().trim();
  const isAdmin =
    rawData.role === 'SUPER_ADMIN' ||
    email === 'raraju@gmail.com' ||
    email.includes('admin') ||
    email === 'admin@raraju.com';

  const role: UserRole = isAdmin ? 'SUPER_ADMIN' : (rawData.role as UserRole) || 'STORE_STAFF';
  const fullName = rawData.fullName || rawData.name || rawData.displayName || (isAdmin ? 'Admin' : 'Store Staff');
  const status: UserStatus =
    rawData.status === 'INACTIVE' || rawData.status === 'DISABLED' ? 'INACTIVE' : 'ACTIVE';

  return {
    id: id || rawData.uid || `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    fullName,
    role,
    storeId: isAdmin ? undefined : rawData.storeId || undefined,
    storeName: isAdmin ? undefined : rawData.storeName || undefined,
    phone: rawData.phone || undefined,
    employeeId: rawData.employeeId || (isAdmin ? 'EMP-ADM-01' : 'EMP-STAFF-01'),
    status,
    createdAt: rawData.createdAt || new Date().toISOString(),
    updatedAt: rawData.updatedAt || new Date().toISOString()
  };
};

export const getUsers = async (storeIdFilter?: string): Promise<UserProfile[]> => {
  try {
    let q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
    if (storeIdFilter) {
      q = query(
        collection(db, USERS_COLLECTION),
        where('storeId', '==', storeIdFilter),
        orderBy('createdAt', 'desc')
      );
    }
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const users = snapshot.docs.map((d) => normalizeUserProfile(d.id, d.data()));
      setLocalData(USERS_COLLECTION, users);
      return users;
    }
  } catch (error) {
    console.warn('Firestore getUsers notice, using local cache:', error);
  }

  const users = getLocalData<UserProfile[]>(USERS_COLLECTION, INITIAL_USERS);
  return storeIdFilter ? users.filter((u) => u.storeId === storeIdFilter) : users;
};

export const getUserById = async (userId: string): Promise<UserProfile | null> => {
  if (!userId) return null;
  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return normalizeUserProfile(snap.id, snap.data());
    }
  } catch (error) {
    console.warn(`Firestore getUserById notice (${userId}), using local cache:`, error);
  }

  // Also try query by email in Firestore
  try {
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', userId.toLowerCase().trim()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0];
      return normalizeUserProfile(docData.id, docData.data());
    }
  } catch (e) {}

  const users = getLocalData<UserProfile[]>(USERS_COLLECTION, INITIAL_USERS);
  const found = users.find((u) => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());
  return found ? normalizeUserProfile(found.id, found) : null;
};

export const getUserByEmail = async (email: string): Promise<UserProfile | null> => {
  const cleanEmail = email.toLowerCase().trim();
  try {
    const q = query(collection(db, USERS_COLLECTION), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0];
      return normalizeUserProfile(docData.id, docData.data());
    }
  } catch (e) {
    console.warn('Firestore getUserByEmail fallback:', e);
  }

  const users = getLocalData<UserProfile[]>(USERS_COLLECTION, INITIAL_USERS);
  const found = users.find((u) => u.email.toLowerCase() === cleanEmail);
  return found ? normalizeUserProfile(found.id, found) : null;
};

export const createUserProfile = async (
  userId: string,
  userData: {
    email: string;
    fullName: string;
    role: UserRole;
    storeId?: string;
    storeName?: string;
    phone?: string;
    employeeId?: string;
    status: UserStatus;
  },
  adminUser?: UserProfile
): Promise<UserProfile> => {
  const now = new Date().toISOString();
  const newUser: UserProfile = {
    id: userId,
    ...userData,
    createdAt: now,
    updatedAt: now
  };

  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(userRef, newUser);

    if (adminUser) {
      await logAudit(
        adminUser.id,
        adminUser.fullName,
        adminUser.role,
        'USER_CREATED',
        'User',
        `Created ${userData.role} account for "${userData.fullName}" (${userData.email})`,
        {
          storeId: userData.storeId,
          storeName: userData.storeName,
          entityId: userId,
          newValue: { email: userData.email, role: userData.role, storeId: userData.storeId }
        }
      );
    }
  } catch (error) {
    console.warn('Firestore createUserProfile notice, saving to local cache:', error);
  }

  const users = getLocalData<UserProfile[]>(USERS_COLLECTION, INITIAL_USERS);
  const updated = [newUser, ...users.filter((u) => u.id !== userId)];
  setLocalData(USERS_COLLECTION, updated);

  return newUser;
};

export const updateUserProfile = async (
  userId: string,
  updates: Partial<UserProfile>,
  adminUser: UserProfile
): Promise<void> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, { ...updates, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.warn(`Firestore updateUserProfile notice (${userId}), updating local cache:`, error);
  }

  const users = getLocalData<UserProfile[]>(USERS_COLLECTION, INITIAL_USERS);
  const updated = users.map((u) => (u.id === userId ? { ...u, ...updates, updatedAt: new Date().toISOString() } : u));
  setLocalData(USERS_COLLECTION, updated);
};

export const toggleUserStatus = async (
  userId: string,
  status: UserStatus,
  adminUser: UserProfile
): Promise<void> => {
  await updateUserProfile(userId, { status }, adminUser);
};

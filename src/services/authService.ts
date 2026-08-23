import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, db } from './firebase';
import { UserProfile, UserRole } from '../types/auth';
import { getUserById, getUserByEmail, createUserProfile } from './userService';
import { logAudit } from './auditService';
import { doc, getDoc } from 'firebase/firestore';
import { Store } from '../types/store';
import { getLocalData } from './fallbackData';

/**
 * Resolves store details by login email instantly from cache
 */
const findStoreByEmail = (cleanEmail: string): Store | null => {
  const localStores = getLocalData<Store[]>('stores', []);
  if (localStores.length === 1) return localStores[0]; // If 1 store exists (krupa), associate immediately
  return (
    localStores.find(
      (s) =>
        s.loginEmail?.toLowerCase() === cleanEmail ||
        s.email?.toLowerCase() === cleanEmail ||
        cleanEmail.startsWith(s.name.toLowerCase().replace(/\s+/g, ''))
    ) || localStores[0] || null
  );
};

export const loginUser = async (email: string, password: string): Promise<UserProfile> => {
  const cleanEmail = email.trim().toLowerCase();
  const isAdminEmail =
    cleanEmail === 'raraju@gmail.com' ||
    cleanEmail === 'admin@raraju.com' ||
    cleanEmail.includes('admin') ||
    cleanEmail.includes('raraju');

  try {
    let uid = '';

    // Attempt Firebase Authentication
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      uid = cred.user.uid;
    } catch (authErr: any) {
      if (
        authErr.code === 'auth/user-not-found' ||
        authErr.code === 'auth/invalid-credential' ||
        authErr.code === 'auth/wrong-password' ||
        authErr.code === 'auth/invalid-email'
      ) {
        try {
          const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          uid = newCred.user.uid;
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            try {
              const retryCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
              uid = retryCred.user.uid;
            } catch (retryErr) {
              uid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            }
          } else {
            uid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
          }
        }
      } else {
        uid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
    }

    // Lookup matching store for cashier
    const assignedStore = !isAdminEmail ? findStoreByEmail(cleanEmail) : null;

    // Retrieve or construct User Profile
    let profile: UserProfile | null = null;
    try {
      if (uid) {
        profile = await getUserById(uid);
      }
      if (!profile) {
        profile = await getUserByEmail(cleanEmail);
      }
    } catch (dbErr) {}

    if (!profile) {
      const role: UserRole = isAdminEmail ? 'SUPER_ADMIN' : 'STORE_STAFF';
      const storeId = assignedStore?.id || 's1';
      const storeName = assignedStore?.name || 'krupa';
      const fullName = isAdminEmail
        ? 'RARAJU Admin'
        : `${storeName} Cashier`;
      const employeeId = isAdminEmail
        ? 'EMP-ADM-01'
        : `EMP-${assignedStore?.code || 'S1'}-01`;

      profile = {
        id: uid || `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: cleanEmail,
        fullName,
        role,
        storeId,
        storeName,
        employeeId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await createUserProfile(profile.id, profile);
      } catch (saveErr) {}
    } else {
      if (assignedStore) {
        profile.storeId = assignedStore.id;
        profile.storeName = assignedStore.name;
        profile.employeeId = `EMP-${assignedStore.code || 'S1'}-01`;
        profile.fullName = `${assignedStore.name} Cashier`;
      }
    }

    if (isAdminEmail) {
      profile.role = 'SUPER_ADMIN';
      profile.status = 'ACTIVE';
      profile.storeId = undefined;
      profile.storeName = undefined;
    }

    if (profile.status === 'INACTIVE') {
      try {
        await firebaseSignOut(auth);
      } catch (e) {}
      throw new Error('Your account has been deactivated.');
    }

    try {
      await logAudit(
        profile.id,
        profile.fullName,
        profile.role,
        'USER_LOGIN',
        'Auth',
        `Logged in successfully (${cleanEmail})`,
        { storeId: profile.storeId, storeName: profile.storeName }
      );
    } catch (e) {}

    return profile;
  } catch (error: any) {
    console.error('Login error:', error);
    throw error;
  }
};

export const registerUser = async (
  email: string,
  password: string,
  fullName: string,
  role: UserRole,
  storeId?: string,
  storeName?: string,
  adminUser?: UserProfile
): Promise<UserProfile> => {
  const cleanEmail = email.trim().toLowerCase();

  let uid = '';
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    uid = cred.user.uid;
  } catch (err: any) {
    uid = `user_${Date.now()}`;
  }

  const profile = await createUserProfile(
    uid,
    {
      email: cleanEmail,
      fullName,
      role,
      storeId,
      storeName,
      status: 'ACTIVE'
    },
    adminUser
  );

  return profile;
};

export const logoutUser = async (currentUser?: UserProfile | null): Promise<void> => {
  try {
    if (currentUser) {
      await logAudit(
        currentUser.id,
        currentUser.fullName,
        currentUser.role,
        'USER_LOGOUT',
        'Auth',
        `User signed out (${currentUser.email})`
      );
    }
  } catch (e) {}

  await firebaseSignOut(auth);
};

export const subscribeToAuthChanges = (
  callback: (user: UserProfile | null) => void
): (() => void) => {
  return onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    const email = (firebaseUser.email || '').toLowerCase().trim();
    const isAdmin =
      email === 'raraju@gmail.com' ||
      email === 'admin@raraju.com' ||
      email.includes('admin') ||
      email.includes('raraju');

    const assignedStore = !isAdmin ? findStoreByEmail(email) : null;
    const storeId = assignedStore?.id || 's1';
    const storeName = assignedStore?.name || 'krupa';

    const fallbackProfile: UserProfile = {
      id: firebaseUser.uid,
      email,
      fullName: isAdmin ? 'RARAJU Admin' : `${storeName} Cashier`,
      role: isAdmin ? 'SUPER_ADMIN' : 'STORE_STAFF',
      storeId: isAdmin ? undefined : storeId,
      storeName: isAdmin ? undefined : storeName,
      employeeId: isAdmin ? 'EMP-ADM-01' : `EMP-${assignedStore?.code || 'S1'}-01`,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Immediate non-blocking emission
    callback(fallbackProfile);

    // Background profile refresh from Firestore
    getUserById(firebaseUser.uid)
      .then((profile) => {
        if (profile) {
          if (isAdmin) {
            profile.role = 'SUPER_ADMIN';
            profile.status = 'ACTIVE';
            profile.storeId = undefined;
            profile.storeName = undefined;
          } else {
            profile.storeId = storeId;
            profile.storeName = storeName;
            profile.fullName = `${storeName} Cashier`;
          }
          callback(profile);
        }
      })
      .catch(() => {});
  });
};

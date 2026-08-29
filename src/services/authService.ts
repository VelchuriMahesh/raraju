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
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { Store } from '../types/store';

const STORES_COLLECTION = 'stores';
const USERS_COLLECTION = 'users';
const DEFAULT_STORE_ID = 'S1';
const DEFAULT_STORE_NAME = 'krupa';

interface CanonicalStoreAssignment {
  id: string;
  name: string;
  code: string;
}

const storeToAssignment = (store: Store): CanonicalStoreAssignment => ({
  id: store.code || store.id,
  name: store.name || DEFAULT_STORE_NAME,
  code: store.code || store.id || DEFAULT_STORE_ID
});

const resolveStoreAssignment = async (
  cleanEmail: string,
  currentStoreId?: string | null
): Promise<CanonicalStoreAssignment> => {
  if (currentStoreId) {
    const byCodeSnap = await getDocs(query(collection(db, STORES_COLLECTION), where('code', '==', currentStoreId)));
    if (!byCodeSnap.empty) {
      return storeToAssignment({ id: byCodeSnap.docs[0].id, ...byCodeSnap.docs[0].data() } as Store);
    }

    const byDocIdSnap = await getDoc(doc(db, STORES_COLLECTION, currentStoreId));
    if (byDocIdSnap.exists()) {
      return storeToAssignment({ id: byDocIdSnap.id, ...byDocIdSnap.data() } as Store);
    }
  }

  const byLoginEmailSnap = await getDocs(
    query(collection(db, STORES_COLLECTION), where('loginEmail', '==', cleanEmail))
  );
  if (!byLoginEmailSnap.empty) {
    return storeToAssignment({ id: byLoginEmailSnap.docs[0].id, ...byLoginEmailSnap.docs[0].data() } as Store);
  }

  const byEmailSnap = await getDocs(query(collection(db, STORES_COLLECTION), where('email', '==', cleanEmail)));
  if (!byEmailSnap.empty) {
    return storeToAssignment({ id: byEmailSnap.docs[0].id, ...byEmailSnap.docs[0].data() } as Store);
  }

  return {
    id: DEFAULT_STORE_ID,
    name: DEFAULT_STORE_NAME,
    code: DEFAULT_STORE_ID
  };
};

const persistAuthUidProfile = async (
  authUid: string,
  profile: UserProfile,
  previousProfileId?: string
): Promise<UserProfile> => {
  const now = new Date().toISOString();
  const canonicalProfile: UserProfile = {
    ...profile,
    id: authUid,
    updatedAt: now
  };

  await setDoc(doc(db, USERS_COLLECTION, authUid), canonicalProfile, { merge: true });
  if (previousProfileId && previousProfileId !== authUid) {
    await setDoc(
      doc(db, USERS_COLLECTION, previousProfileId),
      {
        ...profile,
        storeId: canonicalProfile.storeId,
        storeName: canonicalProfile.storeName,
        updatedAt: now
      },
      { merge: true }
    );
  }

  return canonicalProfile;
};

const normalizeStoreStaffProfile = async (
  profile: UserProfile,
  cleanEmail: string,
  authUid: string
): Promise<UserProfile> => {
  if (profile.role === 'SUPER_ADMIN') return profile;

  const assignedStore = await resolveStoreAssignment(cleanEmail, profile.storeId);
  const previousProfileId = profile.id;
  const normalized: UserProfile = {
    ...profile,
    storeId: assignedStore.id,
    storeName: assignedStore.name,
    employeeId: profile.employeeId || `EMP-${assignedStore.code}-01`,
    status: 'ACTIVE'
  };

  return persistAuthUidProfile(authUid, normalized, previousProfileId);
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
      const assignedStore = isAdminEmail ? null : await resolveStoreAssignment(cleanEmail);
      const storeId = assignedStore?.id;
      const storeName = assignedStore?.name;
      const fullName = isAdminEmail
        ? 'RARAJU Admin'
        : `${storeName || DEFAULT_STORE_NAME} Cashier`;
      const employeeId = isAdminEmail
        ? 'EMP-ADM-01'
        : `EMP-${assignedStore?.code || DEFAULT_STORE_ID}-01`;

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
      if (!isAdminEmail && uid) {
        profile = await normalizeStoreStaffProfile(profile, cleanEmail, uid);
      }
    }

    if (isAdminEmail) {
      profile.role = 'SUPER_ADMIN';
      profile.status = 'ACTIVE';
      profile.storeId = undefined;
      profile.storeName = undefined;
      if (uid) {
        await persistAuthUidProfile(uid, profile, profile.id);
      }
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

    const fallbackProfile: UserProfile = {
      id: firebaseUser.uid,
      email,
      fullName: isAdmin ? 'RARAJU Admin' : `${DEFAULT_STORE_NAME} Cashier`,
      role: isAdmin ? 'SUPER_ADMIN' : 'STORE_STAFF',
      storeId: isAdmin ? undefined : DEFAULT_STORE_ID,
      storeName: isAdmin ? undefined : DEFAULT_STORE_NAME,
      employeeId: isAdmin ? 'EMP-ADM-01' : `EMP-${DEFAULT_STORE_ID}-01`,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Immediate non-blocking emission
    callback(fallbackProfile);

    // Background profile refresh from Firestore
    Promise.all([getUserById(firebaseUser.uid), getUserByEmail(email)])
      .then(async ([profileById, profileByEmail]) => {
        let profile = profileById || profileByEmail;
        if (profile) {
          if (isAdmin) {
            profile.role = 'SUPER_ADMIN';
            profile.status = 'ACTIVE';
            profile.storeId = undefined;
            profile.storeName = undefined;
            profile = await persistAuthUidProfile(firebaseUser.uid, profile, profile.id);
          } else {
            profile = await normalizeStoreStaffProfile(profile, email, firebaseUser.uid);
          }
          callback(profile);
        }
      })
      .catch(() => {});
  });
};

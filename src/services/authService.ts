import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from './firebase';
import { UserProfile, UserRole } from '../types/auth';
import { getUserById, getUserByEmail, createUserProfile } from './userService';
import { logAudit } from './auditService';
import { Store } from '../types/store';
import { getLocalData } from './fallbackData';
import { getStores } from './storeService';
import { isAdminEmail } from './adminConfig';

export { isAdminEmail };

const friendlyAuthError = (err: any): Error => {
  switch (err?.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
      return new Error('Incorrect email or password. Please try again.');
    case 'auth/invalid-email':
      return new Error('That email address is not valid.');
    case 'auth/user-disabled':
      return new Error('This account has been disabled. Contact the administrator.');
    case 'auth/too-many-requests':
      return new Error('Too many failed attempts. Please wait a moment and try again.');
    case 'auth/network-request-failed':
      return new Error('No network connection. Please check your internet and retry.');
    case 'auth/weak-password':
      return new Error('Password is too weak. Use at least 6 characters.');
    default:
      return new Error(err?.message || 'Login failed. Please try again.');
  }
};

/**
 * Resolves which branch a cashier belongs to.
 *
 * Order matters: the store the ADMIN assigned on the user record always wins, so that
 * re-assigning a cashier in the admin panel actually takes effect. Only when no
 * assignment exists do we fall back to matching the store's configured login email.
 *
 * This deliberately returns null rather than "the first store in the list" — the old
 * blanket `|| localStores[0]` fallback handed every unrecognised login the keys to
 * branch #1 and silently overrode whatever the admin had configured.
 */
const resolveAssignedStore = (
  cleanEmail: string,
  profileStoreId?: string,
  storesOverride?: Store[]
): Store | null => {
  const stores = storesOverride?.length
    ? storesOverride
    : getLocalData<Store[]>('stores', []);

  if (profileStoreId) {
    const byId = stores.find((s) => s.id === profileStoreId);
    if (byId) return byId;
  }

  return (
    stores.find(
      (s) =>
        s.loginEmail?.toLowerCase().trim() === cleanEmail ||
        s.email?.toLowerCase().trim() === cleanEmail
    ) || null
  );
};

/**
 * Applies the admin-controlled record on top of a profile: role, branch assignment and
 * display name all come from Firestore, NOT from guesses about the email address.
 */
const applyRoleAndStore = (
  profile: UserProfile,
  cleanEmail: string,
  assignedStore: Store | null
): UserProfile => {
  const admin = isAdminEmail(cleanEmail) || profile.role === 'SUPER_ADMIN';

  if (admin) {
    profile.role = 'SUPER_ADMIN';
    profile.storeId = undefined;
    profile.storeName = undefined;
    return profile;
  }

  profile.role = 'STORE_STAFF';
  if (assignedStore) {
    profile.storeId = assignedStore.id;
    profile.storeName = assignedStore.name;
    // Keep the name/employee id the admin entered; only fill in when blank.
    if (!profile.employeeId) profile.employeeId = `EMP-${assignedStore.code || 'S1'}-01`;
    if (!profile.fullName) profile.fullName = `${assignedStore.name} Cashier`;
  }
  return profile;
};

export const loginUser = async (email: string, password: string): Promise<UserProfile> => {
  const cleanEmail = email.trim().toLowerCase();
  const adminEmail = isAdminEmail(cleanEmail);

  // 1. Authenticate. A failure here is FATAL — we never fabricate a local uid.
  //
  // The previous implementation fell back to `uid = user_<email>` whenever Firebase
  // rejected the credentials, then loaded that email's profile from Firestore anyway.
  // The practical effect was that ANY password logged you in as the matching user,
  // including the super admin.
  let uid = '';
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    uid = cred.user.uid;
  } catch (authErr: any) {
    const firstTimeCodes = [
      'auth/user-not-found',
      'auth/invalid-credential',
      'auth/wrong-password'
    ];
    if (!firstTimeCodes.includes(authErr.code)) {
      throw friendlyAuthError(authErr);
    }
    // The address may simply not have an auth account yet (stores are provisioned on
    // first login). Creating it only succeeds when the email is genuinely unused; if
    // the account exists, the password was wrong and we surface that.
    try {
      const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      uid = newCred.user.uid;
    } catch (createErr: any) {
      if (createErr.code === 'auth/email-already-in-use') {
        throw new Error('Incorrect password for this account. Please try again.');
      }
      throw friendlyAuthError(createErr);
    }
  }

  // 2. Load the admin-managed profile: by uid first, then by email (store logins are
  // created by the admin under a `user_<email>` document id, so the uid will not match).
  let profile: UserProfile | null = null;
  try {
    profile = await getUserById(uid);
    if (!profile) profile = await getUserByEmail(cleanEmail);
  } catch (dbErr) {
    console.warn('Profile lookup failed, continuing with defaults:', dbErr);
  }

  // 3. Resolve the branch from live store data (not just the local cache).
  let stores: Store[] = [];
  try {
    stores = await getStores();
  } catch (e) {
    stores = getLocalData<Store[]>('stores', []);
  }
  const assignedStore = adminEmail
    ? null
    : resolveAssignedStore(cleanEmail, profile?.storeId, stores);

  if (!profile) {
    const role: UserRole = adminEmail ? 'SUPER_ADMIN' : 'STORE_STAFF';
    const now = new Date().toISOString();
    profile = {
      id: uid,
      email: cleanEmail,
      fullName: adminEmail
        ? 'RARAJU Admin'
        : `${assignedStore?.name || 'Store'} Cashier`,
      role,
      storeId: assignedStore?.id,
      storeName: assignedStore?.name,
      employeeId: adminEmail ? 'EMP-ADM-01' : `EMP-${assignedStore?.code || 'S1'}-01`,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };

    try {
      await createUserProfile(profile.id, profile);
    } catch (saveErr) {
      console.warn('Could not persist new user profile:', saveErr);
    }
  }

  profile = applyRoleAndStore(profile, cleanEmail, assignedStore);

  if (profile.status === 'INACTIVE') {
    try {
      await firebaseSignOut(auth);
    } catch (e) {}
    throw new Error('Your account has been deactivated.');
  }

  // A cashier whose branch has been switched off must not be able to bill.
  if (profile.role === 'STORE_STAFF' && assignedStore && assignedStore.status === 'INACTIVE') {
    try {
      await firebaseSignOut(auth);
    } catch (e) {}
    throw new Error(`Store "${assignedStore.name}" is currently deactivated. Contact the administrator.`);
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

  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    uid = cred.user.uid;
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      throw new Error(`An account already exists for ${cleanEmail}.`);
    }
    throw friendlyAuthError(err);
  }

  return createUserProfile(
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
    const adminEmail = isAdminEmail(email);

    // Provisional profile so the UI can paint immediately on reload.
    const cachedStore = adminEmail ? null : resolveAssignedStore(email);
    const now = new Date().toISOString();
    callback({
      id: firebaseUser.uid,
      email,
      fullName: adminEmail ? 'RARAJU Admin' : `${cachedStore?.name || 'Store'} Cashier`,
      role: adminEmail ? 'SUPER_ADMIN' : 'STORE_STAFF',
      storeId: adminEmail ? undefined : cachedStore?.id,
      storeName: adminEmail ? undefined : cachedStore?.name,
      employeeId: adminEmail ? 'EMP-ADM-01' : `EMP-${cachedStore?.code || 'S1'}-01`,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    });

    // Authoritative refresh. Looking the profile up by EMAIL as well as by uid is
    // essential: the admin panel creates store logins under a `user_<email>` document
    // id, so a uid-only lookup never found them and every page reload fell back to the
    // guessed profile above — which is why admin edits appeared not to stick.
    (async () => {
      try {
        let profile = await getUserById(firebaseUser.uid);
        if (!profile) profile = await getUserByEmail(email);
        if (!profile) return;

        let stores: Store[] = [];
        try {
          stores = await getStores();
        } catch (e) {
          stores = getLocalData<Store[]>('stores', []);
        }

        const assignedStore = adminEmail
          ? null
          : resolveAssignedStore(email, profile.storeId, stores);

        callback(applyRoleAndStore(profile, email, assignedStore));
      } catch (e) {
        console.warn('Background profile refresh failed:', e);
      }
    })();
  });
};

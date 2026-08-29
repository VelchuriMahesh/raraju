import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAkP5VGjwAri7Wba0L1a4CtUppws08TPBY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "raraju-9d165.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "raraju-9d165",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "raraju-9d165.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "446443729658",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:446443729658:web:f95e461f2376c799794f43",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DD9293FHHK"
};

// Initialize Firebase App
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Modern Firebase v10 Multi-Tab Persistent Firestore Initialization
//
// ignoreUndefinedProperties is REQUIRED: many documents in this app carry optional
// fields (assignment `notes`, product `description`/`barcode`, admin `storeId`, ...).
// Without this flag Firestore rejects the whole write with
// "Unsupported field value: undefined", which previously made every Daily Stock
// Assignment silently fail to reach the cloud.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (e) {
    // If already initialized, get existing instance
    return getFirestore(app);
  }
})();

export default app;

/**
 * Recursively removes `undefined` values so a document can never be rejected with
 * "Unsupported field value: undefined". `ignoreUndefinedProperties` above already
 * covers this, but the getFirestore() fallback branch does not inherit that setting,
 * so writes still pass their payload through this helper.
 */
export const stripUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined) out[k] = stripUndefined(v);
    });
    return out as T;
  }
  return value;
};

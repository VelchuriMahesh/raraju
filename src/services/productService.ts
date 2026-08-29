import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db, stripUndefined } from './firebase';
import { Product, Category, ProductStatus } from '../types/product';
import { logAudit } from './auditService';
import { UserProfile } from '../types/auth';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  getLocalData,
  setLocalData
} from './fallbackData';

const PRODUCTS_COLLECTION = 'products';
const CATEGORIES_COLLECTION = 'categories';

// Category Services
export const getCategories = async (): Promise<Category[]> => {
  try {
    const q = query(collection(db, CATEGORIES_COLLECTION), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const cats = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
      setLocalData(CATEGORIES_COLLECTION, cats);
      return cats;
    }
  } catch (error) {
    console.warn('Firestore getCategories notice, using local cache:', error);
  }
  return getLocalData<Category[]>(CATEGORIES_COLLECTION, INITIAL_CATEGORIES);
};

export const createCategory = async (
  name: string,
  description?: string,
  adminUser?: UserProfile
): Promise<Category> => {
  const now = new Date().toISOString();
  const newCat: Category = {
    id: `cat_${Date.now()}`,
    name,
    description,
    createdAt: now,
    updatedAt: now
  };

  try {
    const ref = doc(collection(db, CATEGORIES_COLLECTION));
    newCat.id = ref.id;
    await setDoc(ref, newCat);

    if (adminUser) {
      await logAudit(
        adminUser.id,
        adminUser.fullName,
        adminUser.role,
        'PRODUCT_CREATED',
        'Category',
        `Created category "${name}"`,
        { entityId: newCat.id, newValue: newCat }
      );
    }
  } catch (error) {
    console.warn('Firestore createCategory notice, saving to local cache:', error);
  }

  const cats = getLocalData<Category[]>(CATEGORIES_COLLECTION, INITIAL_CATEGORIES);
  const updated = [newCat, ...cats.filter((c) => c.id !== newCat.id)];
  setLocalData(CATEGORIES_COLLECTION, updated);

  return newCat;
};

// Product Services
export const getProducts = async (
  categoryIdOrOnlyActive?: string | boolean,
  onlyActiveFlag = false
): Promise<Product[]> => {
  const categoryId = typeof categoryIdOrOnlyActive === 'string' ? categoryIdOrOnlyActive : undefined;
  const onlyActive = typeof categoryIdOrOnlyActive === 'boolean' ? categoryIdOrOnlyActive : onlyActiveFlag;

  try {
    const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
    if (!snapshot.empty) {
      let prods = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
      prods.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      if (categoryId) {
        prods = prods.filter((p) => p.categoryId === categoryId);
      }
      if (onlyActive) {
        prods = prods.filter((p) => p.status === 'ACTIVE');
      }

      setLocalData(PRODUCTS_COLLECTION, prods);
      return prods;
    }
  } catch (error) {
    console.warn('Firestore getProducts error, using local cache:', error);
  }

  const prods = getLocalData<Product[]>(PRODUCTS_COLLECTION, []);
  let filtered = prods;
  if (categoryId) filtered = filtered.filter((p) => p.categoryId === categoryId);
  if (onlyActive) filtered = filtered.filter((p) => p.status === 'ACTIVE');
  return filtered;
};

export const subscribeToProducts = (
  callback: (products: Product[]) => void,
  onlyActive = false
): (() => void) => {
  try {
    return onSnapshot(
      collection(db, PRODUCTS_COLLECTION),
      (snapshot) => {
        let prods = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
        prods.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        if (onlyActive) {
          prods = prods.filter((p) => p.status === 'ACTIVE');
        }

        setLocalData(PRODUCTS_COLLECTION, prods);
        callback(prods);
      },
      (error) => {
        console.error('Firestore subscribeToProducts error:', error);
        const cached = getLocalData<Product[]>(PRODUCTS_COLLECTION, []);
        callback(onlyActive ? cached.filter((p) => p.status === 'ACTIVE') : cached);
      }
    );
  } catch (err) {
    console.error('Firestore subscribeToProducts init error:', err);
    const cached = getLocalData<Product[]>(PRODUCTS_COLLECTION, []);
    callback(onlyActive ? cached.filter((p) => p.status === 'ACTIVE') : cached);
    return () => {};
  }
};

export const getProductById = async (productId: string): Promise<Product | null> => {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, productId);
    const snap = await getDoc(docRef);
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Product;
  } catch (error) {
    console.warn(`Firestore getProductById notice (${productId}), using local cache:`, error);
  }

  const prods = getLocalData<Product[]>(PRODUCTS_COLLECTION, INITIAL_PRODUCTS);
  return prods.find((p) => p.id === productId) || null;
};

export const createProduct = async (
  productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  adminUser: UserProfile
): Promise<Product> => {
  const now = new Date().toISOString();
  const newProduct: Product = {
    id: `prod_${Date.now()}`,
    ...productData,
    createdAt: now,
    updatedAt: now
  };

  let cloudError: any = null;
  try {
    const ref = doc(collection(db, PRODUCTS_COLLECTION));
    newProduct.id = ref.id;
    await setDoc(ref, stripUndefined(newProduct));

    await logAudit(
      adminUser.id,
      adminUser.fullName,
      adminUser.role,
      'PRODUCT_CREATED',
      'Product',
      `Created product "${newProduct.name}" (SKU: ${newProduct.sku})`,
      { entityId: newProduct.id, newValue: newProduct }
    );
  } catch (error: any) {
    console.error('Firestore createProduct FAILED (cloud not updated):', error);
    cloudError = error;
  }

  const prods = getLocalData<Product[]>(PRODUCTS_COLLECTION, INITIAL_PRODUCTS);
  const updated = [newProduct, ...prods.filter((p) => p.id !== newProduct.id)];
  setLocalData(PRODUCTS_COLLECTION, updated);

  // A product saved only to this browser never reaches the store's POS catalog.
  if (cloudError) {
    throw new Error(
      `Could not save the product to the cloud (${cloudError.code || 'error'}: ${cloudError.message || cloudError}).`
    );
  }

  return newProduct;
};

export const updateProduct = async (
  productId: string,
  updates: Partial<Product>,
  adminUser: UserProfile
): Promise<void> => {
  let cloudError: any = null;
  try {
    const ref = doc(db, PRODUCTS_COLLECTION, productId);
    const oldSnap = await getDoc(ref);
    const oldData = oldSnap.exists() ? oldSnap.data() : null;

    const dataToUpdate = stripUndefined({
      ...updates,
      updatedAt: new Date().toISOString()
    });

    await setDoc(ref, dataToUpdate, { merge: true });

    await logAudit(
      adminUser.id,
      adminUser.fullName,
      adminUser.role,
      'PRODUCT_UPDATED',
      'Product',
      `Updated product "${updates.name || oldData?.name || productId}"`,
      { entityId: productId, oldValue: oldData, newValue: updates }
    );
  } catch (error: any) {
    console.error(`Firestore updateProduct FAILED (${productId}):`, error);
    cloudError = error;
  }

  const prods = getLocalData<Product[]>(PRODUCTS_COLLECTION, INITIAL_PRODUCTS);
  const updated = prods.map((p) =>
    p.id === productId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
  );
  setLocalData(PRODUCTS_COLLECTION, updated);

  if (cloudError) {
    throw new Error(
      `Could not save the product changes to the cloud (${cloudError.code || 'error'}: ${cloudError.message || cloudError}).`
    );
  }
};

export const toggleProductStatus = async (
  productId: string,
  status: ProductStatus,
  adminUser: UserProfile
): Promise<void> => {
  await updateProduct(productId, { status }, adminUser);
};

export const deleteProduct = async (
  productId: string,
  adminUser: UserProfile
): Promise<void> => {
  let cloudError: any = null;
  try {
    const ref = doc(db, PRODUCTS_COLLECTION, productId);
    const oldSnap = await getDoc(ref);
    const oldData = oldSnap.exists() ? oldSnap.data() : null;

    await deleteDoc(ref);

    await logAudit(
      adminUser.id,
      adminUser.fullName,
      adminUser.role,
      'PRODUCT_DELETED',
      'Product',
      `Permanently deleted product "${oldData?.name || productId}"`,
      { entityId: productId, oldValue: oldData }
    );
  } catch (error: any) {
    console.error(`Firestore deleteProduct FAILED (${productId}):`, error);
    cloudError = error;
  }

  const prods = getLocalData<Product[]>(PRODUCTS_COLLECTION, INITIAL_PRODUCTS);
  const updated = prods.filter((p) => p.id !== productId);
  setLocalData(PRODUCTS_COLLECTION, updated);

  if (cloudError) {
    throw new Error(
      `Could not delete the product in the cloud (${cloudError.code || 'error'}: ${cloudError.message || cloudError}).`
    );
  }
};

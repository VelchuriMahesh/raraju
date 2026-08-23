import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Store } from '../types/store';
import { Product, Category } from '../types/product';
import { StoreInventory, StockMovement } from '../types/inventory';
import { BusinessSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from './settingsService';

export const isSystemInitialized = async (): Promise<boolean> => {
  try {
    const storesSnap = await getDocs(collection(db, 'stores'));
    return !storesSnap.empty;
  } catch (error) {
    return false;
  }
};

export const seedInitialData = async (adminId: string): Promise<void> => {
  const now = new Date().toISOString();

  // 1. Settings
  const settingsRef = doc(db, 'settings', 'general');
  await setDoc(settingsRef, {
    ...DEFAULT_SETTINGS,
    updatedAt: now
  });

  // 2. Stores
  const store1Ref = doc(db, 'stores', 'store_1_main');
  const store1: Store = {
    id: 'store_1_main',
    name: 'Main Branch',
    code: 'S1',
    address: 'Shop 101, Main Road, Vijayawada, AP',
    phone: '+91 9876543211',
    email: 'main@raraju.com',
    gstin: '37AAAAA0000A1Z5',
    invoicePrefix: 'S1-',
    printerType: 'THERMAL_80MM',
    receiptHeader: 'RARAJU ENTERPRISES - MAIN BRANCH',
    receiptFooter: 'Thank you for your visit!',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };
  await setDoc(store1Ref, store1);

  const store2Ref = doc(db, 'stores', 'store_2_market');
  const store2: Store = {
    id: 'store_2_market',
    name: 'Market Road Branch',
    code: 'S2',
    address: 'Shop 42, Commercial Street, Guntur, AP',
    phone: '+91 9876543212',
    email: 'market@raraju.com',
    gstin: '37AAAAA0000A1Z5',
    invoicePrefix: 'S2-',
    printerType: 'THERMAL_80MM',
    receiptHeader: 'RARAJU ENTERPRISES - MARKET ROAD',
    receiptFooter: 'Thank you for your visit!',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };
  await setDoc(store2Ref, store2);

  // 3. Category
  const catRef = doc(db, 'categories', 'cat_grains');
  const category: Category = {
    id: 'cat_grains',
    name: 'Grains & Staple Food',
    description: 'Rice, wheat, grains, and staple grocery items',
    createdAt: now,
    updatedAt: now
  };
  await setDoc(catRef, category);

  const catRef2 = doc(db, 'categories', 'cat_oils');
  const category2: Category = {
    id: 'cat_oils',
    name: 'Oils & Ghee',
    description: 'Edible oils, mustard oil, sunflower oil and pure ghee',
    createdAt: now,
    updatedAt: now
  };
  await setDoc(catRef2, category2);

  // 4. Products
  const prod1Ref = doc(db, 'products', 'prod_rice_25kg');
  const prod1: Product = {
    id: 'prod_rice_25kg',
    name: 'Rice Bag 25kg (Premium Sona Masoori)',
    sku: 'RICE-25KG-01',
    barcode: '8901234567890',
    categoryId: 'cat_grains',
    categoryName: 'Grains & Staple Food',
    brand: 'Raraju Select',
    description: 'Aged premium sona masoori rice, 25kg pack',
    unit: 'Bag',
    purchasePrice: 1300,
    standardPrice: 1500,
    gstRate: 0,
    hsnCode: '1006',
    minStockAlert: 10,
    maxStockAlert: 200,
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&auto=format&fit=crop&q=80',
    customerRatePolicy: {
      enabled: true,
      minAllowedPrice: 1450,
      maxAllowedPrice: 1650,
      maxIncrease: 150,
      allowDecrease: false,
      requireReason: false
    },
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };
  await setDoc(prod1Ref, prod1);

  const prod2Ref = doc(db, 'products', 'prod_sunflower_oil_5l');
  const prod2: Product = {
    id: 'prod_sunflower_oil_5l',
    name: 'Sunflower Oil 5L Can',
    sku: 'OIL-SUN-5L',
    barcode: '8901234567891',
    categoryId: 'cat_oils',
    categoryName: 'Oils & Ghee',
    brand: 'Freedom',
    description: 'Refined sunflower cooking oil 5 litre can',
    unit: 'Bottle',
    purchasePrice: 620,
    standardPrice: 720,
    gstRate: 5,
    hsnCode: '1512',
    minStockAlert: 8,
    maxStockAlert: 100,
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=200&auto=format&fit=crop&q=80',
    customerRatePolicy: {
      enabled: true,
      minAllowedPrice: 700,
      maxAllowedPrice: 800,
      maxIncrease: 80,
      allowDecrease: false,
      requireReason: false
    },
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };
  await setDoc(prod2Ref, prod2);

  // 5. Store Inventory & Stock Movements
  // Store 1: Rice Bag = 100 bags, Oil = 30 cans
  const inv1DocId = `store_1_main_prod_rice_25kg`;
  const inv1Ref = doc(db, 'inventory', inv1DocId);
  const inv1: StoreInventory = {
    id: inv1DocId,
    storeId: 'store_1_main',
    productId: 'prod_rice_25kg',
    productName: 'Rice Bag 25kg (Premium Sona Masoori)',
    sku: 'RICE-25KG-01',
    quantity: 100,
    lastPurchasePrice: 1300,
    updatedAt: now
  };
  await setDoc(inv1Ref, inv1);

  const mov1Ref = doc(collection(db, 'stockMovements'));
  const mov1: StockMovement = {
    id: mov1Ref.id,
    storeId: 'store_1_main',
    storeName: 'Main Branch',
    productId: 'prod_rice_25kg',
    productName: 'Rice Bag 25kg (Premium Sona Masoori)',
    sku: 'RICE-25KG-01',
    type: 'OPENING_STOCK',
    quantity: 100,
    previousQuantity: 0,
    newQuantity: 100,
    reason: 'Initial Opening Stock',
    userId: adminId,
    userName: 'Super Administrator',
    userRole: 'SUPER_ADMIN',
    timestamp: now
  };
  await setDoc(mov1Ref, mov1);

  // Store 2: Rice Bag = 50 bags, Oil = 20 cans
  const inv2DocId = `store_2_market_prod_rice_25kg`;
  const inv2Ref = doc(db, 'inventory', inv2DocId);
  const inv2: StoreInventory = {
    id: inv2DocId,
    storeId: 'store_2_market',
    productId: 'prod_rice_25kg',
    productName: 'Rice Bag 25kg (Premium Sona Masoori)',
    sku: 'RICE-25KG-01',
    quantity: 50,
    lastPurchasePrice: 1300,
    updatedAt: now
  };
  await setDoc(inv2Ref, inv2);

  const mov2Ref = doc(collection(db, 'stockMovements'));
  const mov2: StockMovement = {
    id: mov2Ref.id,
    storeId: 'store_2_market',
    storeName: 'Market Road Branch',
    productId: 'prod_rice_25kg',
    productName: 'Rice Bag 25kg (Premium Sona Masoori)',
    sku: 'RICE-25KG-01',
    type: 'OPENING_STOCK',
    quantity: 50,
    previousQuantity: 0,
    newQuantity: 50,
    reason: 'Initial Opening Stock',
    userId: adminId,
    userName: 'Super Administrator',
    userRole: 'SUPER_ADMIN',
    timestamp: now
  };
  await setDoc(mov2Ref, mov2);

  // Oil inventory
  const invOil1DocId = `store_1_main_prod_sunflower_oil_5l`;
  await setDoc(doc(db, 'inventory', invOil1DocId), {
    id: invOil1DocId,
    storeId: 'store_1_main',
    productId: 'prod_sunflower_oil_5l',
    productName: 'Sunflower Oil 5L Can',
    sku: 'OIL-SUN-5L',
    quantity: 30,
    lastPurchasePrice: 620,
    updatedAt: now
  });

  const invOil2DocId = `store_2_market_prod_sunflower_oil_5l`;
  await setDoc(doc(db, 'inventory', invOil2DocId), {
    id: invOil2DocId,
    storeId: 'store_2_market',
    productId: 'prod_sunflower_oil_5l',
    productName: 'Sunflower Oil 5L Can',
    sku: 'OIL-SUN-5L',
    quantity: 20,
    lastPurchasePrice: 620,
    updatedAt: now
  });
};

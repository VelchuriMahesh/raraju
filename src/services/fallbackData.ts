import { Store } from '../types/store';
import { Product, Category } from '../types/product';
import { StoreInventory, StockMovement } from '../types/inventory';
import { Sale } from '../types/sale';
import { Expense } from '../types/expense';
import { UserProfile } from '../types/auth';

const now = new Date().toISOString();

// No hardcoded demo stores - only stores created dynamically by Admin
export const INITIAL_STORES: Store[] = [];

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat_grains',
    name: 'Grains & Rice (బియ్యం & ధాన్యాలు)',
    description: 'Rice, wheat, grains, and staple grocery items',
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'cat_oils',
    name: 'Oils & Ghee (నూనెలు & నెయ్యి)',
    description: 'Edible cooking oils, sunflower oil and pure ghee',
    createdAt: now,
    updatedAt: now
  }
];

// Real products only - no dummy products
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_INVENTORIES: StoreInventory[] = [];

// Real-time system: No fake demo sales
export const INITIAL_SALES: Sale[] = [];

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'user_super_admin',
    email: 'raraju@gmail.com',
    fullName: 'RARAJU Super Admin',
    role: 'SUPER_ADMIN',
    employeeId: 'EMP-ADM-01',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  }
];

export const INITIAL_EXPENSES: Expense[] = [];

export const INITIAL_MOVEMENTS: StockMovement[] = [];

export const getLocalData = <T>(key: string, defaultData: T): T => {
  try {
    const raw = localStorage.getItem(`raraju_cache_${key}`);
    if (!raw) return defaultData;
    return JSON.parse(raw);
  } catch (e) {
    return defaultData;
  }
};

export const setLocalData = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(`raraju_cache_${key}`, JSON.stringify(data));
  } catch (e) {}
};

export type UserRole = 'SUPER_ADMIN' | 'STORE_STAFF';

export type UserStatus = 'ACTIVE' | 'DISABLED' | 'INACTIVE';

export interface UserProfile {
  id: string; // Firebase Auth UID
  email: string;
  fullName: string;
  role: UserRole;
  storeId?: string; // Assigned store ID (for STORE_STAFF)
  storeName?: string; // Cached store name for display
  phone?: string;
  employeeId?: string;
  status: UserStatus;
  profileImageUrl?: string;
  createdAt: string; // ISO 8601 string
  updatedAt: string;
}

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: any | null;
  loading: boolean;
  error: string | null;
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types/auth';
import { auth } from '../services/firebase';
import { getUserById } from '../services/userService';
import { logoutUser, subscribeToAuthChanges } from '../services/authService';

interface AuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isStoreStaff: boolean;
  assignedStoreId: string | null;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  setCurrentUserDirect: (user: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    if (auth.currentUser) {
      try {
        const profile = await getUserById(auth.currentUser.uid);
        if (profile) setCurrentUser(profile);
      } catch (e) {
        console.error('Error refreshing profile:', e);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((profile: UserProfile | null) => {
      setCurrentUser(profile);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await logoutUser(currentUser);
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setCurrentUser(null);
    }
  };

  const setCurrentUserDirect = (user: UserProfile | null) => {
    setCurrentUser(user);
    setLoading(false);
  };

  const isAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isStoreStaff = currentUser?.role === 'STORE_STAFF';
  const assignedStoreId = currentUser?.storeId || null;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isAdmin,
        isStoreStaff,
        assignedStoreId,
        refreshProfile,
        logout,
        setCurrentUserDirect
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/auth/Login';
import { AdminLayout } from './components/layout/AdminLayout';
import { StoreLayout } from './components/layout/StoreLayout';

// Admin Pages
import { Dashboard } from './pages/admin/Dashboard';
import { Stores } from './pages/admin/Stores';
import { Products } from './pages/admin/Products';
import { StockAssignment } from './pages/admin/StockAssignment';
import { Inventory } from './pages/admin/Inventory';
import { Sales } from './pages/admin/Sales';
import { DailyHistory } from './pages/admin/DailyHistory';
import { Reports } from './pages/admin/Reports';
import { Settings } from './pages/admin/Settings';
import { Users } from './pages/admin/Users';
import { Categories } from './pages/admin/Categories';
import { Reconciliation } from './pages/admin/Reconciliation';
import { Purchases } from './pages/admin/Purchases';
import { Transfers } from './pages/admin/Transfers';
import { Customers } from './pages/admin/Customers';
import { Expenses } from './pages/admin/Expenses';
import { DailyClosing } from './pages/admin/DailyClosing';
import { AuditLogs } from './pages/admin/AuditLogs';

// Store Staff Pages
import { POS } from './pages/store/POS';
import { StoreSalesHistory } from './pages/store/StoreSalesHistory';
import { StoreDailyClosing } from './pages/store/StoreDailyClosing';

import { Loader2 } from 'lucide-react';

/**
 * Handles automatic migration from old hash URLs (#stores, #/admin/stores) to clean URLs (/admin/stores)
 */
const HashRedirectHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (window.location.hash) {
      let rawHash = window.location.hash.replace(/^#\/?/, '');
      if (rawHash) {
        if (!rawHash.startsWith('admin/') && !rawHash.startsWith('store/') && rawHash !== 'login') {
          if (rawHash === 'pos') {
            rawHash = 'store/pos';
          } else if (rawHash === 'store-history') {
            rawHash = 'store/history';
          } else {
            rawHash = `admin/${rawHash}`;
          }
        }
        navigate(`/${rawHash}`, { replace: true });
      }
    }
  }, [navigate]);

  return null;
};

export const AppContent: React.FC = () => {
  const { currentUser, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-sm font-bold text-slate-700">
          Loading RARAJU Management System...
        </p>
      </div>
    );
  }

  // Not logged in
  if (!currentUser) {
    return (
      <>
        <HashRedirectHandler />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    );
  }

  return (
    <>
      <HashRedirectHandler />
      <Routes>
        {/* ========================================================================= */}
        {/* STORE CASHIER ROUTES (Accessible to Store Staff and Super Admin) */}
        {/* ========================================================================= */}
        <Route
          path="/store/pos"
          element={
            <StoreLayout>
              <POS />
            </StoreLayout>
          }
        />
        <Route
          path="/store/history"
          element={
            <StoreLayout>
              <StoreSalesHistory />
            </StoreLayout>
          }
        />
        <Route
          path="/store/closing"
          element={
            <StoreLayout>
              <StoreDailyClosing />
            </StoreLayout>
          }
        />
        <Route path="/store" element={<Navigate to="/store/pos" replace />} />
        <Route path="/pos" element={<Navigate to="/store/pos" replace />} />
        <Route path="/billing" element={<Navigate to="/store/pos" replace />} />

        {/* ========================================================================= */}
        {/* SUPER ADMIN ROUTES */}
        {/* ========================================================================= */}
        {isAdmin ? (
          <>
            <Route
              path="/admin/dashboard"
              element={
                <AdminLayout>
                  <Dashboard />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/stores"
              element={
                <AdminLayout>
                  <Stores />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/products"
              element={
                <AdminLayout>
                  <Products />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/stock-assignment"
              element={
                <AdminLayout>
                  <StockAssignment />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/inventory"
              element={
                <AdminLayout>
                  <Inventory />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminLayout>
                  <Users />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <AdminLayout>
                  <Categories />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/reconciliation"
              element={
                <AdminLayout>
                  <Reconciliation />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/purchases"
              element={
                <AdminLayout>
                  <Purchases />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/transfers"
              element={
                <AdminLayout>
                  <Transfers />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/customers"
              element={
                <AdminLayout>
                  <Customers />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/expenses"
              element={
                <AdminLayout>
                  <Expenses />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/closings"
              element={
                <AdminLayout>
                  <DailyClosing />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <AdminLayout>
                  <AuditLogs />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/sales"
              element={
                <AdminLayout>
                  <Sales />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/daily-history"
              element={
                <AdminLayout>
                  <DailyHistory />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <AdminLayout>
                  <Reports />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminLayout>
                  <Settings />
                </AdminLayout>
              }
            />

            {/* Admin Convenience Shortcuts */}
            <Route path="/" element={<Navigate to="/admin/stock-assignment" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/stock-assignment" replace />} />
            <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/stores" element={<Navigate to="/admin/stores" replace />} />
            <Route path="/products" element={<Navigate to="/admin/products" replace />} />
            <Route path="/stock-assignment" element={<Navigate to="/admin/stock-assignment" replace />} />
            <Route path="/stock" element={<Navigate to="/admin/stock-assignment" replace />} />
            <Route path="/inventory" element={<Navigate to="/admin/inventory" replace />} />
            <Route path="/users" element={<Navigate to="/admin/users" replace />} />
            <Route path="/staff" element={<Navigate to="/admin/users" replace />} />
            <Route path="/categories" element={<Navigate to="/admin/categories" replace />} />
            <Route path="/reconciliation" element={<Navigate to="/admin/reconciliation" replace />} />
            <Route path="/purchases" element={<Navigate to="/admin/purchases" replace />} />
            <Route path="/transfers" element={<Navigate to="/admin/transfers" replace />} />
            <Route path="/customers" element={<Navigate to="/admin/customers" replace />} />
            <Route path="/expenses" element={<Navigate to="/admin/expenses" replace />} />
            <Route path="/closings" element={<Navigate to="/admin/closings" replace />} />
            <Route path="/audit" element={<Navigate to="/admin/audit" replace />} />
            <Route path="/sales" element={<Navigate to="/admin/sales" replace />} />
            <Route path="/invoices" element={<Navigate to="/admin/sales" replace />} />
            <Route path="/daily-history" element={<Navigate to="/admin/daily-history" replace />} />
            <Route path="/history" element={<Navigate to="/admin/daily-history" replace />} />
            <Route path="/reports" element={<Navigate to="/admin/reports" replace />} />
            <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />

            {/* Fallback for Admin */}
            <Route path="*" element={<Navigate to="/admin/stock-assignment" replace />} />
          </>
        ) : (
          /* Store Staff fallbacks */
          <>
            <Route path="/" element={<Navigate to="/store/pos" replace />} />
            <Route path="/admin/*" element={<Navigate to="/store/pos" replace />} />
            <Route path="*" element={<Navigate to="/store/pos" replace />} />
          </>
        )}
      </Routes>
    </>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;

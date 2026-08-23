import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShoppingBag,
  History,
  ClipboardList,
  LogOut,
  Store,
  Clock,
  Languages
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { NotificationBell } from '../common/NotificationBell';

interface StoreLayoutProps {
  children: React.ReactNode;
}

export const StoreLayout: React.FC<StoreLayoutProps> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLanguageToggle = () => {
    if (language === 'dual') setLanguage('te');
    else if (language === 'te') setLanguage('en');
    else setLanguage('dual');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* POS Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left: Brand & Store Branch */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20 font-black text-white text-lg flex-shrink-0">
                R
              </div>
              <div>
                <h1 className="font-black text-sm text-slate-900 tracking-wide">
                  {language === 'te' ? 'రారాజు పీఓఎస్' : language === 'dual' ? 'RARAJU POS / రారాజు' : 'RARAJU POS'}
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-extrabold">
                  <Store className="w-3.5 h-3.5" />
                  <span>{currentUser?.storeName || 'Assigned Branch'}</span>
                </div>
              </div>
            </div>

            {/* Mobile Notification & Language Switcher */}
            <div className="flex items-center gap-2 md:hidden">
              <NotificationBell role="STORE_STAFF" storeId={currentUser?.storeId} />
              <button
                onClick={handleLanguageToggle}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{language === 'dual' ? 'EN / తె' : language === 'te' ? 'తెలుగు' : 'English'}</span>
              </button>
            </div>
          </div>

          {/* Center: Navigation Tabs with dedicated URLs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full md:w-auto justify-center">
            <NavLink
              to="/store/pos"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`
              }
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{t('newBill')}</span>
            </NavLink>

            <NavLink
              to="/store/history"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`
              }
            >
              <History className="w-4 h-4" />
              <span>{t('storeSales')}</span>
            </NavLink>

            <NavLink
              to="/store/closing"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`
              }
            >
              <ClipboardList className="w-4 h-4" />
              <span>{t('dailyClosing')}</span>
            </NavLink>
          </div>

          {/* Right: Notification, Language, Clock, Info & Sign Out */}
          <div className="hidden md:flex items-center gap-3">
            <NotificationBell role="STORE_STAFF" storeId={currentUser?.storeId} />

            <button
              onClick={handleLanguageToggle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{language === 'dual' ? 'English / తెలుగు' : language === 'te' ? 'తెలుగు' : 'English'}</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                {currentUser?.fullName?.charAt(0) || 'S'}
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-900 text-xs truncate max-w-[110px]">{currentUser?.fullName}</p>
                <p className="text-[10px] text-slate-400 font-mono">{currentUser?.employeeId || 'STAFF'}</p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title={t('signOut')}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 bg-slate-50 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto h-full">{children}</div>
      </main>
    </div>
  );
};

import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  Package,
  Boxes,
  Receipt,
  FileText,
  Settings,
  LogOut,
  Menu,
  Languages,
  CalendarDays,
  CalendarPlus,
  X,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { NotificationBell } from '../common/NotificationBell';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const location = useLocation();

  // Primary navigation for desktop and drawer
  const allNavItems = [
    { id: 'stock-assignment', path: '/admin/stock-assignment', labelKey: 'stockAssignment', icon: CalendarPlus },
    { id: 'sales', path: '/admin/sales', labelKey: 'sales', icon: Receipt },
    { id: 'products', path: '/admin/products', labelKey: 'products', icon: Package },
    { id: 'daily-history', path: '/admin/daily-history', labelKey: 'dailyHistory', icon: CalendarDays },
    { id: 'dashboard', path: '/admin/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
    { id: 'stores', path: '/admin/stores', labelKey: 'stores', icon: Store },
    { id: 'reports', path: '/admin/reports', labelKey: 'reports', icon: FileText },
    { id: 'settings', path: '/admin/settings', labelKey: 'settings', icon: Settings }
  ];

  // Requested 4 items on mobile bottom bar + More menu
  const mobilePrimaryItems = [
    { id: 'stock-assignment', path: '/admin/stock-assignment', label: 'Stock Assign', teLabel: 'స్టాక్ కేటాయింపు', icon: CalendarPlus },
    { id: 'sales', path: '/admin/sales', label: 'Sales', teLabel: 'అమ్మకాలు', icon: Receipt },
    { id: 'products', path: '/admin/products', label: 'Products', teLabel: 'ఉత్పత్తులు', icon: Package },
    { id: 'daily-history', path: '/admin/daily-history', label: 'Daily History', teLabel: 'చరిత్ర', icon: CalendarDays }
  ];

  const isMoreActive = ['/admin/dashboard', '/admin/stores', '/admin/reports', '/admin/settings'].some((p) =>
    location.pathname.startsWith(p)
  );

  const handleLanguageToggle = () => {
    if (language === 'dual') setLanguage('te');
    else if (language === 'te') setLanguage('en');
    else setLanguage('dual');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row selection:bg-indigo-500 selection:text-white">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-indigo-600/20">
              R
            </div>
            <span className="font-black text-sm text-slate-900 tracking-tight">RARAJU ADMIN</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <NotificationBell role="SUPER_ADMIN" />

          {/* Language Toggle Button */}
          <button
            onClick={handleLanguageToggle}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{language === 'dual' ? 'EN / తె' : language === 'te' ? 'తెలుగు' : 'English'}</span>
          </button>
        </div>
      </div>

      {/* Desktop Left Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-4 hidden md:flex flex-col justify-between h-screen sticky top-0 z-30 shadow-xs">
        <div className="space-y-4">
          {/* Branding */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-md shadow-indigo-600/20">
                R
              </div>
              <div>
                <h1 className="font-black text-sm text-slate-900 tracking-tight">RARAJU ENTERPRISES</h1>
                <p className="text-[10px] text-indigo-600 font-bold">
                  {language === 'te' ? 'ప్రధాన కార్యాలయ నియంత్రణ' : 'Headquarters Control'}
                </p>
              </div>
            </div>

            {/* Notification Bell */}
            <NotificationBell role="SUPER_ADMIN" />
          </div>

          {/* Language Switcher Pill */}
          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 font-bold text-[11px]">
              <Languages className="w-3.5 h-3.5 text-indigo-600" />
              <span>భాష / Language:</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-colors ${
                  language === 'en' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('te')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-colors ${
                  language === 'te' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                తెలుగు
              </button>
              <button
                onClick={() => setLanguage('dual')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-colors ${
                  language === 'dual' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Dual
              </button>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 custom-scrollbar">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-extrabold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{t(item.labelKey as any)}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs flex-shrink-0">
              {currentUser?.fullName?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-xs text-slate-900 truncate">
                {currentUser?.fullName || 'Administrator'}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">{currentUser?.email}</p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 pb-28 md:pb-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {/* ========================================================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-2xl flex items-center justify-around">
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl text-[10px] font-bold transition-all min-w-[62px] ${
                  isActive
                    ? 'text-indigo-600 font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1.5 rounded-xl transition-all ${
                      isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-110' : 'text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="mt-0.5 truncate max-w-[64px] text-center leading-tight">
                    {language === 'te' ? item.teLabel : item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}

        {/* More Menu Option */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl text-[10px] font-bold transition-all min-w-[62px] ${
            isMoreActive || mobileDrawerOpen
              ? 'text-indigo-600 font-black'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              isMoreActive || mobileDrawerOpen
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-110'
                : 'text-slate-600 bg-slate-100'
            }`}
          >
            <Menu className="w-4 h-4" />
          </div>
          <span className="mt-0.5 truncate max-w-[64px] text-center leading-tight">
            {language === 'te' ? 'మరిన్ని' : 'More'}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE MORE MENU DRAWER / MODAL */}
      {/* ========================================================================= */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs animate-fade-in"
          />

          {/* Slide-out Drawer */}
          <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col justify-between p-5 z-50 animate-slide-in">
            <div className="space-y-4">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-indigo-600/20">
                    R
                  </div>
                  <div>
                    <h2 className="font-black text-sm text-slate-900">RARAJU ADMIN</h2>
                    <p className="text-[10px] text-indigo-600 font-bold">Admin Navigation</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Language Switcher */}
              <div className="bg-slate-50 p-2 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Languages className="w-3.5 h-3.5 text-indigo-600" />
                  <span>భాష / Lang:</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      language === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setLanguage('te')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      language === 'te' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                    }`}
                  >
                    తెలుగు
                  </button>
                  <button
                    onClick={() => setLanguage('dual')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      language === 'dual' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                    }`}
                  >
                    Dual
                  </button>
                </div>
              </div>

              {/* All Navigation Links in Drawer */}
              <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 custom-scrollbar">
                {allNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={({ isActive }) =>
                        `w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-extrabold'
                            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                        }`
                      }
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span>{t(item.labelKey as any)}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* User Profile & Sign Out */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs flex-shrink-0">
                  {currentUser?.fullName?.charAt(0) || 'A'}
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-xs text-slate-900 truncate">
                    {currentUser?.fullName || 'Administrator'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">{currentUser?.email}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setMobileDrawerOpen(false);
                  logout();
                }}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

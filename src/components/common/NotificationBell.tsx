import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  IndianRupee,
  Package,
  ClipboardList,
  Info,
  Banknote,
  QrCode,
  CreditCard,
  Layers
} from 'lucide-react';
import { AppNotification } from '../../types/notification';
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
  playNotificationSound
} from '../../services/notificationService';
import { useLanguage } from '../../context/LanguageContext';

interface NotificationBellProps {
  role: 'SUPER_ADMIN' | 'STORE_STAFF';
  storeId?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ role, storeId }) => {
  const { language } = useLanguage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(0);

  useEffect(() => {
    const unsub = subscribeToNotifications(role, storeId, (liveNotifs) => {
      const unreadCount = liveNotifs.filter((n) => !n.read).length;
      if (unreadCount > prevCountRef.current && prevCountRef.current !== 0) {
        playNotificationSound();
      }
      prevCountRef.current = unreadCount;
      setNotifications(liveNotifs);
    });

    return () => unsub();
  }, [role, storeId]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markNotificationAsRead(id);
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead(role, storeId);
  };

  const handleClearAll = () => {
    clearAllNotifications();
  };

  const getPaymentBadge = (method?: string) => {
    if (!method) return null;
    switch (method) {
      case 'CASH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px]">
            <Banknote className="w-3 h-3 text-emerald-600" />
            <span>CASH (నగదు)</span>
          </span>
        );
      case 'UPI':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-bold text-[10px]">
            <QrCode className="w-3 h-3 text-indigo-600" />
            <span>UPI (యూపీఐ)</span>
          </span>
        );
      case 'CARD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 font-bold text-[10px]">
            <CreditCard className="w-3 h-3 text-blue-600" />
            <span>CARD</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px]">
            {method}
          </span>
        );
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SALE_COMPLETED':
        return <IndianRupee className="w-4 h-4 text-emerald-600" />;
      case 'STOCK_UPDATE':
        return <Package className="w-4 h-4 text-indigo-600" />;
      case 'DAILY_CLOSING':
        return <ClipboardList className="w-4 h-4 text-amber-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button with Pulse Counter */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-all focus:outline-none"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center shadow-md animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 overflow-hidden animate-scale-up text-slate-800">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">
                  {language === 'te' ? 'నోటిఫికేషన్‌లు' : 'Notifications'}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {unreadCount} {language === 'te' ? 'చదవని సందేశాలు' : 'unread'}
                </p>
              </div>
            </div>

            {notifications.length > 0 && (
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-xs flex items-center gap-1 font-bold"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Bell className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-600">
                  {language === 'te' ? 'నోటిఫికేషన్‌లు ఏవీ లేవు' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {language === 'te'
                    ? 'అమ్మకాలు, చెల్లింపు విధానం మరియు మొత్తాలు ఇక్కడ ప్రత్యక్షంగా కనిపిస్తాయి'
                    : 'Real-time sales, payment method, and amount alerts will appear here'}
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && markNotificationAsRead(notif.id)}
                  className={`p-4 flex items-start gap-3 transition-colors cursor-pointer ${
                    !notif.read ? 'bg-indigo-50/40 hover:bg-indigo-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>

                  {/* Message Details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-extrabold text-xs text-slate-900 truncate">
                        {language === 'te' && notif.titleTe ? notif.titleTe : notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                        {new Date(notif.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-snug">
                      {language === 'te' && notif.messageTe ? notif.messageTe : notif.message}
                    </p>

                    {/* Amount & Payment Mode Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {notif.amount !== undefined && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-black text-xs">
                          ₹{notif.amount.toFixed(2)}
                        </span>
                      )}

                      {getPaymentBadge(notif.paymentMethod)}

                      {notif.invoiceNumber && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                          #{notif.invoiceNumber}
                        </span>
                      )}

                      {notif.storeName && (
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                          {notif.storeName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread Dot */}
                  {!notif.read && (
                    <button
                      onClick={(e) => handleMarkAsRead(notif.id, e)}
                      className="p-1 text-indigo-600 hover:text-indigo-800 rounded-lg flex-shrink-0"
                      title="Mark as read"
                    >
                      <span className="w-2 h-2 rounded-full bg-indigo-600 block"></span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

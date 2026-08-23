import React, { useState, useEffect } from 'react';
import {
  Store as StoreIcon,
  Plus,
  Edit2,
  Power,
  Search,
  Phone,
  MapPin,
  Loader2,
  X,
  Check,
  Key,
  Mail,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useLanguage } from '../../context/LanguageContext';
import { Store, StoreStatus, PrinterType } from '../../types/store';
import { getStores, createStore, updateStore, toggleStoreStatus, subscribeToStores } from '../../services/storeService';
import { createUserProfile } from '../../services/userService';

export const Stores: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const { t, language } = useLanguage();

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [invoicePrefix, setInvoicePrefix] = useState('S1-');
  const [printerType, setPrinterType] = useState<PrinterType>('THERMAL_80MM');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeToStores((liveStores) => {
      setStores(liveStores);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openCreateModal = () => {
    setEditingStore(null);
    const nextNum = stores.length + 1;
    setName('');
    setCode(`S${nextNum}`);
    setAddress('');
    setPhone('');
    setLoginEmail(`store${nextNum}@raraju.com`);
    setLoginPassword(`store${nextNum}pass`);
    setInvoicePrefix(`S${nextNum}-`);
    setPrinterType('THERMAL_80MM');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (store: Store) => {
    setEditingStore(store);
    setName(store.name);
    setCode(store.code);
    setAddress(store.address);
    setPhone(store.phone);
    setLoginEmail(store.loginEmail || store.email || '');
    setLoginPassword(store.loginPassword || '');
    setInvoicePrefix(store.invoicePrefix);
    setPrinterType(store.printerType);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!name.trim() || !code.trim() || !loginEmail.trim() || !loginPassword.trim()) {
      error('Please fill in Store Name, Code, Login Email, and Password.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingStore) {
        await updateStore(
          editingStore.id,
          {
            name: name.trim(),
            code: code.trim().toUpperCase(),
            address: address.trim(),
            phone: phone.trim(),
            loginEmail: loginEmail.trim().toLowerCase(),
            loginPassword: loginPassword.trim(),
            email: loginEmail.trim().toLowerCase(),
            invoicePrefix: invoicePrefix.trim().toUpperCase(),
            printerType
          },
          currentUser
        );
        success('Store updated successfully.');
      } else {
        const newStore = await createStore(
          {
            name: name.trim(),
            code: code.trim().toUpperCase(),
            address: address.trim(),
            phone: phone.trim(),
            loginEmail: loginEmail.trim().toLowerCase(),
            loginPassword: loginPassword.trim(),
            email: loginEmail.trim().toLowerCase(),
            invoicePrefix: invoicePrefix.trim().toUpperCase(),
            printerType,
            status: 'ACTIVE'
          },
          currentUser
        );

        // Also create a linked user profile for store login
        await createUserProfile(
          `user_${loginEmail.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`,
          {
            email: loginEmail.trim().toLowerCase(),
            fullName: `${name.trim()} Staff`,
            role: 'STORE_STAFF',
            storeId: newStore.id,
            storeName: newStore.name,
            phone: phone.trim(),
            employeeId: `EMP-${code.trim().toUpperCase()}-01`,
            status: 'ACTIVE'
          },
          currentUser
        );

        success(`Store "${name}" created with login access (${loginEmail}).`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      error('Failed to save store: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (store: Store) => {
    if (!currentUser) return;
    const newStatus: StoreStatus = store.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const confirmed = await confirm({
      title: `${newStatus === 'INACTIVE' ? 'Deactivate' : 'Activate'} Store Branch`,
      message: `Are you sure you want to ${newStatus.toLowerCase()} "${store.name}"? ${
        newStatus === 'INACTIVE' ? 'Staff will not be able to log in or bill for this store.' : ''
      }`,
      confirmText: newStatus === 'INACTIVE' ? 'Deactivate' : 'Activate',
      isDestructive: newStatus === 'INACTIVE'
    });

    if (confirmed) {
      try {
        await toggleStoreStatus(store.id, newStatus, currentUser);
        success(`Store is now ${newStatus.toLowerCase()}.`);
      } catch (err: any) {
        error('Failed to update store status: ' + err.message);
      }
    }
  };

  const filteredStores = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery)) ||
      (s.loginEmail && s.loginEmail.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <StoreIcon className="w-6 h-6 text-indigo-600" />
            <span>{language === 'te' ? 'స్టోర్ బ్రాంచ్‌ల నిర్వహణ' : 'Store Branches & Dynamic Logins'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'te'
              ? 'కొత్త స్టోర్లను సృష్టించండి మరియు స్టోర్ సిబ్బంది కోసం ఈమెయిల్, పాస్‌వర్డ్‌ను సెట్ చేయండి'
              : 'Create unlimited branch stores and dynamically set login email & password for store staff'}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'te' ? '+ కొత్త స్టోర్‌ను జోడించండి' : '+ Add New Store Branch'}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stores by name, code, phone, or email..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Total Stores: <strong>{stores.length}</strong>
        </span>
      </div>

      {/* Stores Grid */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs">Loading store branches...</span>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl p-6 bg-white">
          <StoreIcon className="w-12 h-12 mb-2 text-slate-300" />
          <p className="text-sm font-bold text-slate-700">No store branches found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStores.map((store) => (
            <div
              key={store.id}
              className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-4 relative flex flex-col justify-between"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm">
                    {store.code}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                      {store.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Prefix: <strong>{store.invoicePrefix}</strong>
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border ${
                    store.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {store.status}
                </span>
              </div>

              {/* Store Details */}
              <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                {store.address && (
                  <p className="flex items-center gap-2 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{store.address}</span>
                  </p>
                )}
                {store.phone && (
                  <p className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-mono">{store.phone}</span>
                  </p>
                )}
              </div>

              {/* Store Staff Login Credentials Box */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Key className="w-3 h-3 text-indigo-600" />
                    <span>Store Login Access</span>
                  </span>
                </div>
                <p className="font-mono font-bold text-slate-800 truncate text-[11px]">
                  Email: {store.loginEmail || store.email || '—'}
                </p>
                <p className="font-mono text-slate-600 text-[11px]">
                  Password: {store.loginPassword ? '••••••••' : 'Standard'}
                </p>
              </div>

              {/* Card Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(store)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => handleToggleStatus(store)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                    store.status === 'ACTIVE'
                      ? 'text-rose-600 hover:bg-rose-50'
                      : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{store.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">
                {editingStore ? 'Edit Store Branch' : 'Add New Store Branch & Login'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Store Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Guntur Branch"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Store Code & Prefix *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setInvoicePrefix(`${e.target.value}-`);
                    }}
                    placeholder="e.g. S2"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold uppercase focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Store Address / Location</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Shop 24, Main Bazaar, Guntur"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Invoice Number Prefix</label>
                  <input
                    type="text"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    placeholder="S2-"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white uppercase"
                  />
                </div>
              </div>

              {/* Dynamic Store Login Credentials */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-3">
                <p className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-indigo-600" />
                  <span>Store Staff Login Credentials (ఈ స్టోర్ లాగిన్ వివరాలు)</span>
                </p>
                
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Store Login Email *</label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. guntur@raraju.com"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700">Store Login Password *</label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
                      >
                        {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showPassword ? 'Hide' : 'Show'}</span>
                      </button>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : editingStore ? 'Update Store' : 'Create Store Branch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

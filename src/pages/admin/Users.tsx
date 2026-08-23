import React, { useState, useEffect } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Edit2,
  Power,
  Search,
  Store,
  Shield,
  Phone,
  Mail,
  Loader2,
  X,
  Check,
  Key
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { UserProfile, UserRole, UserStatus } from '../../types/auth';
import { Store as StoreType } from '../../types/store';
import { getUsers, toggleUserStatus, updateUserProfile } from '../../services/userService';
import { registerUser } from '../../services/authService';
import { getStores } from '../../services/storeService';

export const Users: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const { confirm } = useConfirm();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('STORE_STAFF');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, storesData] = await Promise.all([
        getUsers(),
        getStores()
      ]);
      setUsers(usersData);
      setStores(storesData);
      if (storesData.length > 0 && !selectedStoreId) {
        setSelectedStoreId(storesData[0].id);
      }
    } catch (err: any) {
      error('Failed to load staff users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedUserId('');
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('STORE_STAFF');
    setSelectedStoreId(stores[0]?.id || '');
    setPhone('');
    setEmployeeId(`EMP-${Date.now().toString().slice(-4)}`);
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserProfile) => {
    setIsEditing(true);
    setSelectedUserId(user.id);
    setFullName(user.fullName);
    setEmail(user.email);
    setPassword('');
    setRole(user.role);
    setSelectedStoreId(user.storeId || stores[0]?.id || '');
    setPhone(user.phone || '');
    setEmployeeId(user.employeeId || '');
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      const assignedStore = stores.find((s) => s.id === selectedStoreId);

      if (isEditing) {
        await updateUserProfile(
          selectedUserId,
          {
            fullName,
            role,
            storeId: role === 'STORE_STAFF' ? selectedStoreId : undefined,
            storeName: role === 'STORE_STAFF' ? assignedStore?.name : undefined,
            phone,
            employeeId
          },
          currentUser
        );
        success(`Staff profile for "${fullName}" updated.`);
      } else {
        if (!password || password.length < 6) {
          error('Password must be at least 6 characters.');
          return;
        }
        await registerUser(
          email,
          password,
          fullName,
          role,
          role === 'STORE_STAFF' ? selectedStoreId : undefined,
          role === 'STORE_STAFF' ? assignedStore?.name : undefined,
          currentUser
        );
        success(`Account for "${fullName}" created successfully.`);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      error('Failed to save staff user: ' + err.message);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    if (!currentUser) return;
    const newStatus: UserStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const confirmed = await confirm({
      title: `${newStatus === 'DISABLED' ? 'Disable' : 'Activate'} User?`,
      message: `Are you sure you want to ${newStatus === 'DISABLED' ? 'disable' : 'activate'} "${user.fullName}"? ${
        newStatus === 'DISABLED' ? 'They will immediately be blocked from logging into the POS.' : ''
      }`,
      isDestructive: newStatus === 'DISABLED'
    });

    if (confirmed) {
      try {
        await toggleUserStatus(user.id, newStatus, currentUser);
        success(`User status changed to ${newStatus.toLowerCase()}.`);
        loadData();
      } catch (err: any) {
        error('Failed to toggle status: ' + err.message);
      }
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(q));

    const matchStore = storeFilter === 'ALL' || u.storeId === storeFilter;

    return matchSearch && matchStore;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <UsersIcon className="w-6 h-6 text-brand-400" />
            <span>Staff & User Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create store staff credentials and enforce strict branch-level access control
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff by name, email..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-slate-400">
          Showing <strong>{filteredUsers.length}</strong> staff accounts
        </span>
      </div>

      {/* Users Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            <span className="text-xs">Loading staff profiles...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6">
            <UsersIcon className="w-12 h-12 mb-2 text-slate-700" />
            <p className="text-sm font-semibold text-slate-400">No staff members found</p>
            <p className="text-xs text-slate-600 mt-1">Add staff users to enable store billing operations</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Email / Login</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Assigned Store</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredUsers.map((user) => {
                  const isActive = user.status === 'ACTIVE';
                  const isAdmin = user.role === 'SUPER_ADMIN';

                  return (
                    <tr key={user.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 font-bold text-white flex items-center justify-center text-xs">
                            {user.fullName?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-100">{user.fullName}</p>
                            {user.employeeId && (
                              <p className="text-[10px] text-slate-500 font-mono">ID: {user.employeeId}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {user.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                            isAdmin
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : 'bg-brand-950 text-brand-300 border border-brand-800'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {isAdmin ? (
                          <span className="text-slate-500 italic">All Stores (Global)</span>
                        ) : (
                          <div className="flex items-center gap-1.5 font-medium text-slate-200">
                            <Store className="w-3.5 h-3.5 text-brand-400" />
                            <span>{user.storeName || 'Store ' + user.storeId}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!isAdmin && (
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isActive
                                  ? 'text-rose-400 hover:bg-rose-950/40'
                                  : 'text-emerald-400 hover:bg-emerald-950/40'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-extrabold text-lg text-white">
                {isEditing ? 'Edit Staff Profile' : 'Register New Staff Member'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ravi Kumar"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g. EMP-101"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-semibold text-slate-300 mb-1">Email / Username *</label>
                  <input
                    type="email"
                    required
                    disabled={isEditing}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ravi@store1.raraju.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {!isEditing && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">User Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="STORE_STAFF">Store Staff (Cashier/Billing)</option>
                    <option value="SUPER_ADMIN">Super Administrator</option>
                  </select>
                </div>

                {role === 'STORE_STAFF' && (
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Assigned Store Branch *</label>
                    <select
                      value={selectedStoreId}
                      onChange={(e) => setSelectedStoreId(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-600/30"
                >
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? 'Save Changes' : 'Create Staff User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

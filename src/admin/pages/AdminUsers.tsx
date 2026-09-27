import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { 
  Users, Search, Shield, Trash2, ChevronLeft, 
  ChevronRight, Filter, X, ShieldCheck, UserCheck, UserX,
  MailCheck, MailWarning, BadgeCheck
} from 'lucide-react';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  blocked: boolean;
  isVerified: boolean;
  hasPendingVerification: boolean;
  lastActiveAt: string;
  createdAt: string;
  workspacesCount: number;
  messagesCount: number;
}

export default function AdminUsers() {
  const { token, user: currentUser } = useStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [verifyFilter, setVerifyFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search, page, roleFilter, verifyFilter, token]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users?page=${page}&limit=8&search=${encodeURIComponent(search)}&role=${roleFilter}&verified=${verifyFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        const err = await response.json();
        showToast(err.error || 'Failed to list users.', 'error');
      }
    } catch {
      showToast('Connection failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const executeVerifyEmail = async (userId: string) => {
    if (!token) return;
    setVerifyingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Email marked as verified.');
        setUsers(users.map(u => u.id === userId
          ? { ...u, isVerified: true, hasPendingVerification: false }
          : u));
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to verify email.', 'error');
      }
    } catch {
      showToast('Request failed.', 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  const executeBlockToggle = async (userId: string, targetBlockedState: boolean) => {
    if (!token) return;
    if (userId === currentUser?.id) {
      showToast('Cannot modify your own account.', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ blocked: targetBlockedState })
      });
      if (res.ok) {
        showToast(targetBlockedState ? 'User suspended.' : 'User restored.');
        setUsers(users.map(u => u.id === userId ? { ...u, blocked: targetBlockedState } : u));
      } else {
        const err = await res.json();
        showToast(err.error || 'Request failed.', 'error');
      }
    } catch {
      showToast('Request failed.', 'error');
    }
  };

  const executeRoleChange = async (userId: string, newRole: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        showToast('Role updated.');
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update role.', 'error');
      }
    } catch {
      showToast('Request failed.', 'error');
    }
  };

  const executeHardErase = async (userId: string, username: string) => {
    if (!token) return;
    if (userId === currentUser?.id) {
      showToast('Cannot delete your own account.', 'error');
      return;
    }
    const confirmed = window.confirm(`Delete "${username}"? This action is permanent.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('User deleted.');
        setUsers(users.filter(u => u.id !== userId));
      } else {
        const err = await res.json();
        showToast(err.error || 'Delete failed.', 'error');
      }
    } catch {
      showToast('Delete failed.', 'error');
    }
  };

  return (
    <div className="space-y-6 select-text relative">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border text-[13px] font-semibold font-mono animate-slideIn ${
          toast.type === 'success' ? 'bg-panel text-leaf border-emerald-500/30' : 'bg-panel text-rust border-rose-500/30'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cream">Users</h1>
          <p className="text-[13px] text-faint font-mono mt-1">Manage platform collaborators</p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-panel/80 rounded-2xl border border-line/60">
        <div className="md:col-span-2 relative">
          <input
            type="text"
            placeholder="Search by email, name..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-ink/50 border border-line/60 rounded-xl py-2.5 pl-10 pr-8 text-[13px] text-cream placeholder-faint focus:outline-none focus:border-ember/50 focus:ring-2 focus:ring-ember/10 transition-all"
          />
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          {search && (
            <button 
              onClick={() => handleSearchChange('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sand hover:text-cream transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="w-full bg-ink/50 border border-line/60 rounded-xl py-2.5 pl-3 pr-8 text-[13px] text-cream focus:outline-none focus:border-ember/50 cursor-pointer appearance-none transition-all"
          >
            <option value="">All Roles</option>
            <option value="user">Collaborator</option>
            <option value="admin">Admin</option>
          </select>
          <Filter size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={verifyFilter}
            onChange={(e) => { setVerifyFilter(e.target.value); setPage(1); }}
            className="w-full bg-ink/50 border border-line/60 rounded-xl py-2.5 pl-3 pr-8 text-[13px] text-cream focus:outline-none focus:border-ember/50 cursor-pointer appearance-none transition-all"
          >
            <option value="">All Emails</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <BadgeCheck size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel/80 border border-line/60 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-ember/20 border-t-ember animate-spin mx-auto" />
            <p className="text-[13px] font-mono tracking-widest text-faint animate-pulse uppercase">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center text-faint italic text-[13px]">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line/60 bg-panel-2/40 text-[13px] text-sand font-mono uppercase tracking-wider">
                  <th className="py-4 px-5 font-bold">User</th>
                  <th className="py-4 px-5 font-bold">Role</th>
                  <th className="py-4 px-5 font-bold">Email</th>
                  <th className="py-4 px-5 font-bold">Prompts</th>
                  <th className="py-4 px-5 font-bold text-center">Actions</th>
                  <th className="py-4 px-5 font-bold text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {users.map((item) => (
                  <tr key={item.id} className="hover:bg-panel-2/30 transition-colors">
                    <td className="py-4 px-5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-ember/15 to-ember/5 text-ember font-bold border border-ember/15 flex items-center justify-center shrink-0 text-[14px]">
                        {item.name ? item.name[0].toUpperCase() : 'A'}
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-[13px] font-semibold text-cream block">{item.name}</span>
                        <span className="text-[13px] text-faint font-mono">{item.email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      {item.role === 'admin' ? (
                        <span className="px-2.5 py-1 rounded-lg font-bold font-mono text-[13px] bg-amber-500/10 text-warn border border-amber-500/20 uppercase flex items-center gap-1 w-max">
                          <ShieldCheck size={10} /> Admin
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg font-bold font-mono text-[13px] bg-emerald-500/10 text-leaf border border-emerald-500/20 uppercase flex items-center gap-1 w-max">
                          Collaborator
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-5">
                      {item.isVerified ? (
                        <span
                          className="px-2.5 py-1 rounded-lg font-bold font-mono text-[13px] bg-sky-500/10 text-cat-blue border border-sky-500/20 uppercase flex items-center gap-1 w-max"
                          title="This user confirmed their email address"
                        >
                          <MailCheck size={10} /> Verified
                        </span>
                      ) : (
                        <span
                          className="px-2.5 py-1 rounded-lg font-bold font-mono text-[13px] bg-amber-500/10 text-warn border border-amber-500/20 uppercase flex items-center gap-1 w-max"
                          title={item.hasPendingVerification
                            ? 'A verification link was issued but never used. This account cannot sign in yet.'
                            : 'No verification link has been issued for this account.'}
                        >
                          <MailWarning size={10} /> Unverified
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-5 font-mono text-[14px] text-cream">
                      {item.messagesCount || 0}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => executeBlockToggle(item.id, !item.blocked)}
                          disabled={item.id === currentUser?.id}
                          className={`px-3 py-1.5 rounded-xl font-medium text-[13px] border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            item.blocked
                              ? 'bg-rose-500/10 border-rose-500/20 text-rust hover:bg-rose-500/15'
                              : 'bg-panel-2/50 border-line/60 text-cream hover:border-line-2'
                          }`}
                        >
                          {item.blocked ? <UserCheck size={11} className="inline mr-1" /> : <UserX size={11} className="inline mr-1" />}
                          {item.blocked ? 'Restore' : 'Suspend'}
                        </button>
                        <button
                          onClick={() => executeRoleChange(item.id, item.role === 'admin' ? 'user' : 'admin')}
                          disabled={item.id === currentUser?.id}
                          className="px-3 py-1.5 rounded-xl font-medium text-[13px] bg-panel-2/50 border border-line/60 hover:border-line-2 text-cream transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {item.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        {!item.isVerified && (
                          <button
                            onClick={() => executeVerifyEmail(item.id)}
                            disabled={verifyingId === item.id}
                            className="px-3 py-1.5 rounded-xl font-medium text-[13px] bg-sky-500/10 border border-sky-500/20 text-cat-blue hover:bg-sky-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                            title="Bypass the pending link and let this account sign in"
                          >
                            <MailCheck size={11} className="inline mr-1" />
                            {verifyingId === item.id ? 'Verifying...' : 'Mark verified'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={() => executeHardErase(item.id, item.name)}
                        disabled={item.id === currentUser?.id}
                        className="p-2 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 hover:border-rose-500/20 text-rust rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Delete user"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="py-4 px-5 bg-panel-2/30 border-t border-line/60 flex items-center justify-between font-mono text-[14px] text-sand">
            <span>Page <span className="text-cream font-bold">{page}</span> of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-panel-2/50 border border-line/60 hover:border-line-2 text-cream disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-panel-2/50 border border-line/60 hover:border-line-2 text-cream disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

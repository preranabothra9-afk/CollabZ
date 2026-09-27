import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';

interface AuditLog {
  id: string;
  userId?: string;
  userName: string;
  userEmail: string;
  action: string;
  details: string;
  workspaceId?: string;
  ipAddress: string;
  createdAt: string;
}

export default function AdminAuditLogs() {
  const { token } = useStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAuditLogs = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/audit-logs?page=${page}&limit=12&action=${actionFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.auditLogs || []);
        setTotalPages(data.pagination?.pages || 1);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to load logs.');
      }
    } catch {
      setError('Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [page, actionFilter, token]);

  return (
    <div className="space-y-6 select-text relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cream">Audit Logs</h1>
          <p className="text-[13px] text-faint font-mono mt-1">Security event tracking</p>
        </div>
        <button
          onClick={() => { setPage(1); fetchAuditLogs(); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-panel/80 border border-line/60 hover:border-line-2 rounded-xl text-[13px] font-medium text-sand hover:text-cream transition-all cursor-pointer"
        >
          <RefreshCw size={13} />
          Reload
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-panel/80 rounded-2xl border border-line/60">
        <div className="md:col-span-2 relative">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="w-full bg-ink/50 border border-line/60 rounded-xl py-2.5 px-3 text-[13px] text-cream focus:outline-none focus:border-ember/50 cursor-pointer appearance-none transition-all"
          >
            <option value="">All Events</option>
            <option value="LOGIN_SUCCESS">Login Success</option>
            <option value="LOGIN_FAILED">Login Failed</option>
            <option value="REGISTER">Registration</option>
            <option value="BLOCK_USER">User Block</option>
            <option value="UNBLOCK_USER">User Unblock</option>
            <option value="ROLE_CHANGE">Role Change</option>
            <option value="WORKSPACE_DESTROY">Workspace Delete</option>
            <option value="USER_DELETED">User Delete</option>
          </select>
          <Filter size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        </div>
        <button
          onClick={() => { setPage(1); fetchAuditLogs(); }}
          className="bg-ember hover:bg-ember-2 border border-ember/30 text-on-ember rounded-xl text-[13px] font-semibold py-2.5 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Search size={13} />
          Search Logs
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/5 border border-rose-500/15 p-4 rounded-xl text-[13px] text-rust flex items-center gap-2">
          <ShieldAlert size={14} />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-panel/80 border border-line/60 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-ember/20 border-t-ember animate-spin mx-auto" />
            <p className="text-[13px] font-mono tracking-widest text-faint uppercase">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-[13px] text-faint text-center py-24 italic">No audit events found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line/60 bg-panel-2/40 text-[13px] text-sand font-mono uppercase tracking-wider">
                  <th className="py-4 px-5 font-bold">Action</th>
                  <th className="py-4 px-5 font-bold">User</th>
                  <th className="py-4 px-5 font-bold">Details</th>
                  <th className="py-4 px-5 font-bold">IP</th>
                  <th className="py-4 px-5 font-bold text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-panel-2/30 transition-colors">
                    <td className="py-4 px-5">
                      <span className={`px-2 py-1 rounded-lg font-mono text-[13px] font-bold border ${
                        log.action.includes('FAILED') || log.action.includes('BLOCK') || log.action.includes('DESTROY') || log.action.includes('DELETED')
                          ? 'bg-rose-500/10 text-rust border-rose-500/20'
                          : log.action.includes('ROLE_CHANGE')
                          ? 'bg-amber-500/10 text-warn border-amber-500/20'
                          : 'bg-emerald-500/10 text-leaf border-emerald-500/20'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span className="text-[13px] font-semibold text-cream block">{log.userName || 'System'}</span>
                      <span className="text-[13px] text-faint font-mono">{log.userEmail || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-5 text-cream/80 font-sans max-w-sm break-words">
                      {log.details}
                    </td>
                    <td className="py-4 px-5 font-mono text-sand text-[14px]">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="py-4 px-5 text-right text-faint font-mono text-[13px]">
                      {new Date(log.createdAt).toLocaleString()}
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

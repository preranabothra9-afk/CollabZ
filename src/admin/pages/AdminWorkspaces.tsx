import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Layers, Trash2, Calendar, Users, AlertCircle, RefreshCw, Folder } from 'lucide-react';

interface AdminWorkspace {
  id: string;
  name: string;
  description: string;
  owner: { name: string; email: string; avatar: string };
  membersCount: number;
  channelsCount: number;
  savedCount: number;
  createdAt: string;
}

export default function AdminWorkspaces() {
  const { token } = useStore();
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchWorkspaces = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/workspaces', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        setWorkspaces(list || []);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to list workspaces.');
      }
    } catch {
      setError('Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const executeWorkspacePurge = async (workspaceId: string, name: string) => {
    if (!token) return;
    const confirmed = window.confirm(`Delete "${name}"? All data will be permanently erased.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Workspace deleted.');
        setWorkspaces(workspaces.filter(ws => ws.id !== workspaceId));
      } else {
        const err = await res.json();
        showToast(err.error || 'Delete failed.', 'error');
      }
    } catch {
      showToast('Delete failed.', 'error');
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [token]);

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
          <h1 className="text-2xl font-bold tracking-tight text-cream">Workspaces</h1>
          <p className="text-[13px] text-faint font-mono mt-1">Manage collaboration environments</p>
        </div>
        <button
          onClick={fetchWorkspaces}
          className="flex items-center gap-2 px-4 py-2.5 bg-panel/80 border border-line/60 hover:border-line-2 rounded-xl text-[13px] font-medium text-sand hover:text-cream transition-all cursor-pointer"
        >
          <RefreshCw size={13} />
          Reload
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/5 border border-rose-500/15 p-4 rounded-xl text-[13px] text-rust flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center space-y-3 bg-panel/80 border border-line/60 rounded-2xl">
          <div className="w-8 h-8 rounded-full border-2 border-ember/20 border-t-ember animate-spin mx-auto" />
          <p className="text-[13px] font-mono tracking-widest text-faint animate-pulse uppercase">Loading workspaces...</p>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="py-20 text-center text-faint bg-panel/80 border border-line/60 rounded-2xl italic text-[13px]">
          No workspaces found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {workspaces.map((ws) => (
            <div key={ws.id} className="bg-panel/80 border border-line/60 p-5 rounded-2xl flex flex-col justify-between hover:border-line-2 transition-all group select-text ws-card-lift">
              <div className="space-y-3.5">
                <div className="flex justify-between items-start">
                  <div className="space-y-1 overflow-hidden flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-500/5 border border-violet-500/20 flex items-center justify-center text-cat-violet shrink-0">
                        <Folder size={14} />
                      </div>
                      <h3 className="font-bold text-cream text-sm tracking-tight truncate">{ws.name}</h3>
                    </div>
                    <p className="text-[14px] text-sand line-clamp-2 leading-relaxed pl-10">{ws.description || 'No description'}</p>
                  </div>
                  <button
                    onClick={() => executeWorkspacePurge(ws.id, ws.name)}
                    className="p-2 opacity-40 hover:opacity-100 bg-rose-500/5 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-rust rounded-xl cursor-pointer transition-all"
                    title="Delete workspace"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 bg-panel-2/40 rounded-xl border border-line/40">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-ember/15 to-ember/5 text-ember font-bold text-[13px] flex items-center justify-center border border-ember/15 shrink-0">
                    {ws.owner?.name ? ws.owner.name[0] : 'O'}
                  </div>
                  <div className="overflow-hidden leading-tight">
                    <span className="text-[13px] text-faint font-mono tracking-wider block uppercase">Owner</span>
                    <span className="text-[14px] font-semibold text-cream truncate block">{ws.owner?.name || 'Unknown'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-line/40 flex justify-between items-center text-[13px] font-mono text-faint">
                <div className="flex items-center gap-1.5 bg-violet-500/5 px-2 py-1 rounded-lg text-cat-violet border border-violet-500/15">
                  <Users size={11} />
                  <span>{ws.membersCount || 1} members</span>
                </div>
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {new Date(ws.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

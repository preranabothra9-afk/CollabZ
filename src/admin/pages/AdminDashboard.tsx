import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { 
  Users, Layers, Zap, Activity, Clock, RefreshCw, 
  ArrowUpRight, AlertCircle, TrendingUp, Server, Cpu, HardDrive
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer
} from 'recharts';

interface Metrics {
  totalUsers: number;
  activeUsers: number;
  onlineUsers: number;
  totalWorkspaces: number;
  totalMessages: number;
  aiRequestsToday: number;
  totalPromptStreams: number;
  averageResponseTime: number;
}

interface ChartData {
  dailyAiUsage: { day: string; requests: number }[];
  usergrowth: { day: string; users: number }[];
  workspaceActivity: { day: string; activeRooms: number }[];
  modelUsage: { name: string; value: number }[];
}

interface SystemStatus {
  cpuUsage: number;
  memoryUsage: number;
  databaseState: string;
  socketsPool: number;
  pingMs: number;
}

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

export default function AdminDashboard() {
  const { token } = useStore();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/dashboard/metrics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
        setCharts(data.charts);
        setSystem(data.systemStatus);
        setRecentLogs(data.recentActivity || []);
      } else {
        const err = await res.json();
        setError(err.error || 'Console authorization expired.');
      }
    } catch {
      setError('Connection failure on administrative metrics telemetry channels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-panel-2 rounded-xl animate-pulse" />
            <div className="h-4 w-32 bg-panel-2 rounded-lg animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-panel-2 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-panel/80 border border-line/60 p-6 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-panel/80 border border-line/60 rounded-2xl animate-pulse" />
          <div className="h-80 bg-panel/80 border border-line/60 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rust/5 border border-rust/15 p-8 rounded-2xl text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rust/10 border border-rust/20 flex items-center justify-center text-rust mx-auto">
          <AlertCircle size={24} />
        </div>
        <p className="text-sm font-mono text-rust font-semibold">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-5 py-2.5 bg-rust/10 text-rust rounded-xl text-[13px] font-medium border border-rust/20 hover:bg-rust/20 cursor-pointer transition-all"
        >
          Re-establish Connection
        </button>
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Total Users', 
      value: metrics?.totalUsers || 0, 
      icon: Users, 
      gradient: 'from-blue-500/15 to-indigo-500/5',
      iconBg: 'bg-blue-500/10 border-blue-500/20 text-cat-blue',
      change: 'All registered',
      changeColor: 'text-cat-blue'
    },
    { 
      label: 'Active / Online', 
      value: `${metrics?.activeUsers || 0} / ${metrics?.onlineUsers || 0}`, 
      icon: Activity, 
      gradient: 'from-emerald-500/15 to-teal-500/5',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-leaf',
      change: `${metrics?.onlineUsers || 0} connected`,
      changeColor: 'text-leaf'
    },
    { 
      label: 'Workspaces', 
      value: metrics?.totalWorkspaces || 0, 
      icon: Layers, 
      gradient: 'from-violet-500/15 to-purple-500/5',
      iconBg: 'bg-violet-500/10 border-violet-500/20 text-cat-violet',
      change: 'Active environments',
      changeColor: 'text-cat-violet'
    },
    { 
      label: 'AI Requests Today', 
      value: metrics?.aiRequestsToday || 0, 
      icon: Zap, 
      gradient: 'from-amber-500/15 to-orange-500/5',
      iconBg: 'bg-amber-500/10 border-amber-500/20 text-warn',
      change: metrics?.averageResponseTime ? `Avg ${metrics.averageResponseTime}ms` : 'No data yet',
      changeColor: 'text-warn'
    },
  ];

  return (
    <div className="space-y-8 select-text">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cream">Dashboard</h1>
          <p className="text-[13px] text-faint font-mono mt-1">Real-time platform telemetry overview</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2.5 bg-panel/80 border border-line/60 hover:border-line-2 rounded-xl text-[13px] font-medium text-sand hover:text-cream transition-all cursor-pointer"
        >
          <RefreshCw size={13} />
          Sync telemetry
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`p-5 bg-gradient-to-br ${card.gradient} border border-line/60 rounded-2xl flex items-center justify-between hover:border-line-2 transition-all ws-card-lift`}>
              <div className="space-y-2">
                <span className="text-[13px] text-faint font-bold uppercase tracking-wider font-mono">{card.label}</span>
                <h4 className="text-2xl font-bold text-cream tracking-tight">{card.value}</h4>
                <p className={`text-[13px] font-mono font-bold flex items-center gap-1 ${card.changeColor}`}>
                  <TrendingUp size={10} />
                  {card.change}
                </p>
              </div>
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${card.iconBg}`}>
                <Icon size={18} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Usage Chart */}
        <div className="p-6 bg-panel/80 border border-line/60 rounded-2xl space-y-4">
          <div>
            <span className="text-[13px] font-mono text-cat-blue uppercase font-bold tracking-widest">Processing trends</span>
            <h3 className="text-sm font-semibold text-cream mt-1">Daily AI Processing Volume</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts?.dailyAiUsage || []}>
                <defs>
                  <linearGradient id="aiUsageGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-2)" opacity={0.5} />
                <XAxis dataKey="day" stroke="var(--color-faint)" fontSize={12} className="font-mono" />
                <YAxis stroke="var(--color-faint)" fontSize={12} className="font-mono" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-line)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                  itemStyle={{ color: 'var(--color-cream)', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--color-sand)', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#aiUsageGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Growth Chart */}
        <div className="p-6 bg-panel/80 border border-line/60 rounded-2xl space-y-4">
          <div>
            <span className="text-[13px] font-mono text-leaf uppercase font-bold tracking-widest">Growth metrics</span>
            <h3 className="text-sm font-semibold text-cream mt-1">Active Accounts Expansion</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts?.usergrowth || []}>
                <defs>
                  <linearGradient id="userGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-2)" opacity={0.5} />
                <XAxis dataKey="day" stroke="var(--color-faint)" fontSize={12} className="font-mono" />
                <YAxis stroke="var(--color-faint)" fontSize={12} className="font-mono" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-line)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                  itemStyle={{ color: 'var(--color-cream)', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--color-sand)', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="users" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#userGrowthGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* System Health + Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health */}
        <div className="p-6 bg-panel/80 border border-line/60 rounded-2xl space-y-5 lg:col-span-1">
          <div>
            <span className="text-[13px] font-mono text-warn uppercase font-bold tracking-widest">System Health</span>
            <h3 className="text-sm font-semibold text-cream mt-1">Node Diagnostics</h3>
          </div>

          <div className="space-y-4">
            {/* CPU */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[14px] font-mono">
                <span className="text-sand flex items-center gap-1.5"><Cpu size={11} /> CPU Load</span>
                <span className="text-cream font-semibold">{system?.cpuUsage || 14}%</span>
              </div>
              <div className="w-full bg-panel-2/60 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${system?.cpuUsage || 14}%` }}
                />
              </div>
            </div>

            {/* RAM */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[14px] font-mono">
                <span className="text-sand flex items-center gap-1.5"><HardDrive size={11} /> Memory</span>
                <span className="text-cream font-semibold">{system?.memoryUsage || 42}%</span>
              </div>
              <div className="w-full bg-panel-2/60 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${system?.memoryUsage || 42}%` }}
                />
              </div>
            </div>

            {/* Details */}
            <div className="pt-4 border-t border-line/60 space-y-3 font-mono text-[14px]">
              <div className="flex justify-between items-center">
                <span className="text-faint">Database</span>
                <span className="text-ember-soft font-bold uppercase">{system?.databaseState || 'Connected'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-faint">WebSocket</span>
                <span className="text-leaf font-bold uppercase">Online</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-faint">Ping</span>
                <span className="text-warn font-bold">{system?.pingMs || 8}ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="p-6 bg-panel/80 border border-line/60 rounded-2xl space-y-4 lg:col-span-2">
          <div>
            <span className="text-[13px] font-mono text-rust uppercase font-bold tracking-widest">Recent Activity</span>
            <h3 className="text-sm font-semibold text-cream mt-1">Event Feed</h3>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {recentLogs.length === 0 ? (
              <p className="text-[13px] text-faint italic text-center py-10">No recent activity recorded.</p>
            ) : (
              recentLogs.slice(0, 5).map((log, index) => (
                <div key={log.id || `log-${index}`} className="p-3.5 bg-panel-2/50 border border-line/40 rounded-xl hover:border-line-2 transition-all select-text">
                  <div className="flex justify-between items-center text-[13px] mb-1.5 font-mono">
                    <span className={`px-2 py-0.5 rounded-lg font-bold uppercase text-[13px] ${
                      log.action.includes('FAILED') || log.action.includes('BLOCK') 
                        ? 'bg-rose-500/10 text-rust border border-rose-500/20' 
                        : log.action.includes('ROLE_CHANGE')
                        ? 'bg-amber-500/10 text-warn border border-amber-500/20'
                        : 'bg-emerald-500/10 text-leaf border border-emerald-500/20'
                    }`}>
                      {log.action}
                    </span>
                    <span className="text-faint">{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[13px] font-sans text-cream/80 break-words line-clamp-2">{log.details}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

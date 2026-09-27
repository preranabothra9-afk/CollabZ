import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { RefreshCw, Info } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

interface ChartData {
  dailyAiUsage: { day: string; requests: number }[];
  usergrowth: { day: string; users: number }[];
  workspaceActivity: { day: string; activeRooms: number }[];
  modelUsage: { name: string; value: number }[];
}

export default function AdminAnalytics() {
  const { token } = useStore();
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/dashboard/metrics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCharts(data.charts);
      } else {
        const err = await res.json();
        setError(err.error || 'Access expired.');
      }
    } catch {
      setError('Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

  return (
    <div className="space-y-7 select-text relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cream">Analytics</h1>
          <p className="text-[13px] text-faint font-mono mt-1">Platform intelligence overview</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="flex items-center gap-2 px-4 py-2.5 bg-panel/80 border border-line/60 hover:border-line-2 rounded-xl text-[13px] font-medium text-sand hover:text-cream transition-all cursor-pointer"
        >
          <RefreshCw size={13} />
          Sync charts
        </button>
      </div>

      {loading ? (
        <div className="py-24 text-center space-y-3 bg-panel/80 border border-line/60 rounded-2xl">
          <div className="w-8 h-8 rounded-full border-2 border-ember/20 border-t-ember animate-spin mx-auto" />
          <p className="text-[13px] font-mono tracking-widest text-faint uppercase">Loading analytics...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/5 border border-rose-500/15 p-4 rounded-xl text-[13px] text-rust">{error}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Usage */}
            <div className="p-6 bg-panel/80 border border-line/60 rounded-2xl space-y-4 lg:col-span-2">
              <div>
                <span className="text-[13px] font-mono text-cat-indigo font-bold uppercase tracking-widest">Processing metrics</span>
                <h3 className="text-sm font-semibold text-cream mt-1">AI Prompt Streams by Day</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts?.dailyAiUsage || []}>
                    <defs>
                      <linearGradient id="analytGrad" x1="0" y1="0" x2="0" y2="1">
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
                    <Area type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#analytGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Model Distribution */}
            <div className="p-6 bg-panel/80 border border-line/60 rounded-2xl space-y-5 lg:col-span-1 flex flex-col justify-between">
              <div>
                <span className="text-[13px] font-mono text-leaf font-bold uppercase tracking-widest">Model registry</span>
                <h3 className="text-sm font-semibold text-cream mt-1">Distribution Ratio</h3>
              </div>

              <div className="space-y-4">
                {charts?.modelUsage && charts.modelUsage.length > 0 ? (
                  charts.modelUsage.map((item, index) => {
                    const total = charts.modelUsage.reduce((acc, cr) => acc + cr.value, 0) || 1;
                    const percent = Math.round((item.value / total) * 100);
                    const color = COLORS[index % COLORS.length];
                    return (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex justify-between items-center text-[14px] font-mono">
                          <span className="text-cream font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            {item.name}
                          </span>
                          <span className="text-cream/70 font-bold">{percent}%</span>
                        </div>
                        <div className="w-full bg-panel-2/60 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500" 
                            style={{ width: `${percent}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[13px] text-faint italic text-center py-10">No data recorded.</p>
                )}
              </div>

              <div className="pt-3 border-t border-line/60 flex items-start gap-2 text-[13px] text-faint font-mono italic">
                <Info size={12} className="text-cat-indigo shrink-0 mt-0.5" />
                <span>Ratios represent successful streams.</span>
              </div>
            </div>
          </div>

          {/* Workspace Activity */}
          <div className="p-6 bg-panel/80 border border-line/60 rounded-2xl space-y-4">
            <div>
              <span className="text-[13px] font-mono text-leaf font-bold uppercase tracking-widest">Sandbox activity</span>
              <h3 className="text-sm font-semibold text-cream mt-1">Active Room Volumes</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts?.workspaceActivity || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-2)" opacity={0.5} />
                  <XAxis dataKey="day" stroke="var(--color-faint)" fontSize={12} className="font-mono" />
                  <YAxis stroke="var(--color-faint)" fontSize={12} className="font-mono" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-line)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                    itemStyle={{ color: 'var(--color-cream)', fontSize: '12px' }}
                    labelStyle={{ color: 'var(--color-sand)', fontSize: '12px' }}
                  />
                  <Bar dataKey="activeRooms" radius={[6, 6, 0, 0]}>
                    {charts?.workspaceActivity.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#10b981" fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

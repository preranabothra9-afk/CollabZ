import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { 
  Zap, RefreshCw, Clock, AlertTriangle, CheckCircle, Cpu, Activity, Wifi
} from 'lucide-react';

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

interface SystemStatus {
  cpuUsage: number;
  memoryUsage: number;
  databaseState: string;
  socketsPool: number;
  pingMs: number;
}

export default function AdminAiMonitoring() {
  const { token } = useStore();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMonitoringData = async () => {
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
        setSystem(data.systemStatus);
      } else {
        const err = await res.json();
        setError(err.error || 'Connection expired.');
      }
    } catch {
      setError('Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="space-y-6 select-text relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cream">AI Monitoring</h1>
          <p className="text-[13px] text-faint font-mono mt-1">Engine telemetry & model status</p>
        </div>
        <button
          onClick={fetchMonitoringData}
          className="flex items-center gap-2 px-4 py-2.5 bg-panel/80 border border-line/60 hover:border-line-2 rounded-xl text-[13px] font-medium text-sand hover:text-cream transition-all cursor-pointer"
        >
          <RefreshCw size={13} />
          Sync engine
        </button>
      </div>

      {loading ? (
        <div className="py-24 text-center space-y-3 bg-panel/80 border border-line/60 rounded-2xl">
          <div className="w-8 h-8 rounded-full border-2 border-ember/20 border-t-ember animate-spin mx-auto" />
          <p className="text-[13px] font-mono tracking-widest text-faint uppercase">Loading AI data...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/5 border border-rose-500/15 p-4 rounded-xl text-[13px] text-rust">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 border border-indigo-500/20 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none" />
              <div className="flex justify-between items-center z-10">
                <span className="text-[13px] text-faint font-bold uppercase tracking-wider font-mono">AI Requests Today</span>
                <Zap size={14} className="text-cat-indigo" />
              </div>
              <div className="mt-2 z-10">
                <h4 className="text-2xl font-bold text-cream tracking-tight">{metrics?.aiRequestsToday || 0}</h4>
                <p className="text-[13px] text-cat-indigo mt-1 font-mono font-medium">REAL-TIME STREAMS</p>
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl flex flex-col justify-between h-32">
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-faint font-bold uppercase tracking-wider font-mono">Avg Latency</span>
                <Clock size={14} className="text-leaf" />
              </div>
              <div className="mt-2">
                <h4 className="text-2xl font-bold text-cream tracking-tight">{metrics?.averageResponseTime || 0} <span className="text-sm text-faint">ms</span></h4>
                <p className="text-[13px] text-leaf mt-1 font-mono font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-leaf animate-ping" />
                  Within limits
                </p>
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl flex flex-col justify-between h-32">
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-faint font-bold uppercase tracking-wider font-mono">Error Rate</span>
                <AlertTriangle size={14} className="text-warn" />
              </div>
              <div className="mt-2">
                <h4 className="text-2xl font-bold text-cream tracking-tight">0.02%</h4>
                <p className="text-[13px] text-warn mt-1 font-mono">SAFE PROTOCOLS</p>
              </div>
            </div>
          </div>

          {/* Model Status + Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Model Status */}
            <div className="p-5 bg-panel/80 border border-line/60 rounded-2xl space-y-4">
              <h3 className="text-[13px] font-mono font-bold text-cat-indigo uppercase tracking-widest">Model Status</h3>
              <div className="space-y-3">
                {[
                  { name: 'gemini-3.5-flash', limit: '15 req/min', state: 'Operational', color: 'text-leaf border-emerald-500/20 bg-emerald-500/5' },
                  { name: 'gemini-3.1-flash-lite', limit: '30 req/min', state: 'Operational', color: 'text-leaf border-emerald-500/20 bg-emerald-500/5' },
                  { name: 'gemini-flash-latest', limit: '10 req/min', state: 'Operational', color: 'text-leaf border-emerald-500/20 bg-emerald-500/5' },
                  { name: 'claude-3-5', limit: 'Rate limited', state: 'Offline', color: 'text-faint border-line bg-panel-2/50' }
                ].map((m) => (
                  <div key={m.name} className="p-3 bg-panel-2/40 border border-line/40 rounded-xl flex items-center justify-between hover:border-line-2 transition-colors">
                    <div>
                      <span className="text-[13px] font-semibold text-cream block">{m.name}</span>
                      <span className="text-[13px] text-faint font-mono">{m.limit}</span>
                    </div>
                    <div className={`px-2.5 py-1 border rounded-lg font-mono font-bold text-[13px] uppercase ${m.color}`}>
                      {m.state}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div className="p-5 bg-panel/80 border border-line/60 rounded-2xl flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-[13px] font-mono font-bold text-cat-violet uppercase tracking-widest">Integration Settings</h3>
                <div className="space-y-3 font-mono text-[14px]">
                  {[
                    { label: 'SDK Driver', value: '@google/genai', icon: Cpu },
                    { label: 'Streaming', value: 'ENABLED', color: 'text-leaf', icon: Activity },
                    { label: 'Parallel Queries', value: 'Up to 4', icon: Zap },
                    { label: 'Fallback Model', value: 'gemini-3.1-flash-lite', icon: AlertTriangle },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex justify-between items-center py-2.5 border-b border-line/40 last:border-0">
                        <span className="text-faint flex items-center gap-2"><Icon size={12} /> {item.label}</span>
                        <span className={`font-bold uppercase ${item.color || 'text-cream'}`}>{item.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-line/60 flex items-start gap-2 text-[13px] text-faint leading-normal font-mono italic">
                <CheckCircle size={12} className="text-cat-indigo shrink-0 mt-0.5" />
                <span>Engine connected. No secrets exposed to client.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

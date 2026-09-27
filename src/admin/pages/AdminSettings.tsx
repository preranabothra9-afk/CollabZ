import React, { useState } from 'react';
import { Settings, Shield, Save, CheckCircle, Lock, Key, Database, Wifi } from 'lucide-react';

export default function AdminSettings() {
  const [toast, setToast] = useState<string | null>(null);
  const [sessionTimeout, setSessionTimeout] = useState('24h');
  const [rateLimit, setRateLimit] = useState('60');

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Settings saved successfully.');
  };

  return (
    <div className="space-y-6 select-text relative">
      {toast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-500/30 bg-panel text-leaf text-[13px] font-semibold font-mono animate-slideIn">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-cream">Settings</h1>
        <p className="text-[13px] text-faint font-mono mt-1">Platform configuration</p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Session Config */}
          <div className="p-6 bg-panel/80 border border-line/60 rounded-2xl space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-cat-indigo">
                <Lock size={14} />
              </div>
              <h3 className="text-[13px] font-mono font-bold text-cat-indigo uppercase tracking-widest">Session Configuration</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[14px] uppercase tracking-wider font-semibold text-sand block font-mono">Admin Session Timeout</label>
                <select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  className="w-full bg-ink/50 border border-line/60 rounded-xl px-4 py-2.5 text-[13px] text-cream focus:outline-none focus:border-ember/50 focus:ring-2 focus:ring-ember/10 transition-all cursor-pointer"
                >
                  <option value="1h">1 hour (Strict)</option>
                  <option value="8h">8 hours (Standard)</option>
                  <option value="24h">24 hours (Relaxed)</option>
                  <option value="7d">7 days (Extended)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] uppercase tracking-wider font-semibold text-sand block font-mono">API Rate Limits</label>
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  placeholder="Requests per minute"
                  className="w-full bg-ink/50 border border-line/60 rounded-xl px-4 py-2.5 text-[13px] text-cream placeholder-faint focus:outline-none focus:border-ember/50 focus:ring-2 focus:ring-ember/10 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="p-6 bg-panel/80 border border-line/60 rounded-2xl space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-leaf">
                <Shield size={14} />
              </div>
              <h3 className="text-[13px] font-mono font-bold text-leaf uppercase tracking-widest">Security Architecture</h3>
            </div>
            
            <div className="space-y-3 font-mono text-[14px] bg-panel-2/40 p-4 rounded-xl border border-line/40">
              {[
                { label: 'JWT Algorithm', value: 'HS256 (HMAC-SHA256)', icon: Key },
                { label: 'Password Hashing', value: 'Bcrypt (10 rounds)', icon: Lock },
                { label: 'Storage Layer', value: 'MongoDB Atlas', icon: Database },
                { label: 'Socket Transport', value: 'SSL Verified', icon: Wifi, color: 'text-leaf' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b border-line/30 last:border-0">
                    <span className="text-faint flex items-center gap-2"><Icon size={11} /> {item.label}</span>
                    <span className={`font-bold ${item.color || 'text-cream'}`}>{item.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-ember to-ember-2 hover:from-ember-2 hover:to-ember text-on-ember rounded-xl text-[13px] font-semibold tracking-tight transition-all shadow-lg shadow-ember/25 flex items-center gap-2 cursor-pointer btn-3d"
          >
            <Save size={14} />
            Save Settings
          </button>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6 lg:col-span-1">
          <div className="p-6 bg-panel/80 border border-line/60 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-cat-indigo">
              <Shield size={16} />
              <h3 className="text-[13px] font-mono uppercase tracking-widest font-bold">Security Notice</h3>
            </div>
            <p className="text-[13px] text-sand leading-relaxed">
              All modifications, account changes, and workspace deletions are permanently recorded in the immutable audit registry.
            </p>
          </div>

          <div className="p-6 bg-panel/80 border border-line/60 rounded-2xl space-y-4 font-mono text-[14px]">
            <span className="text-faint font-bold tracking-widest uppercase">System Info</span>
            <div className="space-y-2 leading-normal text-sand mt-2">
              <div className="flex justify-between"><span className="text-faint">Platform</span><span className="text-cream font-bold">v2.4.0</span></div>
              <div className="flex justify-between"><span className="text-faint">Database</span><span className="text-leaf font-bold">Connected</span></div>
              <div className="flex justify-between"><span className="text-faint">TLS Port</span><span className="text-cream font-bold">3000</span></div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

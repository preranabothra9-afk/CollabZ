import React, { useState } from 'react';
import { useStore } from '../../store';
import {
  ShieldCheck, LogOut, Terminal, Users, Layers, LineChart,
  Activity, History, Settings, LayoutDashboard, Menu, X, ChevronRight, Home,
  LayoutGrid
} from 'lucide-react';
import { BrandLogoCompact, BrandLogoIcon } from '../../brand';
import ThemeSwitcher from '../../components/ThemeSwitcher';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { title: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, color: 'from-blue-500/20 to-indigo-500/10' },
  { title: 'Users', path: '/admin/users', icon: Users, color: 'from-emerald-500/20 to-teal-500/10' },
  { title: 'Workspaces', path: '/admin/workspaces', icon: Layers, color: 'from-violet-500/20 to-purple-500/10' },
  { title: 'Analytics', path: '/admin/analytics', icon: LineChart, color: 'from-amber-500/20 to-orange-500/10' },
  { title: 'AI Monitoring', path: '/admin/ai-monitoring', icon: Activity, color: 'from-rose-500/20 to-pink-500/10' },
  { title: 'Audit Logs', path: '/admin/audit-logs', icon: History, color: 'from-cyan-500/20 to-sky-500/10' },
  { title: 'Settings', path: '/admin/settings', icon: Settings, color: 'from-slate-500/20 to-gray-500/10' },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, currentPath, navigateTo, logout } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-ink flex flex-col items-center justify-center text-sand p-8 relative overflow-hidden grain">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(40rem 30rem at 100% 0%, color-mix(in srgb, var(--color-rust) 7%, transparent), transparent 62%)' }}
        />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-rust/10 border border-rust/20 flex items-center justify-center text-rust mb-5 animate-bounce">
            <Terminal size={26} />
          </div>
          <p className="text-sm font-mono text-cream font-semibold mb-1">Access Denied</p>
          <p className="text-[13px] text-faint max-w-sm text-center mb-6">Your authorization token is insufficient for administrative cluster services.</p>
          <button
            onClick={() => logout()}
            className="px-5 py-2.5 bg-panel hover:bg-panel-2 border border-line hover:border-line-2 rounded-xl text-[13px] font-medium text-sand transition-colors cursor-pointer"
          >
            Sign Out of System
          </button>
        </div>
      </div>
    );
  }

  const renderNav = (labels: boolean, isDesktop: boolean) => (
    <div className="flex flex-col h-full select-none">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-16 border-b border-line/60">
        {labels ? (
          <button
            type="button"
            onClick={() => navigateTo('/home')}
            title="Go to homepage"
            className="flex items-center gap-2.5 min-w-0 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-ember/20 to-ember/5 border border-ember/20 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} className="text-ember" />
            </div>
            <BrandLogoCompact />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigateTo('/home')}
            title="Go to homepage"
            className="flex justify-center w-full cursor-pointer"
          >
            <ShieldCheck size={20} className="text-ember" />
          </button>
        )}
        {labels && <div className="flex-1" />}
        {labels && !isDesktop && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-xl text-faint hover:text-cream hover:bg-panel-2/80 transition-all cursor-pointer shrink-0 lg:hidden"
            title="Close"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
        {labels && (
          <p className="px-2 pb-2.5 text-[13px] font-mono font-bold uppercase tracking-[0.15em] text-faint">
            Control Console
          </p>
        )}
        {/* Homepage Link */}
        <button
          onClick={() => { navigateTo('/home'); setMobileOpen(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer text-sand hover:bg-panel-2/60 hover:text-cream border border-transparent"
          title="Back to Homepage"
        >
          <div className="w-7 h-7 rounded-lg bg-panel-2/50 flex items-center justify-center shrink-0 text-faint">
            <Home size={14} />
          </div>
          <span className="truncate text-left">Homepage</span>
        </button>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path || (item.path === '/admin/dashboard' && (currentPath === '/admin' || currentPath === '/admin/'));
          return (
            <button
              key={item.path}
              onClick={() => { navigateTo(item.path); setMobileOpen(false); }}
              className={`group relative w-full flex items-center gap-3 ${labels ? 'px-3' : 'px-0 justify-center'} py-2.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-ember/10 text-ember-soft border border-ember/15 shadow-sm'
                  : 'text-sand hover:bg-panel-2/60 hover:text-cream border border-transparent'
              }`}
              title={item.title}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                isActive ? `bg-gradient-to-br ${item.color} text-ember` : 'bg-panel-2/50 text-faint group-hover:text-sand'
              }`}>
                <Icon size={14} />
              </div>
              {labels && <span className="truncate text-left">{item.title}</span>}
              {isActive && labels && (
                <ChevronRight size={12} className="ml-auto text-ember/50" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Back to the workspace hub */}
      <div className="px-3 pb-3">
        <button
          onClick={() => { navigateTo('/workspaces'); setMobileOpen(false); }}
          title="Back to your workspaces"
          className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-[13px] font-medium text-sand hover:text-cream hover:bg-panel-2/60 transition-all cursor-pointer ${labels ? 'px-3' : 'justify-center'}`}
        >
          <div className="w-7 h-7 rounded-lg bg-panel-2/50 text-faint group-hover:text-sand flex items-center justify-center shrink-0">
            <LayoutGrid size={14} />
          </div>
          {labels && <span className="truncate text-left">Workspace hub</span>}
        </button>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-4 border-t border-line/60 space-y-3">
        <div className={`flex items-center gap-2 px-3 py-2 bg-leaf/5 border border-leaf/15 rounded-xl ${labels ? '' : 'justify-center'}`}>
          <span className="w-2 h-2 rounded-full bg-leaf animate-ping shrink-0" />
          {labels && <span className="text-[13px] font-mono text-leaf font-bold tracking-wider">NODE_STABLE</span>}
        </div>

        <div className={`flex items-center gap-3 ${labels ? '' : 'flex-col gap-2'}`}>
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-ember to-ember-2 text-on-ember font-bold flex items-center justify-center text-[13px] ring-2 ring-ember/20">
              {user.name ? user.name[0].toUpperCase() : 'A'}
            </div>
          </div>
          {labels && (
            <div className="leading-tight min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-cream truncate">{user.name || 'Admin'}</p>
              <p className="text-[13px] text-faint font-mono uppercase tracking-wider">Superuser</p>
            </div>
          )}
          <ThemeSwitcher variant="icon" />
          <button
            onClick={() => logout()}
            className="p-2 rounded-xl text-faint hover:text-rust hover:bg-rust/10 transition-all cursor-pointer shrink-0"
            title="Sign Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-ink text-cream overflow-hidden relative select-none">
      {/* Subtle background texture */}
      <div className="absolute inset-0 brand-dot-grid opacity-25 pointer-events-none" />

      {/* Mobile open button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-[105] lg:hidden flex items-center justify-center w-11 h-11 rounded-2xl bg-panel border border-line-2 shadow-lg text-cream cursor-pointer hover:bg-panel-2 transition-colors"
        title="Open navigation"
      >
        <Menu size={18} />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-full bg-panel/80 backdrop-blur-sm border-r border-line/60 shrink-0 z-10">
        {renderNav(true, true)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-[100] lg:hidden modal-scrim animate-fadeIn"
          />
          <aside className="fixed inset-y-0 left-0 z-[110] w-72 flex lg:hidden bg-panel border-r border-line-2 shadow-2xl animate-slideInLeft">
            {renderNav(true, false)}
          </aside>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10">
        <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
          {children}
        </div>
      </main>
    </div>
  );
}

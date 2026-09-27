import React, { useEffect } from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import WorkspaceHeader from './components/WorkspaceHeader';
import ChatArea from './components/ChatArea';
import PromptBox from './components/PromptBox';
import SavedResponses from './components/SavedResponses';
import AuthPortal from './components/AuthPortal';
import HomePage from './components/HomePage';
import WorkspaceHub from './components/WorkspaceHub';

// Dedicated Admin Components & Layout
import AdminLayout from './admin/layouts/AdminLayout';
import AdminDashboard from './admin/pages/AdminDashboard';
import AdminUsers from './admin/pages/AdminUsers';
import AdminWorkspaces from './admin/pages/AdminWorkspaces';
import AdminAnalytics from './admin/pages/AdminAnalytics';
import AdminAiMonitoring from './admin/pages/AdminAiMonitoring';
import AdminAuditLogs from './admin/pages/AdminAuditLogs';
import AdminSettings from './admin/pages/AdminSettings';

// Brand System
import { BrandLoader, usePageTitle, BRAND } from './brand';

export default function App() {
  const { 
    user, 
    isAuthenticating, 
    init, 
    currentPath,
    navigateTo,
    setCurrentPath,
    activeWorkspace,
    isSavedResponsesOpen,
    setSavedResponsesOpen
  } = useStore();

  // Dynamic page title based on current route
  usePageTitle(
    !user
      ? (currentPath.startsWith('/reset-password')
          ? '/reset-password'
          : currentPath.startsWith('/login')
            ? '/login'
            : currentPath.startsWith('/register')
              ? '/register'
              : '/')
      : currentPath
  );

  // Trigger initial auth session checks on mount
  useEffect(() => {
    init();
  }, [init]);

  // Collapse the saved responses drawer on small screens initially
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSavedResponsesOpen(false);
    }
  }, [setSavedResponsesOpen]);

  // Handle Popstate/Back browser sync
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setCurrentPath]);

  // Route guards. The hub at "/workspaces" is the landing page for EVERY
  // signed-in role, so admins are no longer force-redirected to the dashboard
  // on sign-in; they reach the admin panel from the hub. Non-admins are still
  // kept out of admin routes, and a lingering auth URL is corrected to the hub.
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin' && currentPath.startsWith('/admin')) {
      navigateTo('/workspaces');
      return;
    }
    // A restored session (refresh on /login) would otherwise render the hub
    // while the address bar still claimed to be the sign-in page.
    if (currentPath === '/login' || currentPath === '/register') {
      navigateTo('/workspaces');
    }
  }, [user, navigateTo, currentPath]);

  // ─── Branded Loading Experience ──────────────────────────────────────
  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-ink flex flex-col items-center justify-center text-sand relative overflow-hidden grain">
        {/* Soft warm background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(46rem 34rem at 14% 0%, color-mix(in srgb, var(--color-ember) 8%, transparent), transparent 62%)' }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6 animate-fadeIn">
          <BrandLoader />
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-[13px] font-mono uppercase tracking-[0.2em] text-faint font-semibold animate-pulse">
              Initializing {BRAND.name}
            </p>
            <div className="w-32 h-0.5 rounded-full overflow-hidden bg-line">
              <div className="h-full rounded-full animate-shimmer" style={{ background: 'linear-gradient(90deg, #4f46e5, #6366f1, #818cf8)', backgroundSize: '200% 100%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Public site vs. authentication portal ───────────────────────────
  if (!user) {
    // The reset-password deep link keeps its own view inside the portal
    if (currentPath.startsWith('/reset-password')) {
      return <AuthPortal />;
    }
    // Email verification link from the inbox
    if (currentPath.startsWith('/verify-email')) {
      return <AuthPortal />;
    }
    if (currentPath.startsWith('/login') || currentPath.startsWith('/register')) {
      return <AuthPortal />;
    }
    // Everything else (including "/") shows the public landing page
    return <HomePage />;
  }

  // /home always shows the public homepage (even when logged in)
  if (currentPath === '/home') {
    return <HomePage />;
  }

  // Segment routes for Admin Dashboard specifically
  if (currentPath.startsWith('/admin')) {
    // Resolve nested subpages
    let AdminView = <AdminDashboard />;
    if (currentPath === '/admin/users') {
      AdminView = <AdminUsers />;
    } else if (currentPath === '/admin/workspaces') {
      AdminView = <AdminWorkspaces />;
    } else if (currentPath === '/admin/analytics') {
      AdminView = <AdminAnalytics />;
    } else if (currentPath === '/admin/ai-monitoring') {
      AdminView = <AdminAiMonitoring />;
    } else if (currentPath === '/admin/audit-logs') {
      AdminView = <AdminAuditLogs />;
    } else if (currentPath === '/admin/settings') {
      AdminView = <AdminSettings />;
    }

    return (
      <AdminLayout>
        {AdminView}
      </AdminLayout>
    );
  }

  // The room view is reachable only by an explicit choice made on the hub.
  if (currentPath === '/workspace' && activeWorkspace) {
    return (
      <div className="flex h-screen bg-ink font-sans text-cream overflow-hidden relative select-none">
        <div className="absolute inset-0 brand-dot-grid opacity-20 pointer-events-none" />

        <Sidebar />

        <div className="flex-1 flex min-h-0 min-w-0 relative">
          <main className="flex-1 flex flex-col min-w-0 relative">
            <WorkspaceHeader />
            <ChatArea />
            <PromptBox />
          </main>

          {isSavedResponsesOpen && (
            <aside className="hidden lg:flex w-72 border-l border-line/60 bg-panel/80 backdrop-blur-sm shrink-0">
              <SavedResponses />
            </aside>
          )}
        </div>

        {isSavedResponsesOpen && (
          <>
            <aside className="fixed inset-y-0 right-0 w-72 z-[100] h-full border-l border-line bg-panel/95 backdrop-blur-md lg:hidden animate-slideInRight shadow-2xl">
              <SavedResponses />
            </aside>
            <div onClick={() => setSavedResponsesOpen(false)} className="fixed inset-0 modal-scrim z-[90] lg:hidden animate-fadeIn" />
          </>
        )}
      </div>
    );
  }

  // Everything else is the hub, which is the post-login landing page. This must
  // stay a catch-all: the auth portal leaves the URL at /login or /register, so
  // any unmatched path previously fell through into an empty chat room.
  return <WorkspaceHub />;
}

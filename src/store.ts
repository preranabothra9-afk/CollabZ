import { create } from 'zustand';
import { io } from 'socket.io-client';
import { User, Workspace, Conversation, Message, SavedResponse } from './types';

/** Compact search hit returned by the room history search endpoint. */
export interface SearchResult {
  id: string;
  promptText: string;
  createdAt: string;
  senderName: string;
  matchedIn: string;
  snippet: string;
}

// Import our modular stores to compose the hub
import { useAuthStore } from './stores/authStore';
import { useWorkspaceStore } from './stores/workspaceStore';
import { useSocketStore } from './stores/socketStore';
import { useUIStore } from './stores/uiStore';
import type { Theme } from './stores/uiStore';
import { useChatStore } from './stores/chatStore';

export interface AppState {
  // Auth state
  user: User | null;
  token: string | null;
  isAuthenticating: boolean;
  authError: string | null;

  // Navigation & Hierarchy
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  hasMoreMessages: boolean;
  isLoadingOlder: boolean;
  highlightMessageId: string | null;
  setHighlightMessageId: (id: string | null) => void;
  savedResponses: SavedResponse[];
  // Real-time Presence
  presence: any[];
  collaborativePromptText: string;
  whoIsEditing: string | null;
  
  // App UI state
  selectedModels: string[];
  isSidebarOpen: boolean;
  isSavedResponsesOpen: boolean;
  isAdminPanelOpen: boolean;
  currentPath: string;
  theme: Theme;
  socketConnected: boolean;

  // Socket reference
  socket: any | null;

  // Init routines
  init: () => Promise<void>;
  
  // Auth Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearAuthError: () => void;

  // Password recovery
  requestPasswordReset: (email: string) => Promise<{ message: string; resetUrl?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; message: string }>;

  // Email verification
  pendingVerificationEmail: string | null;
  pendingVerificationUrl: string | null;
  setPendingVerification: (email: string | null, url?: string | null) => void;
  verifyEmail: (token: string) => Promise<{ success: boolean; message: string; code?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; message: string; verificationUrl?: string; mailFailed?: boolean }>;

  // Workspace Actions
  fetchWorkspaces: (options?: { autoEnter?: boolean }) => Promise<void>;
  createWorkspace: (name: string, description: string) => Promise<Workspace | null>;
  deleteWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (ws: Workspace) => void;

  // Channel Actions
  fetchConversations: (workspaceId: string) => Promise<void>;
  createConversation: (title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  setActiveConversation: (conv: Conversation) => void;

  // Messages Actions
  fetchMessages: (conversationId: string) => Promise<void>;
  /** Pages further back into a room's history and prepends the older slice. */
  loadOlderMessages: () => Promise<void>;
  /** Searches a room's prompts + model responses. */
  searchHistory: (conversationId: string, query: string) => Promise<SearchResult[]>;
  /** Scrolls the feed to a message, paging history in if it isn't loaded yet. */
  jumpToMessage: (messageId: string, createdAt: string) => Promise<void>;
  submitPrompt: (promptText: string) => void;
  /** Stops one active model stream, or every stream of a message when modelKey is omitted. */
  stopGeneration: (messageId: string, modelKey?: string) => void;

  // Saved AI responses
  fetchSavedResponses: (workspaceId: string) => Promise<void>;
  saveResponse: (prompt: string, modelName: string, responseContent: string, senderName: string) => Promise<void>;
  deleteSavedResponse: (id: string) => Promise<void>;

  // Collaborative Prompt Sync Actions
  sendPromptTextChange: (promptText: string) => void;
  sendTypingStatus: (isTyping: boolean) => void;
  
  // Local state helper
  setCollaborativePromptText: (text: string) => void;
  toggleModel: (modelKey: string) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setSavedResponsesOpen: (isOpen: boolean) => void;
  setAdminPanelOpen: (isOpen: boolean) => void;
  setCurrentPath: (path: string) => void;
  navigateTo: (path: string) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const API_BASE = '/api';

export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().token;
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const mergedOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include'
  };

  let response = await fetch(url, mergedOptions);

  if (response.status === 401) {
    try {
      console.log('Access token expired. Seeking dynamic token rotation...');
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newToken = refreshData.token;
        const newUser = refreshData.user;

        useAuthStore.setState({ token: newToken, user: newUser, authError: null });

        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        
        console.log('Token rotated successfully. Retrying original request...');
        response = await fetch(url, {
          ...options,
          headers: retryHeaders,
          credentials: 'include'
        });
      } else {
        console.warn('Refresh token invalid or expired. Performing session cleanup...');
        useAuthStore.setState({ user: null, token: null });
      }
    } catch (refreshErr) {
      console.error('Refresh token negotiation process error:', refreshErr);
      useAuthStore.setState({ user: null, token: null });
    }
  }

  return response;
}

export const useStore = create<AppState>((set, get) => {
  
  const setupSocket = (user: User, workspaceId: string) => {
    // Teardown stale socket if existing
    const oldSocket = useSocketStore.getState().socket;
    if (oldSocket) {
      oldSocket.disconnect();
    }

    const token = useAuthStore.getState().token || '';
    const socketUrl = window.location.origin;
    
    // Inject auth token in handshake parameters
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token }
    });

    socket.on('connect', () => {
      useSocketStore.setState({ socketConnected: true });
      console.log('Synchronized securely with real-time sockets.');
      
      socket.emit('join-workspace', {
        workspaceId,
        userId: user.id,
        userName: user.name,
        avatar: user.avatar,
      });
    });

    socket.on('disconnect', () => {
      useSocketStore.setState({ socketConnected: false });
    });

    socket.on('error-alert', (error: { message: string }) => {
      console.error('Socket authentication exception:', error.message);
    });

    socket.on('presence-sync', (presenceList: any[]) => {
      useChatStore.setState({ presence: presenceList });
    });

    socket.on('workspace-member-added', (data: { workspaceId: string; user: any }) => {
      // Trigger a workspace reload to incorporate new authorization properties
      const activeWs = useWorkspaceStore.getState().activeWorkspace;
      if (activeWs && activeWs.id === data.workspaceId) {
        const updatedMembers = [...(activeWs.memberIds || []), data.user.id];
        useWorkspaceStore.setState({
          activeWorkspace: { ...activeWs, memberIds: updatedMembers }
        });
      }
      get().fetchWorkspaces();
    });

    socket.on('channel-created', (newChannel: Conversation) => {
      const activeWs = useWorkspaceStore.getState().activeWorkspace;
      if (newChannel.workspaceId === activeWs?.id) {
        useChatStore.setState({
          conversations: [...useChatStore.getState().conversations, newChannel]
        });
      }
    });

    socket.on('channel-deleted', (data: { conversationId: string }) => {
      const filtered = useChatStore.getState().conversations.filter(c => c.id !== data.conversationId);
      let nextActive = useChatStore.getState().activeConversation;
      if (nextActive?.id === data.conversationId) {
        nextActive = filtered.length > 0 ? filtered[0] : null;
      }
      useChatStore.setState({
        conversations: filtered,
        activeConversation: nextActive
      });
      if (nextActive) {
        get().fetchMessages(nextActive.id);
      } else {
        useChatStore.setState({ messages: [] });
      }
    });

    socket.on('prompt-text-sync', (data: { promptText: string; updatedByName: string; updatedBy: string }) => {
      if (data.updatedBy !== user.id) {
        useChatStore.setState({ 
          collaborativePromptText: data.promptText,
          whoIsEditing: data.updatedByName
        });
        
        // Debounce cleanup
        setTimeout(() => {
          if (useChatStore.getState().whoIsEditing === data.updatedByName) {
            useChatStore.setState({ whoIsEditing: null });
          }
        }, 2000);
      }
    });

    socket.on('message-created', (newMessage: Message) => {
      const activeConv = useChatStore.getState().activeConversation;
      if (newMessage.conversationId === activeConv?.id) {
        useChatStore.setState({
          messages: [...useChatStore.getState().messages, newMessage]
        });
      }
    });

    // Handle traditional and modern standardized real-time stream events
    socket.on('model-status-update', (data: { messageId: string; modelKey: string; status: 'streaming' }) => {
      useChatStore.setState({
        messages: useChatStore.getState().messages.map(m => {
          if (m.id === data.messageId && m.modelResponses[data.modelKey]) {
            return {
              ...m,
              modelResponses: {
                ...m.modelResponses,
                [data.modelKey]: {
                  ...m.modelResponses[data.modelKey],
                  status: data.status
                }
              }
            };
          }
          return m;
        })
      });
    });

    socket.on('model-stream-chunk', (data: { messageId: string; modelKey: string; chunk: string }) => {
      useChatStore.setState({
        messages: useChatStore.getState().messages.map(m => {
          if (m.id === data.messageId && m.modelResponses[data.modelKey]) {
            const currentResponse = m.modelResponses[data.modelKey];
            return {
              ...m,
              modelResponses: {
                ...m.modelResponses,
                [data.modelKey]: {
                  ...currentResponse,
                  content: currentResponse.content + data.chunk,
                  status: 'streaming' as const
                }
              }
            };
          }
          return m;
        })
      });
    });

    socket.on('model-stream-complete', (data: { messageId: string; modelKey: string; content: string; durationMs: number }) => {
      useChatStore.setState({
        messages: useChatStore.getState().messages.map(m => {
          if (m.id === data.messageId && m.modelResponses[data.modelKey]) {
            return {
              ...m,
              modelResponses: {
                ...m.modelResponses,
                [data.modelKey]: {
                  ...m.modelResponses[data.modelKey],
                  content: data.content,
                  status: 'completed' as const,
                  durationMs: data.durationMs
                }
              }
            };
          }
          return m;
        })
      });
    });

    socket.on('model-stream-stopped', (data: { messageId: string; modelKey: string; content: string; durationMs: number }) => {
      useChatStore.setState({
        messages: useChatStore.getState().messages.map(m => {
          if (m.id === data.messageId && m.modelResponses[data.modelKey]) {
            return {
              ...m,
              modelResponses: {
                ...m.modelResponses,
                [data.modelKey]: {
                  ...m.modelResponses[data.modelKey],
                  content: data.content,
                  status: 'stopped' as const,
                  durationMs: data.durationMs
                }
              }
            };
          }
          return m;
        })
      });
    });

    socket.on('model-stream-failed', (data: { messageId: string; modelKey: string; error: string }) => {
      useChatStore.setState({
        messages: useChatStore.getState().messages.map(m => {
          if (m.id === data.messageId && m.modelResponses[data.modelKey]) {
            return {
              ...m,
              modelResponses: {
                ...m.modelResponses,
                [data.modelKey]: {
                  ...m.modelResponses[data.modelKey],
                  status: 'failed' as const,
                  error: data.error
                }
              }
            };
          }
          return m;
        })
      });
    });

    useSocketStore.setState({ socket });
  };

  return {
    // Composite Selectors pointing directly to slice stores
    user: useAuthStore.getState().user,
    token: useAuthStore.getState().token,
    isAuthenticating: useAuthStore.getState().isAuthenticating,
    authError: useAuthStore.getState().authError,

    workspaces: useWorkspaceStore.getState().workspaces,
    activeWorkspace: useWorkspaceStore.getState().activeWorkspace,
    
    conversations: useChatStore.getState().conversations,
    activeConversation: useChatStore.getState().activeConversation,
    messages: useChatStore.getState().messages,
    hasMoreMessages: useChatStore.getState().hasMoreMessages,
    isLoadingOlder: useChatStore.getState().isLoadingOlder,
    highlightMessageId: useChatStore.getState().highlightMessageId,
    savedResponses: useChatStore.getState().savedResponses,
    presence: useChatStore.getState().presence,
    collaborativePromptText: useChatStore.getState().collaborativePromptText,
    whoIsEditing: useChatStore.getState().whoIsEditing,

    selectedModels: useUIStore.getState().selectedModels,
    isSidebarOpen: useUIStore.getState().isSidebarOpen,
    isSavedResponsesOpen: useUIStore.getState().isSavedResponsesOpen,
    isAdminPanelOpen: useUIStore.getState().isAdminPanelOpen,
    currentPath: useUIStore.getState().currentPath,
    theme: useUIStore.getState().theme,
    pendingVerificationEmail: null,
    pendingVerificationUrl: null,
    
    socketConnected: useSocketStore.getState().socketConnected,
    socket: useSocketStore.getState().socket,

    // Core Actions
    init: async () => {
      useAuthStore.setState({ isAuthenticating: true });
      try {
        console.log('Hydrating secure session on app startup via token rotation...');
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          useAuthStore.setState({ user: data.user, token: data.token, authError: null });
          
          await get().fetchWorkspaces({ autoEnter: false });
        } else {
          useAuthStore.setState({ user: null, token: null });
        }
      } catch (err) {
        console.error('Session hydration error:', err);
      } finally {
        useAuthStore.setState({ isAuthenticating: false });
      }
    },

    login: async (email, password) => {
      useAuthStore.setState({ isAuthenticating: true, authError: null });
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
          useAuthStore.setState({ user: data.user, token: data.token, authError: null });
          
          await get().fetchWorkspaces({ autoEnter: false });
          useAuthStore.setState({ isAuthenticating: false });
          return true;
        } else {
          useAuthStore.setState({ authError: data.error || 'Login failed', isAuthenticating: false });
          return false;
        }
      } catch (err: any) {
        useAuthStore.setState({ authError: 'Network error. Try again.', isAuthenticating: false });
        return false;
      }
    },

    register: async (name, email, password) => {
      useAuthStore.setState({ isAuthenticating: true, authError: null });
      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
          // Signup no longer returns a session — the account must confirm its
          // email first, so hold no user/token until that happens.
          if (data.requiresVerification) {
            useAuthStore.setState({ user: null, token: null, authError: null, isAuthenticating: false });
            get().setPendingVerification?.(data.user?.email || email, data.verificationUrl);
            return true;
          }

          useAuthStore.setState({ user: data.user, token: data.token, authError: null });
          
          await get().fetchWorkspaces({ autoEnter: false });
          useAuthStore.setState({ isAuthenticating: false });
          return true;
        } else {
          useAuthStore.setState({ authError: data.error || 'Registration failed', isAuthenticating: false });
          return false;
        }
      } catch (err) {
        useAuthStore.setState({ authError: 'Network error. Try again.', isAuthenticating: false });
        return false;
      }
    },

    logout: async () => {
      try {
        await secureFetch(`${API_BASE}/auth/logout`, {
          method: 'POST'
        });
      } catch (err) {
        console.warn('Logout call failed. Cleaning up client session locally.');
      }

      const socket = useSocketStore.getState().socket;
      if (socket) {
        socket.disconnect();
      }

      useAuthStore.setState({ user: null, token: null });
      useWorkspaceStore.setState({ workspaces: [], activeWorkspace: null });
      useChatStore.setState({
        conversations: [],
        activeConversation: null,
        messages: [],
        savedResponses: [],
        presence: []
      });
      useSocketStore.setState({ socket: null, socketConnected: false });
    },

    clearAuthError: () => useAuthStore.setState({ authError: null }),

    setHighlightMessageId: (id) => useChatStore.getState().setHighlightMessageId(id),

    // ── Password recovery actions ────────────────────────────────────
    requestPasswordReset: async (email) => {
      try {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
          credentials: 'include',
        });
        const data = await res.json();
        return { message: data.message || 'Request submitted.', resetUrl: data.resetUrl as string | undefined };
      } catch (err) {
        return { message: 'Network error. Try again.' };
      }
    },

    resetPassword: async (token, password) => {
      try {
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok) {
          return { success: true, message: data.message || 'Password reset successful.' };
        }
        return { success: false, message: data.error || data.message || 'Reset failed.' };
      } catch (err) {
        return { success: false, message: 'Network error. Try again.' };
      }
    },

    setPendingVerification: (email, url) =>
      useAuthStore.setState({ pendingVerificationEmail: email, pendingVerificationUrl: url || null }),
    verifyEmail: async (token) => {
      try {
        // POST, not GET: mail clients and antivirus pre-fetch links, and a
        // mutating GET let them consume the token before the user clicked it.
        const res = await fetch(`${API_BASE}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          credentials: 'include',
        });

        const data = await res.json();
        if (res.ok && data.success) {
          useAuthStore.setState({ pendingVerificationEmail: null, pendingVerificationUrl: null });
          return { success: true, message: data.message || 'Email verified successfully.' };
        }
        return { success: false, message: data.error || 'Verification failed.', code: data.code };
      } catch (err) {
        return { success: false, message: 'Network error. Try again.' };
      }
    },

    resendVerification: async (email) => {
      try {
        const res = await fetch(`${API_BASE}/auth/resend-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok) {
          if (data.verificationUrl) {
            useAuthStore.setState({ pendingVerificationUrl: data.verificationUrl });
          }
          return {
            success: true,
            message: data.message || 'If the account exists, a new link has been sent.',
            verificationUrl: data.verificationUrl,
            mailFailed: !!data.mailFailed,
          };
        }
        return { success: false, message: data.error || 'Could not send verification email.' };
      } catch (err) {
        return { success: false, message: 'Network error. Try again.' };
      }
    },

    fetchWorkspaces: async (options) => {
      const autoEnter = options?.autoEnter ?? true;
      try {
        const res = await secureFetch(`${API_BASE}/workspaces`);
        if (res.ok) {
          const list: Workspace[] = await res.json();
          useWorkspaceStore.setState({ workspaces: list });

          // The hub is the post-login landing page, so it lists workspaces
          // without entering one. Auto-entering here would drop the user into
          // an arbitrary workspace (and open a realtime socket for it) the
          // moment they signed in, which is exactly what the hub prevents.
          if (autoEnter && list.length > 0 && !useWorkspaceStore.getState().activeWorkspace) {
            get().setActiveWorkspace(list[0]);
          }
        }
      } catch (err) {
        console.error('Workspaces retrieval error:', err);
      }
    },

    createWorkspace: async (name, description) => {
      try {
        const res = await secureFetch(`${API_BASE}/workspaces`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, description })
        });
        if (res.ok) {
          const ws: Workspace = await res.json();
          useWorkspaceStore.setState({
            workspaces: [...useWorkspaceStore.getState().workspaces, ws]
          });
          get().setActiveWorkspace(ws);
          return ws;
        }
      } catch (err) {
        console.error('Workspace creation error:', err);
      }
      return null;
    },

    deleteWorkspace: async (id) => {
      try {
        const res = await secureFetch(`${API_BASE}/workspaces/${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          const spaces = useWorkspaceStore.getState().workspaces.filter(w => w.id !== id);
          let nextActive = useWorkspaceStore.getState().activeWorkspace;
          if (nextActive?.id === id) {
            nextActive = spaces.length > 0 ? spaces[0] : null;
          }
          useWorkspaceStore.setState({
            workspaces: spaces,
            activeWorkspace: nextActive
          });

          if (nextActive) {
            get().setActiveWorkspace(nextActive);
          }
        }
      } catch (e) {
        console.error(e);
      }
    },

    setActiveWorkspace: (ws) => {
      useWorkspaceStore.setState({ activeWorkspace: ws });
      useChatStore.setState({ activeConversation: null, messages: [], collaborativePromptText: '' });
      get().fetchConversations(ws.id);
      get().fetchSavedResponses(ws.id);

      const user = useAuthStore.getState().user;
      if (user) {
        setupSocket(user, ws.id);
      }
    },

    fetchConversations: async (workspaceId) => {
      try {
        const res = await secureFetch(`${API_BASE}/conversations?workspaceId=${workspaceId}`);
        if (res.ok) {
          const channels: Conversation[] = await res.json();
          useChatStore.setState({ conversations: channels });
          if (channels.length > 0) {
            get().setActiveConversation(channels[0]);
          }
        }
      } catch (err) {
        console.error('Failed to get channels:', err);
      }
    },

    createConversation: async (title) => {
      const ws = useWorkspaceStore.getState().activeWorkspace;
      if (!ws) return;

      try {
        const res = await secureFetch(`${API_BASE}/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ workspaceId: ws.id, title })
        });
        if (res.ok) {
          const conv: Conversation = await res.json();
          useChatStore.setState({
            conversations: [...useChatStore.getState().conversations, conv]
          });
          get().setActiveConversation(conv);
        }
      } catch (err) {
        console.error(err);
      }
    },

    deleteConversation: async (id) => {
      const activeWs = useWorkspaceStore.getState().activeWorkspace;
      if (!activeWs) return;

      try {
        const res = await secureFetch(`${API_BASE}/conversations/${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          const filtered = useChatStore.getState().conversations.filter(c => c.id !== id);
          let nextActive = useChatStore.getState().activeConversation;
          if (nextActive?.id === id) {
            nextActive = filtered.length > 0 ? filtered[0] : null;
          }
          useChatStore.setState({ conversations: filtered, activeConversation: nextActive, hasMoreMessages: false });

          if (nextActive) {
            get().fetchMessages(nextActive.id);
          } else {
            useChatStore.setState({ messages: [] });
          }
        }
      } catch (e) {
        console.error(e);
      }
    },

    setActiveConversation: (conv) => {
      useChatStore.setState({ activeConversation: conv, messages: [], hasMoreMessages: false, highlightMessageId: null });
      if (conv) {
        get().fetchMessages(conv.id);
      }
    },

    fetchMessages: async (conversationId) => {
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conversationId}`);
        if (res.ok) {
          const data = await res.json();
          useChatStore.setState({
            messages: data.messages ?? [],
            hasMoreMessages: !!data.hasMore,
          });
        }
      } catch (err) {
        console.error('Error fetching chat history:', err);
      }
    },

    loadOlderMessages: async () => {
      const conv = useChatStore.getState().activeConversation;
      const current = useChatStore.getState().messages;
      if (!conv || current.length === 0 || useChatStore.getState().isLoadingOlder) return;

      const oldest = current[0];
      useChatStore.setState({ isLoadingOlder: true });
      try {
        const params = new URLSearchParams({
          before: oldest.createdAt,
          beforeId: oldest.id,
        });
        const res = await secureFetch(`${API_BASE}/messages/${conv.id}?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const older: Message[] = data.messages ?? [];
          useChatStore.setState((state) => ({
            // Prepend the older slice — the API already returns it chronologically
            messages: [...older, ...state.messages],
            hasMoreMessages: !!data.hasMore,
          }));
        }
      } catch (err) {
        console.error('Error loading older messages:', err);
      } finally {
        useChatStore.setState({ isLoadingOlder: false });
      }
    },

    searchHistory: async (conversationId, query) => {
      try {
        const params = new URLSearchParams({ q: query });
        const res = await secureFetch(`${API_BASE}/messages/${conversationId}/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          return (data.results ?? []) as SearchResult[];
        }
      } catch (err) {
        console.error('Error searching history:', err);
      }
      return [];
    },

    jumpToMessage: async (messageId, createdAt) => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv) return;

      // If the message is already loaded, just scroll to it.
      if (useChatStore.getState().messages.some((m) => m.id === messageId)) {
        useChatStore.setState({ highlightMessageId: messageId });
        return;
      }

      // Otherwise page backwards until it appears (bounded — no runaway loops).
      let guard = 0;
      while (
        !useChatStore.getState().messages.some((m) => m.id === messageId) &&
        useChatStore.getState().hasMoreMessages &&
        guard++ < 20
      ) {
        const current = useChatStore.getState().messages;
        const oldest = current[0];
        try {
          const params = new URLSearchParams({ before: oldest.createdAt, beforeId: oldest.id });
          const res = await secureFetch(`${API_BASE}/messages/${conv.id}?${params.toString()}`);
          if (!res.ok) break;
          const data = await res.json();
          const older: Message[] = data.messages ?? [];
          if (older.length === 0) break;
          useChatStore.setState((state) => ({
            messages: [...older, ...state.messages],
            hasMoreMessages: !!data.hasMore,
          }));
        } catch (err) {
          console.error('Error paging to message:', err);
          break;
        }
      }

      useChatStore.setState({ highlightMessageId: messageId });
    },

    submitPrompt: (promptText) => {
      const socket = useSocketStore.getState().socket;
      const ws = useWorkspaceStore.getState().activeWorkspace;
      const conv = useChatStore.getState().activeConversation;
      const user = useAuthStore.getState().user;
      const models = useUIStore.getState().selectedModels;

      if (!socket || !ws || !conv || !user || !promptText.trim() || models.length === 0) {
        return;
      }

      socket.emit('submit-prompt', {
        workspaceId: ws.id,
        conversationId: conv.id,
        promptText,
        selectedModels: models,
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar
      });

      useChatStore.setState({ collaborativePromptText: '' });
      socket.emit('prompt-text-change', {
        workspaceId: ws.id,
        promptText: '',
        userId: user.id,
        userName: user.name
      });
    },

    stopGeneration: (messageId, modelKey) => {
      const socket = useSocketStore.getState().socket;
      if (!socket || !messageId) return;
      socket.emit('stop-generation', { messageId, modelKey });
    },

    fetchSavedResponses: async (workspaceId) => {
      try {
        const res = await secureFetch(`${API_BASE}/saved-responses?workspaceId=${workspaceId}`);
        if (res.ok) {
          const saved: SavedResponse[] = await res.json();
          useChatStore.setState({ savedResponses: saved });
        }
      } catch (e) {
        console.error(e);
      }
    },

    saveResponse: async (prompt, modelName, responseContent, senderName) => {
      const ws = useWorkspaceStore.getState().activeWorkspace;
      if (!ws) return;

      try {
        const res = await secureFetch(`${API_BASE}/saved-responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            workspaceId: ws.id,
            prompt,
            modelName,
            responseContent,
            senderName
          })
        });
        if (res.ok) {
          const saved: SavedResponse = await res.json();
          useChatStore.setState({
            savedResponses: [...useChatStore.getState().savedResponses, saved]
          });
        }
      } catch (e) {
        console.error(e);
      }
    },

    deleteSavedResponse: async (id) => {
      try {
        const res = await secureFetch(`${API_BASE}/saved-responses/${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          useChatStore.setState({
            savedResponses: useChatStore.getState().savedResponses.filter(s => s.id !== id)
          });
        }
      } catch (e) {
        console.error(e);
      }
    },

    sendPromptTextChange: (promptText) => {
      useChatStore.setState({ collaborativePromptText: promptText });
      const socket = useSocketStore.getState().socket;
      const ws = useWorkspaceStore.getState().activeWorkspace;
      const user = useAuthStore.getState().user;

      if (socket && ws && user) {
        socket.emit('prompt-text-change', {
          workspaceId: ws.id,
          promptText,
          userId: user.id,
          userName: user.name
        });
      }
    },

    sendTypingStatus: (isTyping) => {
      const socket = useSocketStore.getState().socket;
      const ws = useWorkspaceStore.getState().activeWorkspace;
      const user = useAuthStore.getState().user;

      if (socket && ws && user) {
        socket.emit(isTyping ? 'user-typing-start' : 'user-typing-stop', {
          workspaceId: ws.id,
          userId: user.id,
          userName: user.name
        });
      }
    },

    setCollaborativePromptText: (text) => useChatStore.setState({ collaborativePromptText: text }),
    toggleModel: (modelKey) => useUIStore.getState().toggleModel(modelKey),
    setSidebarOpen: (isOpen) => useUIStore.setState({ isSidebarOpen: isOpen }),
    setSavedResponsesOpen: (isOpen) => useUIStore.setState({ isSavedResponsesOpen: isOpen }),
    setAdminPanelOpen: (isOpen) => useUIStore.setState({ isAdminPanelOpen: isOpen }),
    setCurrentPath: (path) => useUIStore.setState({ currentPath: path }),
    navigateTo: (path) => useUIStore.getState().navigateTo(path),
    setTheme: (theme) => useUIStore.getState().setTheme(theme),
    toggleTheme: () => useUIStore.getState().toggleTheme(),
  };
});

// Subscriptions to keep useStore state dynamically synchronized for React subscriber components
useAuthStore.subscribe((state) => {
  useStore.setState({
    user: state.user,
    token: state.token,
    isAuthenticating: state.isAuthenticating,
    authError: state.authError,
  });
});

useWorkspaceStore.subscribe((state) => {
  useStore.setState({
    workspaces: state.workspaces,
    activeWorkspace: state.activeWorkspace,
  });
});

useChatStore.subscribe((state) => {
  useStore.setState({
    conversations: state.conversations,
    activeConversation: state.activeConversation,
    messages: state.messages,
    hasMoreMessages: state.hasMoreMessages,
    isLoadingOlder: state.isLoadingOlder,
    highlightMessageId: state.highlightMessageId,
    savedResponses: state.savedResponses,
    presence: state.presence,
    collaborativePromptText: state.collaborativePromptText,
    whoIsEditing: state.whoIsEditing,
  });
});

useUIStore.subscribe((state) => {
  useStore.setState({
    selectedModels: state.selectedModels,
    isSidebarOpen: state.isSidebarOpen,
    isSavedResponsesOpen: state.isSavedResponsesOpen,
    isAdminPanelOpen: state.isAdminPanelOpen,
    currentPath: state.currentPath,
    theme: state.theme,
  });
});

useSocketStore.subscribe((state) => {
  useStore.setState({
    socketConnected: state.socketConnected,
    socket: state.socket,
  });
});

export default useStore;

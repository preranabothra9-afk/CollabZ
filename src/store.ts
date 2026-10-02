import { create } from 'zustand';
import { io } from 'socket.io-client';
import { User, Workspace, Conversation, Message, SavedResponse, Claim, ClaimRelation, DiscussionComment, ContradictionVote, ContradictionVoteChoice, ContradictionDiscussion } from './types';

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
  /** Durable claims extracted from the active room's AI responses. */
  claims: Claim[];
  /** Contradiction-graph edges between the active room's claims. */
  relations: ClaimRelation[];
  /** Human discussions for the room's contradictions, keyed by relation id. */
  discussions: Record<string, ContradictionDiscussion>;
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
  /** Loads the durable claims extracted from a room's AI responses. */
  fetchClaims: (conversationId: string) => Promise<void>;
  /** Loads the contradiction-graph edges between a room's claims. */
  fetchRelations: (conversationId: string) => Promise<void>;
  /** Loads the human discussion (comments + poll votes) for one contradiction. */
  fetchDiscussion: (relationId: string) => Promise<void>;
  /** Adds a comment or reply to a contradiction's thread. */
  addContradictionComment: (relationId: string, text: string, parentId?: string | null) => Promise<void>;
  /** Deletes a comment from a contradiction's thread. */
  deleteContradictionComment: (relationId: string, commentId: string) => Promise<void>;
  /** Casts or changes a user's poll vote on a contradiction. */
  castContradictionVote: (relationId: string, choice: ContradictionVoteChoice) => Promise<void>;
  /**
   * Closes a contradiction as resolved or dismissed, with a reason. Resolves to
   * null on success, or the reason it was refused (authorisation, validation,
   * server error) so the UI can show the member exactly what happened.
   */
  resolveContradiction: (relationId: string, status: 'resolved' | 'evidence-needed' | 'dismissed', resolution: string) => Promise<string | null>;
  /** Deletes one claim from the current room. */
  deleteClaim: (claimId: string) => Promise<void>;
  /** Deletes every claim in the current room. */
  clearClaims: () => Promise<void>;
  /** Removes one prompt and its response(s) from the current room. */
  deleteMessage: (messageId: string) => Promise<void>;
  /** Clears every prompt and response in the current room, keeping the room. */
  clearChat: () => Promise<void>;
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
      // A handshake that initially failed has now recovered — give the
      // reconnect budget back for the next transient blip.
      authRetries = 0;
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

    // A rejected handshake is the middleware refusing the socket. socket.io
    // does NOT retry middleware rejections on its own (verified: one attempt,
    // then dead), so without this handler the room would silently go quiet
    // whenever a short-lived access token expired mid-session — or whenever a
    // transient backend blip (e.g. a DNS hiccup reaching Atlas) made the
    // handshake's user lookup fail. Rotate the token and reconnect.
    let authRetries = 0;
    const MAX_AUTH_RETRIES = 5;
    socket.on('connect_error', async (err: any) => {
      console.warn('Socket handshake refused, rotating session token:', err?.message);
      if (authRetries >= MAX_AUTH_RETRIES) {
        console.warn('Socket reconnect budget exhausted — a page refresh will resume real-time.');
        return;
      }
      authRetries++;
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!refreshRes.ok) {
          // No usable refresh cookie: nothing to reconnect with. The header
          // already shows "Off", and the next API call routes to login.
          console.warn('Socket reconnect aborted: session cannot be refreshed.');
          return;
        }
        const data = await refreshRes.json();
        useAuthStore.setState({ user: data.user, token: data.token, authError: null });
        // Re-arm the handshake with the rotated token, then retry with a
        // modest backoff so a sustained backend outage can't hammer the server.
        socket.auth = { token: data.token };
        setTimeout(() => socket.connect(), Math.min(1000 * authRetries, 5000));
      } catch (refreshErr) {
        console.error('Socket reconnect token rotation failed:', refreshErr);
      }
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
            // The user stopped this card; don't let a late status event flip
            // it back to streaming.
            if (m.modelResponses[data.modelKey].status === 'stopped') return m;
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
            // Tokens in flight when the user pressed Stop must not keep
            // appending to a card already marked stopped.
            if (currentResponse.status === 'stopped') return m;
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

    // A finished AI response contributed new durable claims to the room.
    // Prepend them (newest first) so the claims panel stays ordered without a
    // full reload, and only for the room the user is currently viewing.
    socket.on('claims-created', (data: { messageId: string; modelKey: string; claims: Claim[] }) => {
      const activeConv = useChatStore.getState().activeConversation;
      if (!data?.claims || data.claims.length === 0) return;
      if (data.claims[0].conversationId !== activeConv?.id) return;
      useChatStore.setState((state) => ({ claims: [...data.claims, ...state.claims] }));
    });

    // Another member deleted one claim; drop it if we're viewing that room.
    socket.on('claim-deleted', (data: { conversationId: string; claimId: string }) => {
      const activeConv = useChatStore.getState().activeConversation;
      if (!data?.claimId || data.conversationId !== activeConv?.id) return;
      useChatStore.setState((state) => ({
        claims: state.claims.filter((c) => c.id !== data.claimId),
        // The cascade removes every edge that touched the deleted claim.
        relations: state.relations.filter((r) => r.claimAId !== data.claimId && r.claimBId !== data.claimId)
      }));
    });

    // Another member cleared the room's claims.
    socket.on('claims-cleared', (data: { conversationId: string }) => {
      const activeConv = useChatStore.getState().activeConversation;
      if (data.conversationId !== activeConv?.id) return;
      useChatStore.setState({ claims: [], relations: [] });
    });

    // Another member removed a prompt and its responses. The claims that
    // response produced — and any contradiction it was part of — go with it.
    socket.on('message-deleted', (data: { conversationId: string; messageId: string; claimIds?: string[] }) => {
      const activeConv = useChatStore.getState().activeConversation;
      if (!data?.messageId || data.conversationId !== activeConv?.id) return;
      const removed = new Set(data.claimIds ?? []);
      useChatStore.setState((state) => ({
        messages: state.messages.filter((m) => m.id !== data.messageId),
        claims: state.claims.filter((c) => c.messageId !== data.messageId),
        relations: state.relations.filter((r) => !removed.has(r.claimAId) && !removed.has(r.claimBId)),
      }));
    });

    // Another member cleared the whole room's chat; the room's memory goes too.
    socket.on('messages-cleared', (data: { conversationId: string }) => {
      const activeConv = useChatStore.getState().activeConversation;
      if (data.conversationId !== activeConv?.id) return;
      useChatStore.setState({ messages: [], claims: [], relations: [], discussions: {} });
    });

    // The contradiction detector found a conflict (or other relationship) between
    // two of the room's claims. Prepend newest-first like the claims list. Only
    // CONTRADICT edges are broadcast, so anything arriving here is a conflict.
    socket.on('contradiction-detected', (data: { conversationId: string; relations: ClaimRelation[] }) => {
      const activeConv = useChatStore.getState().activeConversation;
      if (!data?.relations || data.relations.length === 0) return;
      if (data.conversationId !== activeConv?.id) return;
      useChatStore.setState((state) => {
        const seen = new Set(state.relations.map((r) => r.id));
        const fresh = data.relations.filter((r) => !seen.has(r.id));
        return { relations: [...fresh, ...state.relations] };
      });
    });

    // ── Contradiction discussion (human layer) ───────────────────────────
    // These keep the thread, the poll, and the closed state live for everyone
    // in the room. Each is ignored unless it belongs to the room the user is
    // currently viewing, so a busy workspace never leaks other rooms' threads.

    socket.on('contradiction-comment-added', (data: { conversationId: string; relationId: string; comment: DiscussionComment }) => {
      const activeConv = useChatStore.getState().activeConversation;
      if (!data?.comment || data.conversationId !== activeConv?.id) return;
      useChatStore.setState((state) => {
        const existing = state.discussions[data.relationId];
        // If the discussion isn't open locally yet there is nothing to add to;
        // it loads in full when the user opens the thread.
        if (!existing) return {};
        // The author's own REST response already added this comment; the echo
        // must not double it.
        if (existing.comments.some((c) => c.id === data.comment.id)) return {};
        return {
          discussions: {
            ...state.discussions,
            [data.relationId]: { ...existing, comments: [...existing.comments, data.comment] }
          }
        };
      });
    });

    socket.on('contradiction-comment-deleted', (data: { conversationId: string; relationId: string; commentId: string }) => {
      const activeConv = useChatStore.getState().activeConversation;
      if (!data?.commentId || data.conversationId !== activeConv?.id) return;
      useChatStore.setState((state) => {
        const existing = state.discussions[data.relationId];
        if (!existing) return {};
        return {
          discussions: {
            ...state.discussions,
            [data.relationId]: { ...existing, comments: existing.comments.filter((c) => c.id !== data.commentId) }
          }
        };
      });
    });

    socket.on('contradiction-vote-updated', (data: { conversationId: string; relationId: string; votes: ContradictionVote[] }) => {
      const activeConv = useChatStore.getState().activeConversation;
      if (!data?.votes || data.conversationId !== activeConv?.id) return;
      useChatStore.setState((state) => {
        const existing = state.discussions[data.relationId];
        if (!existing) return {};
        return {
          discussions: {
            ...state.discussions,
            [data.relationId]: { ...existing, votes: data.votes }
          }
        };
      });
    });

    // An authorized human closed the contradiction. The edge itself is the
    // source of truth for the closed state, so this updates the relation, not
    // the discussion.
    socket.on('contradiction-closed', (data: { conversationId: string; relationId: string; relation: ClaimRelation }) => {
      const activeConv = useChatStore.getState().activeConversation;
      if (!data?.relation || data.conversationId !== activeConv?.id) return;
      useChatStore.setState((state) => ({
        relations: state.relations.map((r) => (r.id === data.relationId ? data.relation : r))
      }));
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
    claims: useChatStore.getState().claims,
    relations: useChatStore.getState().relations,
    discussions: useChatStore.getState().discussions,

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
      useChatStore.setState({ activeConversation: conv, messages: [], hasMoreMessages: false, highlightMessageId: null, claims: [], relations: [], discussions: {} });
      if (conv) {
        get().fetchMessages(conv.id);
        get().fetchClaims(conv.id);
        get().fetchRelations(conv.id);
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

    fetchClaims: async (conversationId) => {
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conversationId}/claims`);
        if (res.ok) {
          const data = await res.json();
          useChatStore.setState({ claims: (data.claims ?? []) as Claim[] });
        }
      } catch (err) {
        console.error('Error fetching room claims:', err);
      }
    },

    fetchRelations: async (conversationId) => {
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conversationId}/relations`);
        if (res.ok) {
          const data = await res.json();
          useChatStore.setState({ relations: (data.relations ?? []) as ClaimRelation[] });
        }
      } catch (err) {
        console.error('Error fetching claim relationships:', err);
      }
    },

    fetchDiscussion: async (relationId) => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv || !relationId) return;
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conv.id}/relations/${relationId}/discussion`);
        if (res.ok) {
          const data = await res.json();
          useChatStore.setState((state) => ({
            discussions: {
              ...state.discussions,
              [relationId]: {
                comments: (data.comments ?? []) as DiscussionComment[],
                votes: (data.votes ?? []) as ContradictionVote[],
              }
            }
          }));
        }
      } catch (err) {
        console.error('Error fetching contradiction discussion:', err);
      }
    },

    addContradictionComment: async (relationId, text, parentId) => {
      const conv = useChatStore.getState().activeConversation;
      const trimmed = text.trim();
      if (!conv || !relationId || !trimmed) return;
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conv.id}/relations/${relationId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, parentId: parentId ?? null })
        });
        if (!res.ok) return;
        const comment: DiscussionComment = await res.json();
        useChatStore.setState((state) => {
          const existing = state.discussions[relationId] ?? { comments: [], votes: [] };
          // The socket echo will also deliver this comment; drop it there by id.
          if (existing.comments.some((c) => c.id === comment.id)) return {};
          return {
            discussions: {
              ...state.discussions,
              [relationId]: { ...existing, comments: [...existing.comments, comment] }
            }
          };
        });
      } catch (err) {
        console.error('Error adding contradiction comment:', err);
      }
    },

    deleteContradictionComment: async (relationId, commentId) => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv || !relationId || !commentId) return;
      const before = useChatStore.getState().discussions[relationId];
      // Optimistic removal so the thread reacts instantly to the click.
      useChatStore.setState((state) => {
        const existing = state.discussions[relationId];
        if (!existing) return {};
        return {
          discussions: {
            ...state.discussions,
            [relationId]: { ...existing, comments: existing.comments.filter((c) => c.id !== commentId) }
          }
        };
      });
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conv.id}/relations/${relationId}/comments/${commentId}`, { method: 'DELETE' });
        if (!res.ok) {
          useChatStore.setState((state) => ({ discussions: { ...state.discussions, [relationId]: before } }));
        }
      } catch (err) {
        useChatStore.setState((state) => ({ discussions: { ...state.discussions, [relationId]: before } }));
        console.error('Error deleting contradiction comment:', err);
      }
    },

    castContradictionVote: async (relationId, choice) => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv || !relationId) return;
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conv.id}/relations/${relationId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ choice })
        });
        if (!res.ok) return;
        const data = await res.json();
        // The server is authoritative for the tally; adopt its full vote set.
        const votes = (data.votes ?? []) as ContradictionVote[];
        useChatStore.setState((state) => {
          const existing = state.discussions[relationId] ?? { comments: [], votes: [] };
          return {
            discussions: {
              ...state.discussions,
              [relationId]: { ...existing, votes }
            }
          };
        });
      } catch (err) {
        console.error('Error casting contradiction vote:', err);
      }
    },

    resolveContradiction: async (relationId, status, resolution) => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv || !relationId) return 'This room is no longer active.';
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conv.id}/relations/${relationId}/${status}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution })
        });
        if (!res.ok) {
          // Surface the server's reason (403 owner-only, 404 gone, 400 reason
          // required) instead of failing silently.
          let reason = `The server refused to close the contradiction (HTTP ${res.status}).`;
          try {
            const data = await res.json();
            if (data?.error) reason = data.error;
          } catch { /* keep the generic reason */ }
          return reason;
        }
        const data = await res.json();
        const updated = data.relation as ClaimRelation | undefined;
        if (updated) {
          useChatStore.setState((state) => ({
            relations: state.relations.map((r) => (r.id === relationId ? updated : r))
          }));
        }
        return null;
      } catch (err) {
        console.error('Error closing contradiction:', err);
        return 'Network error while closing the contradiction. Please try again.';
      }
    },

    deleteClaim: async (claimId) => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv || !claimId) return;
      // Optimistic removal so the panel reacts instantly; the REST call is
      // authoritative and a failure restores the claim.
      const before = useChatStore.getState().claims;
      const beforeRelations = useChatStore.getState().relations;
      useChatStore.setState({
        claims: before.filter((c) => c.id !== claimId),
        // The server cascades edge deletion; mirror it locally so no orphan
        // contradiction outlives the claim it referenced.
        relations: beforeRelations.filter((r) => r.claimAId !== claimId && r.claimBId !== claimId)
      });
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conv.id}/claims/${claimId}`, { method: 'DELETE' });
        if (!res.ok) useChatStore.setState({ claims: before, relations: beforeRelations });
        else get().socket?.emit('claim-deleted', { conversationId: conv.id, claimId });
      } catch (err) {
        useChatStore.setState({ claims: before, relations: beforeRelations });
        console.error('Error deleting claim:', err);
      }
    },

    clearClaims: async () => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv) return;
      const before = useChatStore.getState().claims;
      const beforeRelations = useChatStore.getState().relations;
      useChatStore.setState({ claims: [], relations: [] });
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conv.id}/claims`, { method: 'DELETE' });
        if (!res.ok) useChatStore.setState({ claims: before, relations: beforeRelations });
        else get().socket?.emit('claims-cleared', { conversationId: conv.id });
      } catch (err) {
        useChatStore.setState({ claims: before, relations: beforeRelations });
        console.error('Error clearing room claims:', err);
      }
    },

    deleteMessage: async (messageId) => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv || !messageId) return;
      const before = {
        messages: useChatStore.getState().messages,
        claims: useChatStore.getState().claims,
        relations: useChatStore.getState().relations,
      };
      const removedClaims = before.claims.filter((c) => c.messageId === messageId).map((c) => c.id);
      // Optimistic: drop the row and the room memory derived from it. The REST
      // call is authoritative and restores everything if it refuses.
      useChatStore.setState((state) => ({
        messages: state.messages.filter((m) => m.id !== messageId),
        claims: state.claims.filter((c) => c.messageId !== messageId),
        relations: state.relations.filter((r) => !removedClaims.includes(r.claimAId) && !removedClaims.includes(r.claimBId)),
      }));
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conv.id}/${messageId}`, { method: 'DELETE' });
        if (!res.ok) {
          useChatStore.setState(before);
        } else {
          get().socket?.emit('message-deleted', { conversationId: conv.id, messageId, claimIds: removedClaims });
        }
      } catch (err) {
        useChatStore.setState(before);
        console.error('Error deleting message:', err);
      }
    },

    clearChat: async () => {
      const conv = useChatStore.getState().activeConversation;
      if (!conv) return;
      const before = {
        messages: useChatStore.getState().messages,
        claims: useChatStore.getState().claims,
        relations: useChatStore.getState().relations,
        discussions: useChatStore.getState().discussions,
      };
      // The room's memory is derived from its messages, so clearing the chat
      // clears the claims and contradictions with it.
      useChatStore.setState({ messages: [], claims: [], relations: [], discussions: {} });
      try {
        const res = await secureFetch(`${API_BASE}/messages/${conv.id}`, { method: 'DELETE' });
        if (!res.ok) {
          useChatStore.setState(before);
        } else {
          get().socket?.emit('messages-cleared', { conversationId: conv.id });
        }
      } catch (err) {
        useChatStore.setState(before);
        console.error('Error clearing room chat:', err);
      }
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

      // Flip the card to "stopped" immediately. Waiting for the server
      // round-trip is what made Stop feel unresponsive — the abort has to
      // propagate to the provider before the UI acknowledges the click.
      // The server's model-stream-stopped event confirms this shortly after;
      // a race that completes the model first overwrites it with 'completed'.
      const markStopped = (m: Message): Message => {
        if (m.id !== messageId) return m;
        const responses = { ...m.modelResponses };
        const keys = modelKey ? [modelKey] : Object.keys(responses);
        for (const k of keys) {
          const r = responses[k];
          if (r && (r.status === 'streaming' || r.status === 'pending')) {
            responses[k] = { ...r, status: 'stopped' };
          }
        }
        return { ...m, modelResponses: responses };
      };

      useChatStore.setState((state) => ({
        messages: state.messages.map(markStopped),
      }));

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
    claims: state.claims,
    relations: state.relations,
    discussions: state.discussions,
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

import { create } from 'zustand';
import { Conversation, Message, SavedResponse, PresenceUser, Claim, ClaimRelation, ContradictionDiscussion } from '../types';

export interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  savedResponses: SavedResponse[];
  presence: PresenceUser[];
  collaborativePromptText: string;
  whoIsEditing: string | null;
  hasMoreMessages: boolean;
  isLoadingOlder: boolean;
  highlightMessageId: string | null;
  /** Durable claims extracted from this room's AI responses. */
  claims: Claim[];
  /** Contradiction-graph edges between this room's claims. */
  relations: ClaimRelation[];
  /** Human discussions for the room's contradictions, keyed by relation id. */
  discussions: Record<string, ContradictionDiscussion>;

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conv: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  setSavedResponses: (savedResponses: SavedResponse[]) => void;
  setPresence: (presence: PresenceUser[]) => void;
  setCollaborativePromptText: (text: string) => void;
  setWhoIsEditing: (who: string | null) => void;
  setHasMoreMessages: (hasMore: boolean) => void;
  setIsLoadingOlder: (loading: boolean) => void;
  setHighlightMessageId: (id: string | null) => void;
  setClaims: (claims: Claim[]) => void;
  setRelations: (relations: ClaimRelation[]) => void;
  setDiscussions: (discussions: Record<string, ContradictionDiscussion>) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  savedResponses: [],
  presence: [],
  collaborativePromptText: '',
  whoIsEditing: null,
  hasMoreMessages: false,
  isLoadingOlder: false,
  highlightMessageId: null,
  claims: [],
  relations: [],
  discussions: {},

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (activeConversation) => set({ activeConversation, messages: [], hasMoreMessages: false }),
  setMessages: (messages) => set({ messages }),
  setSavedResponses: (savedResponses) => set({ savedResponses }),
  setPresence: (presence) => set({ presence }),
  setCollaborativePromptText: (collaborativePromptText) => set({ collaborativePromptText }),
  setWhoIsEditing: (whoIsEditing) => set({ whoIsEditing }),
  setHasMoreMessages: (hasMoreMessages) => set({ hasMoreMessages }),
  setIsLoadingOlder: (isLoadingOlder) => set({ isLoadingOlder }),
  setHighlightMessageId: (highlightMessageId) => set({ highlightMessageId }),
  setClaims: (claims) => set({ claims }),
  setRelations: (relations) => set({ relations }),
  setDiscussions: (discussions) => set({ discussions }),
}));

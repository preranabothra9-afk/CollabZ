import { create } from 'zustand';
import { Conversation, Message, SavedResponse, PresenceUser } from '../types';

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
}));

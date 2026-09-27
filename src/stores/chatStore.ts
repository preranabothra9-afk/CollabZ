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

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conv: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  setSavedResponses: (savedResponses: SavedResponse[]) => void;
  setPresence: (presence: PresenceUser[]) => void;
  setCollaborativePromptText: (text: string) => void;
  setWhoIsEditing: (who: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  savedResponses: [],
  presence: [],
  collaborativePromptText: '',
  whoIsEditing: null,

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (activeConversation) => set({ activeConversation, messages: [] }),
  setMessages: (messages) => set({ messages }),
  setSavedResponses: (savedResponses) => set({ savedResponses }),
  setPresence: (presence) => set({ presence }),
  setCollaborativePromptText: (collaborativePromptText) => set({ collaborativePromptText }),
  setWhoIsEditing: (whoIsEditing) => set({ whoIsEditing })
}));

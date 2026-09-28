export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string; // URL or letter code
  role: 'user' | 'admin';
  createdAt: string;
  blocked?: boolean;
  refreshToken?: string | null;
  lastActiveAt?: string;
  isVerified?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  title: string;
  createdBy: string;
  createdAt: string;
}

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64
  };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  promptText: string;
  modelResponses: {
    [modelKey: string]: {
      modelName: string;
      content: string;
      status: 'pending' | 'streaming' | 'completed' | 'stopped' | 'failed';
      durationMs?: number;
      error?: string;
    };
  };
  createdAt: string;
}

export interface SavedResponse {
  id: string;
  workspaceId: string;
  prompt: string;
  modelName: string;
  responseContent: string;
  savedBy: string;
  senderName: string;
  createdAt: string;
}

export interface PresenceUser {
  userId: string;
  userName: string;
  avatar: string;
  activity?: string; // e.g. "typing...", "editing prompt..."
  lastActive: string;
}

export interface BroadcastPromptUpdate {
  workspaceId: string;
  promptText: string;
  updatedBy: string;
  updatedByName: string;
}

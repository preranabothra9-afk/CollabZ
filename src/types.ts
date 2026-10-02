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

/**
 * A durable, quotable statement extracted from an AI response. Claims give the
 * room a persistent memory the next prompt can be grounded in, so models answer
 * with the ongoing discussion in mind instead of treating each prompt in a vacuum.
 */
export interface Claim {
  id: string;
  /** Room the claim belongs to. */
  conversationId: string;
  /** Message the claim was extracted from. */
  messageId: string;
  /** Registry key of the model that produced the source response. */
  modelKey: string;
  /** Display name of the model that produced the source response. */
  modelName: string;
  /** The claim sentence itself. */
  text: string;
  createdAt: string;
}

/**
 * How two claims in the same room relate, as judged by a detector model.
 * The detector classifies the relationship only — it never decides which
 * claim is true.
 */
export type ClaimRelationship = 'SUPPORT' | 'CONTRADICT' | 'RELATED' | 'UNCERTAIN';

/**
 * One edge in a room's contradiction graph, linking two claims. Both claim
 * texts are stored on the edge so the pair can be shown without a second
 * lookup, even after one side is deleted elsewhere. The pair is stored in a
 * canonical (sorted) order so the same two claims can only ever form one edge,
 * whichever direction it was detected from.
 */
export interface ClaimRelation {
  id: string;
  /** Room the relationship belongs to. */
  conversationId: string;
  /** First claim of the canonically-sorted pair. */
  claimAId: string;
  /** Second claim of the canonically-sorted pair. */
  claimBId: string;
  /** Text of the first claim, denormalised for display. */
  claimAText: string;
  /** Text of the second claim, denormalised for display. */
  claimBText: string;
  /** Model that produced the first claim. */
  claimAModelName: string;
  /** Model that produced the second claim. */
  claimBModelName: string;
  /** The detector's verdict on the pair. */
  relationship: ClaimRelationship;
  /** Detector's confidence in the verdict, 0 to 1. */
  confidence: number;
  /** One short sentence describing how the two claims relate. */
  explanation: string;
  /**
   * Lifecycle of the edge. `detected` is the only value the detector ever
   * writes. `resolved` and `dismissed` are recorded exclusively by an
   * authorized human closing the discussion — never by the detector, never
   * from the poll tally, and never from the confidence score.
   */
  // 'evidence-needed' is the room declining to pick a side: the poll's
  // "Neither / need more evidence" outcome. It is a closed state (the
  // contradiction no longer needs a human decision), shown in yellow.
  status: 'detected' | 'resolved' | 'evidence-needed' | 'dismissed';
  /** The reason an authorized human recorded when closing the contradiction. */
  resolution?: string | null;
  /** Id of the human who closed the contradiction. */
  resolvedBy?: string | null;
  /** Name of the human who closed the contradiction. */
  resolvedByName?: string | null;
  /** When the contradiction was closed. */
  resolvedAt?: string | null;
  createdAt: string;
}

/**
 * A choice in a contradiction's poll. The poll is advisory signal for the
 * people in the room — its tallies never resolve the contradiction.
 */
export type ContradictionVoteChoice = 'CLAIM_A' | 'CLAIM_B' | 'NEITHER';

/**
 * One user's vote in a contradiction's poll. The (relationId, userId) pair is
 * unique, so voting again changes the choice rather than adding a second vote.
 */
export interface ContradictionVote {
  id: string;
  /** The contradiction edge the vote belongs to. */
  relationId: string;
  conversationId: string;
  userId: string;
  userName: string;
  choice: ContradictionVoteChoice;
  createdAt: string;
}

/**
 * A comment or reply in a contradiction's discussion thread. `parentId` is
 * null for a top-level comment and points at the comment being answered for a
 * reply.
 */
export interface DiscussionComment {
  id: string;
  relationId: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  parentId?: string | null;
  createdAt: string;
}

/** A contradiction's human discussion: the comment thread plus the room poll. */
export interface ContradictionDiscussion {
  comments: DiscussionComment[];
  votes: ContradictionVote[];
}

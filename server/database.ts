import mongoose, { Schema } from 'mongoose';
import fs from 'fs';
import path from 'path';
import { User, Workspace, Conversation, Message, SavedResponse, Claim, ClaimRelation, DiscussionComment, ContradictionVote, ContradictionDiscussion } from '../src/types';
import { generateUUID } from './auth';

// Connection function for live remote environment deployment
let connectPromise: Promise<void> | null = null;

export function connectDB(): Promise<void> {
  // Memoize so concurrent callers (module import + server bootstrap) await one socket
  if (!connectPromise) {
    connectPromise = establishConnection().catch((err) => {
      connectPromise = null; // allow a retry on the next request
      throw err;
    });
  }
  return connectPromise;
}

async function establishConnection(): Promise<void> {
  let uri = process.env.MONGODB_URI;
  
  if (!uri) {
    // Attempt to load from .env.example configuration dynamically as a safe fallback
    try {
      const p = path.resolve(process.cwd(), '.env.example');
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        const match = content.match(/MONGODB_URI=(.*)/);
        if (match && match[1]) {
          uri = match[1].trim().replace(/['"]/g, '');
          process.env.MONGODB_URI = uri;
          console.log('RECOVERED MONGODB_URI: Successfully dynamically resolved URI from .env.example config:', uri);
        }
      }
    } catch (e) {
      console.warn('Failed to parse .env.example as runtime fallback:', e);
    }
  }

  if (!uri) {
    console.error('CRITICAL: MONGODB_URI environment variable is not defined!');
    throw new Error('MONGODB_URI environment variable is required to start database connections.');
  }

  if (mongoose.connection.readyState >= 1) {
    return;
  }

  console.log('Connecting to cloud MongoDB database...');
  // Connect with a 10-second timeout to allow secure Atlas connection handshakes
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  
  console.log('Successfully established MERN cluster connection with MongoDB Atlas.');
  await seedDefaultMongoData();
}

// Automatically trigger database connection startup
connectDB().catch(err => {
  console.error('Failed to pre-connect during module import phase. Active connection will retry dynamically on incoming server requests.');
});

// --- MONGOOSE SCHEMAS & ENTERPRISE INDEXES ---

// User Schema
const UserSchema = new Schema({
  _id: { type: String, default: generateUUID },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  avatar: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user', required: true, index: true },
  blocked: { type: Boolean, default: false, required: true },
  isBlocked: { type: Boolean, default: false, required: true, index: true },
  refreshToken: { type: String, default: null, index: true },
  resetToken: { type: String, default: null, index: true },
  resetTokenExpiresAt: { type: Number, default: null },
  isVerified: { type: Boolean, default: false },
  verifyToken: { type: String, default: null, index: true },
  verifyTokenExpiresAt: { type: Number, default: null },
  lastActiveAt: { type: String, default: () => new Date().toISOString() },
  lastLogin: { type: String, default: () => new Date().toISOString() },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Workspace Schema
const WorkspaceSchema = new Schema({
  _id: { type: String, default: generateUUID },
  name: { type: String, required: true },
  description: { type: String, default: 'Collaborative AI workspace sandbox.' },
  ownerId: { type: String, required: true, index: true },
  memberIds: { type: [String], default: [], index: true },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Channel/Conversation Schema
const ConversationSchema = new Schema({
  _id: { type: String, default: generateUUID },
  workspaceId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  createdBy: { type: String, required: true, index: true },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Message Schema
const MessageSchema = new Schema({
  _id: { type: String, default: generateUUID },
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true, index: true },
  senderName: { type: String, required: true },
  senderAvatar: { type: String, required: true },
  promptText: { type: String, required: true },
  modelResponses: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: String, default: () => new Date().toISOString(), index: true }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// SavedResponse Schema
const SavedResponseSchema = new Schema({
  _id: { type: String, default: generateUUID },
  workspaceId: { type: String, required: true, index: true },
  prompt: { type: String, required: true },
  modelName: { type: String, required: true },
  responseContent: { type: String, required: true },
  savedBy: { type: String, required: true, index: true },
  senderName: { type: String, required: true },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Claim Schema
// A durable, quotable statement extracted from an AI response. Claims give a
// room a persistent memory that later prompts are grounded in, so models answer
// with the ongoing discussion in mind instead of treating each prompt in a
// vacuum.
const ClaimSchema = new Schema({
  _id: { type: String, default: generateUUID },
  conversationId: { type: String, required: true, index: true },
  messageId: { type: String, required: true, index: true },
  modelKey: { type: String, required: true },
  modelName: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: String, default: () => new Date().toISOString(), index: true }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// An edge in the room's contradiction graph, linking two claims. The pair is
// stored in canonical (sorted) order with a unique index so the same two claims
// can only ever form one edge, whichever direction the detection came from.
const ClaimRelationSchema = new Schema({
  _id: { type: String, default: generateUUID },
  conversationId: { type: String, required: true, index: true },
  claimAId: { type: String, required: true },
  claimBId: { type: String, required: true },
  claimAText: { type: String, required: true },
  claimBText: { type: String, required: true },
  claimAModelName: { type: String, required: true },
  claimBModelName: { type: String, required: true },
  relationship: { type: String, required: true, enum: ['SUPPORT', 'CONTRADICT', 'RELATED', 'UNCERTAIN'], index: true },
  confidence: { type: Number, required: true, min: 0, max: 1, default: 0.5 },
  explanation: { type: String, required: true },
  // 'detected' is the only value the detector writes. 'resolved',
  // 'evidence-needed' and 'dismissed' are set exclusively by an authorized
  // human closing the contradiction's discussion — never by the poll tally or
  // the confidence. 'evidence-needed' is the room declining to pick a side.
  status: { type: String, required: true, default: 'detected', enum: ['detected', 'resolved', 'evidence-needed', 'dismissed'], index: true },
  /** The reason an authorized human recorded when closing the contradiction. */
  resolution: { type: String, default: null },
  resolvedBy: { type: String, default: null },
  resolvedByName: { type: String, default: null },
  resolvedAt: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString(), index: true }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Enforces one relationship per claim pair regardless of detection direction.
ClaimRelationSchema.index({ claimAId: 1, claimBId: 1 }, { unique: true });

// A comment or reply in a contradiction's human discussion thread. Top-level
// comments carry no parentId; replies point at the comment they answer, so a
// thread is one level deep — enough to answer a point without nesting noise.
const DiscussionCommentSchema = new Schema({
  _id: { type: String, default: generateUUID },
  relationId: { type: String, required: true, index: true },
  conversationId: { type: String, required: true, index: true },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  authorAvatar: { type: String, default: '' },
  text: { type: String, required: true },
  parentId: { type: String, default: null, index: true },
  createdAt: { type: String, default: () => new Date().toISOString(), index: true }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// One user's vote in a contradiction poll. The unique (relationId, userId)
// index is what makes the poll "one vote per user" — voting again updates the
// choice instead of inserting a second row.
const ContradictionVoteSchema = new Schema({
  _id: { type: String, default: generateUUID },
  relationId: { type: String, required: true, index: true },
  conversationId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  choice: { type: String, required: true, enum: ['CLAIM_A', 'CLAIM_B', 'NEITHER'] },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Enforces one vote per user per contradiction.
ContradictionVoteSchema.index({ relationId: 1, userId: 1 }, { unique: true });

// AuditLog Schema
const AuditLogSchema = new Schema({  _id: { type: String, default: generateUUID },
  userId: { type: String, index: true },
  userName: { type: String },
  userEmail: { type: String, index: true },
  action: { type: String, required: true, index: true }, // e.g., 'REGISTER', 'LOGIN', 'LOGOUT', 'CREATE_WORKSPACE', 'DELETE_WORKSPACE', 'INVITE_COLLABORATOR', 'ROLE_CHANGE', 'BLOCK_USER', 'UNBLOCK_USER', 'DELETE_USER', 'AI_PROMPT_REQUEST', 'FAILED_AUTH'
  details: { type: String, required: true },
  workspaceId: { type: String, index: true },
  ipAddress: { type: String },
  createdAt: { type: String, default: () => new Date().toISOString(), index: true }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual conversions for MERN front-end schema compliance
for (const schema of [UserSchema, WorkspaceSchema, ConversationSchema, MessageSchema, SavedResponseSchema, ClaimSchema, ClaimRelationSchema, DiscussionCommentSchema, ContradictionVoteSchema, AuditLogSchema]) {
  schema.virtual('id').get(function() {
    return this._id;
  });
}

// Export Mongoose Models
export const UserModel = (mongoose.models.User || mongoose.model('User', UserSchema)) as any;
export const WorkspaceModel = (mongoose.models.Workspace || mongoose.model('Workspace', WorkspaceSchema)) as any;
export const ConversationModel = (mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema)) as any;
export const MessageModel = (mongoose.models.Message || mongoose.model('Message', MessageSchema)) as any;
export const SavedResponseModel = (mongoose.models.SavedResponse || mongoose.model('SavedResponse', SavedResponseSchema)) as any;
export const ClaimModel = (mongoose.models.Claim || mongoose.model('Claim', ClaimSchema)) as any;
export const ClaimRelationModel = (mongoose.models.ClaimRelation || mongoose.model('ClaimRelation', ClaimRelationSchema)) as any;
export const DiscussionCommentModel = (mongoose.models.DiscussionComment || mongoose.model('DiscussionComment', DiscussionCommentSchema)) as any;
export const ContradictionVoteModel = (mongoose.models.ContradictionVote || mongoose.model('ContradictionVote', ContradictionVoteSchema)) as any;
export const AuditLogModel = (mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema)) as any;

// Seed standard workspace if DB is blank (for Mongo mode)
async function seedDefaultMongoData() {
  try {
    const wsCount = await WorkspaceModel.countDocuments();
    if (wsCount === 0) {
      console.log('Seeding initial workspace data into MongoDB...');
      const systemUserId = '00000000-0000-0000-0000-000000000000';

      // Seed a default system user if they don't exist
      const systemUserExists = await UserModel.findById(systemUserId);
      if (!systemUserExists) {
        await UserModel.create({
          _id: systemUserId,
          name: 'NovaAI Core',
          email: 'nova-system@mindsync.io',
          password: 'N/A_SYSTEM_USER_NO_PASSWORD',
          avatar: 'SYSTEM',
          role: 'admin'
        });
      }

      await WorkspaceModel.create({
        _id: 'global-workspace-id',
        name: 'General Workspace',
        description: 'Collaborative AI sandbox for brainstorming, multi-model analysis, and real-time team feedback.',
        ownerId: systemUserId,
        memberIds: [systemUserId]
      });

      await ConversationModel.create({
        _id: 'general-channel-id',
        workspaceId: 'global-workspace-id',
        title: '🛰️ Central Brainstorm',
        createdBy: systemUserId
      });

      await MessageModel.create({
        _id: 'welcome-message-id',
        conversationId: 'general-channel-id',
        senderId: systemUserId,
        senderName: 'NovaAI Core',
        senderAvatar: 'SYSTEM',
        promptText: 'Analyze MindSync workspace architecture.',
        modelResponses: {
          'gemini-2.5-flash': {
            modelName: 'Gemini 2.5 Flash',
            content: 'Hello! I am Gemini 2.5 Flash. I am fully integrated into **MindSync** to support streamable team diagnostics, dynamic modeling, and high-fidelity code execution. In this workspace, you can trigger models simultaneously and compare results, observe live presence, edit prompts collaboratively, and save insights instantly.',
            status: 'completed',
            durationMs: 420
          },
          'gpt-oss-120b': {
            modelName: 'GPT-OSS 120B',
            content: 'MindSync operates as a real-time full-stack environment. It enables multi-model cross-examination where multiple collaborators query distinct intelligent agents simultaneously.',
            status: 'completed',
            durationMs: 780
          }
        }
      });

      console.log('Seed data successfully applied to MongoDB.');
    }
  } catch (error) {
    console.error('Error seeding default MongoDB data:', error);
  }
}

// --- SECURE MONGO DRIVER WRAPPER ---
class MongoDatabaseAdapter {
  // --- USER METHODS ---
  async getUsers(): Promise<User[]> {
    const docs = await UserModel.find().lean();
    return docs.map((d: any) => ({ ...d, id: d._id })) as unknown as User[];
  }

  async getUserById(id: string): Promise<User | undefined> {
    const d = await UserModel.findById(id).lean();
    if (!d) return undefined;
    return { ...d, id: d._id } as unknown as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const norm = email.toLowerCase().trim();
    const d = await UserModel.findOne({ email: norm }).lean();
    if (!d) return undefined;
    return { ...d, id: d._id } as unknown as User;
  }

  async createUser(user: User, passwordHash: string): Promise<User> {
    const created = await UserModel.create({
      _id: user.id || generateUUID(),
      name: user.name,
      email: user.email.toLowerCase().trim(),
      password: passwordHash,
      avatar: user.avatar,
      role: user.role || 'user',
      createdAt: user.createdAt || new Date().toISOString()
    });
    return { ...created.toJSON(), id: created._id } as unknown as User;
  }

  async getPasswordHash(userId: string): Promise<string | undefined> {
    const d = await UserModel.findById(userId).select('password').lean();
    return d ? d.password : undefined;
  }

  // --- PASSWORD RESET METHODS ---

  /** Store a hashed reset token + epoch expiry on the user record. */
  async setResetToken(userId: string, tokenHash: string, expiresAt: number): Promise<boolean> {
    const res = await UserModel.findByIdAndUpdate(userId, {
      resetToken: tokenHash,
      resetTokenExpiresAt: expiresAt,
    });
    return !!res;
  }

  /** Look up a user by their stored (hashed) reset token. */
  async getUserByResetToken(tokenHash: string): Promise<any | null> {
    const doc = await UserModel.findOne({ resetToken: tokenHash }).lean();
    return doc || null;
  }

  /** Set a new password hash and invalidate any outstanding reset token. */
  async setUserPassword(userId: string, passwordHash: string): Promise<boolean> {
    const res = await UserModel.findByIdAndUpdate(userId, {
      password: passwordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
    });
    return !!res;
  }

  // --- EMAIL VERIFICATION METHODS ---

  /** Store a hashed verification token + epoch expiry on an unverified user. */
  async setVerifyToken(userId: string, tokenHash: string, expiresAt: number): Promise<boolean> {
    const res = await UserModel.findByIdAndUpdate(userId, {
      verifyToken: tokenHash,
      verifyTokenExpiresAt: expiresAt,
    });
    return !!res;
  }

  /** Look up a user by their stored (hashed) verification token. */
  async getUserByVerifyToken(tokenHash: string): Promise<any | null> {
    const doc = await UserModel.findOne({ verifyToken: tokenHash }).lean();
    return doc || null;
  }

  /**
   * Flip the account to verified.
   *
   * The token hash is intentionally RETAINED rather than nulled. `isVerified`
   * is the real authorisation gate, so keeping the hash costs nothing
   * security-wise, but it lets a re-opened or double-clicked link resolve to
   * "already verified" instead of "invalid", which dead-ends the user after
   * an accidental refresh. The expiry is cleared so the record ages out of
   * relevance, and re-issuing a link overwrites the hash anyway.
   */
  async markEmailVerified(userId: string): Promise<boolean> {
    const res = await UserModel.findByIdAndUpdate(userId, {
      isVerified: true,
      verifyTokenExpiresAt: null,
      updatedAt: new Date().toISOString(),
    });
    return !!res;
  }

  // --- WORKSPACE METHODS ---
  async getWorkspaces(): Promise<Workspace[]> {
    const docs = await WorkspaceModel.find().lean();
    return docs.map((d: any) => ({ ...d, id: d._id })) as unknown as Workspace[];
  }

  async getWorkspaceById(id: string): Promise<Workspace | undefined> {
    const d = await WorkspaceModel.findById(id).lean();
    if (!d) return undefined;
    return { ...d, id: d._id } as unknown as Workspace;
  }

  async createWorkspace(workspace: Workspace): Promise<Workspace> {
    const created = await WorkspaceModel.create({
      _id: workspace.id || generateUUID(),
      name: workspace.name,
      description: workspace.description || 'Collaborative AI workspace sandbox.',
      ownerId: workspace.ownerId,
      memberIds: workspace.memberIds || [workspace.ownerId],
      createdAt: workspace.createdAt || new Date().toISOString()
    });
    return { ...created.toJSON(), id: created._id } as unknown as Workspace;
  }

  async updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace | undefined> {
    const d = await WorkspaceModel.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!d) return undefined;
    return { ...d, id: d._id } as unknown as Workspace;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    const res = await WorkspaceModel.deleteOne({ _id: id });
    if (res.deletedCount === 0) return false;

    // Cascade deletions with clean queries
    const conversations = await ConversationModel.find({ workspaceId: id }).select('_id').lean();
    const conversationIds = conversations.map((c: any) => c._id);
    await ConversationModel.deleteMany({ workspaceId: id });
    await SavedResponseModel.deleteMany({ workspaceId: id });
    await ClaimModel.deleteMany({ conversationId: { $in: conversationIds } });
    await ClaimRelationModel.deleteMany({ conversationId: { $in: conversationIds } });
    // A contradiction's human discussion dies with the room it lived in.
    await DiscussionCommentModel.deleteMany({ conversationId: { $in: conversationIds } });
    await ContradictionVoteModel.deleteMany({ conversationId: { $in: conversationIds } });
    return true;
  }

  // --- CONVERSATION METHODS ---
  async getConversations(workspaceId?: string): Promise<Conversation[]> {
    const filter = workspaceId ? { workspaceId } : {};
    const docs = await ConversationModel.find(filter).lean();
    return docs.map((d: any) => ({ ...d, id: d._id })) as unknown as Conversation[];
  }

  async getConversationById(id: string): Promise<Conversation | undefined> {
    const d = await ConversationModel.findById(id).lean();
    if (!d) return undefined;
    return { ...d, id: d._id } as unknown as Conversation;
  }

  async createConversation(conv: Conversation): Promise<Conversation> {
    const created = await ConversationModel.create({
      _id: conv.id || generateUUID(),
      workspaceId: conv.workspaceId,
      title: conv.title,
      createdBy: conv.createdBy,
      createdAt: conv.createdAt || new Date().toISOString()
    });
    return { ...created.toJSON(), id: created._id } as unknown as Conversation;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const d = await ConversationModel.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!d) return undefined;
    return { ...d, id: d._id } as unknown as Conversation;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const res = await ConversationModel.deleteOne({ _id: id });
    if (res.deletedCount === 0) return false;
    await MessageModel.deleteMany({ conversationId: id });
    await ClaimModel.deleteMany({ conversationId: id });
    await ClaimRelationModel.deleteMany({ conversationId: id });
    // The room's contradiction discussions go with its contradictions.
    await DiscussionCommentModel.deleteMany({ conversationId: id });
    await ContradictionVoteModel.deleteMany({ conversationId: id });
    return true;
  }

  // --- MESSAGE METHODS ---

  /**
   * Load a page of messages, newest-first retrieval, returned in chronological
   * order for display. Cursor-based so the client can page backwards through
   * full history without skip-offset drift.
   *
   * `before`/`beforeId` identify the oldest currently-loaded message; the page
   * returned is everything strictly older than that (createdAt, _id) tuple.
   * Both sort keys are ISO strings / UUIDs, so lexicographic == chronological.
   */
  async getMessages(
    conversationId: string,
    opts: { limit?: number; before?: string; beforeId?: string } = {}
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const query: Record<string, unknown> = { conversationId };

    if (opts.before) {
      if (opts.beforeId) {
        query.$or = [
          { createdAt: { $lt: opts.before } },
          { createdAt: opts.before, _id: { $lt: opts.beforeId } },
        ];
      } else {
        query.createdAt = { $lt: opts.before };
      }
    }

    // Take limit + 1 to peek whether another page exists, then chronological order.
    const docs = await MessageModel.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    // `.lean()` skips the `id` virtual, so map `_id` -> `id` explicitly. The
    // client keys message rows and jump-to-message lookups off `msg.id`; without
    // this every history message arrives with `id === undefined`.
    const page = docs
      .slice(0, limit)
      .reverse()
      .map((d: any) => ({ ...d, id: d._id }));
    return { messages: page as unknown as Message[], hasMore };
  }

  /** Build a short snippet centered on the first match of `q` within `text`. */
  private snippet(text: string, q: string, radius = 70): string {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text.slice(0, radius * 2);
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + q.length + radius);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  /**
   * Case-insensitive regex search across a room's prompts and every model
   * response. Returns compact hits (no full response bodies) plus a snippet
   * and where the match was found.
   *
   * Model keys contain dots (e.g. "gemini-2.5-flash"), so response content
   * can't be reached with dot notation — an aggregation flattens
   * `modelResponses` into an array of contents first.
   */
  async searchMessages(
    conversationId: string,
    query: string,
    limit = 20
  ): Promise<Array<{
    id: string;
    promptText: string;
    createdAt: string;
    senderName: string;
    matchedIn: string;
    snippet: string;
  }>> {
    const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const docs = await MessageModel.aggregate([
      { $match: { conversationId } },
      // Flatten the dynamic-key modelResponses map into a plain content array
      { $addFields: {
          _contents: {
            $map: {
              input: { $objectToArray: { $ifNull: ['$modelResponses', {}] } },
              as: 'entry',
              in: { name: '$$entry.v.modelName', content: '$$entry.v.content' },
            },
          },
        },
      },
      { $match: {
          $or: [
            { promptText: { $regex: esc, $options: 'i' } },
            { '_contents.content': { $regex: esc, $options: 'i' } },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
    ]);

    return docs.map((d: any) => {
      const q = query.toLowerCase();
      const promptHit = d.promptText?.toLowerCase().includes(q);
      let matchedIn = 'Prompt';
      let snippetText = d.promptText || '';

      if (!promptHit && Array.isArray(d._contents)) {
        for (const c of d._contents) {
          if (typeof c?.content === 'string' && c.content.toLowerCase().includes(q)) {
            matchedIn = c.name || 'Response';
            snippetText = c.content;
            break;
          }
        }
      }

      return {
        id: d._id,
        promptText: d.promptText,
        createdAt: d.createdAt,
        senderName: d.senderName,
        matchedIn,
        snippet: this.snippet(snippetText, query),
      };
    });
  }

  async getMessageById(id: string): Promise<Message | undefined> {
    const d = await MessageModel.findById(id).lean();
    if (!d) return undefined;
    return { ...d, id: d._id } as unknown as Message;
  }

  async createMessage(msg: Message): Promise<Message> {
    const created = await MessageModel.create({
      _id: msg.id || generateUUID(),
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderAvatar: msg.senderAvatar,
      promptText: msg.promptText,
      modelResponses: msg.modelResponses || {},
      createdAt: msg.createdAt || new Date().toISOString()
    });
    return { ...created.toJSON(), id: created._id } as unknown as Message;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const d = await MessageModel.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!d) return undefined;
    return { ...d, id: d._id } as unknown as Message;
  }

  // --- CLAIM METHODS ---
  // Claims are the room's persistent memory. See `server/context.ts` for the
  // extraction heuristic and the context preamble that consumes them.

  /**
   * Bulk-inserts claims for one response. De-duplicates on
   * (messageId, modelKey, text) so a retried or re-broadcast extraction can
   * never double-store the same statement.
   */
  async createClaims(claims: Claim[]): Promise<Claim[]> {
    if (!claims || claims.length === 0) return [];
    try {
      const docs = claims.map((c) => ({
        _id: c.id || generateUUID(),
        conversationId: c.conversationId,
        messageId: c.messageId,
        modelKey: c.modelKey,
        modelName: c.modelName,
        text: c.text,
        createdAt: c.createdAt || new Date().toISOString()
      }));
      const created = await ClaimModel.insertMany(docs, { ordered: false });
      return created.map((c: any) => ({ ...c.toJSON(), id: c._id })) as unknown as Claim[];
    } catch (err: any) {
      // `ordered: false` keeps every valid doc even if one is a duplicate-key
      // dupe of an earlier insert; only surface genuine failures.
      if (err?.code === 11000) return [];
      console.error('Failed to store extracted claims:', err?.message || err);
      return [];
    }
  }

  /** Newest-first claims for a room, bounded by `limit`. */
  async getClaims(conversationId: string, limit = 30): Promise<Claim[]> {
    const docs = await ClaimModel.find({ conversationId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean();
    return docs.map((d: any) => ({ ...d, id: d._id })) as unknown as Claim[];
  }

  /** Deletes one claim, scoped to its room so a stale client id can't touch another room. */
  async deleteClaim(conversationId: string, claimId: string): Promise<boolean> {
    const res = await ClaimModel.deleteOne({ _id: claimId, conversationId });
    if (res.deletedCount > 0) {
      await this.deleteClaimRelationsForClaim(claimId);
    }
    return res.deletedCount > 0;
  }

  /** Deletes every claim in a room. */
  async deleteClaimsByConversation(conversationId: string): Promise<number> {
    const res = await ClaimModel.deleteMany({ conversationId });
    await ClaimRelationModel.deleteMany({ conversationId });
    // Clearing the room's memory also clears every contradiction discussion it
    // held — comments and poll votes have no meaning without their edge.
    await DiscussionCommentModel.deleteMany({ conversationId });
    await ContradictionVoteModel.deleteMany({ conversationId });
    return res.deletedCount || 0;
  }

  // --- CLAIM RELATION METHODS (the contradiction graph) ---

  /**
   * Stores one contradiction-graph edge. The claim pair is canonicalised
   * (sorted) before writing and the schema carries a unique index on the pair,
   * so a duplicate detection is a harmless no-op rather than a second edge.
   * Returns null when the pair was already related — callers can treat that as
   * "nothing new to broadcast".
   */
  async createClaimRelation(relation: ClaimRelation): Promise<ClaimRelation | null> {
    const [claimAId, claimBId] = [relation.claimAId, relation.claimBId].sort();
    if (claimAId === claimBId) return null;
    try {
      const created = await ClaimRelationModel.create({
        _id: relation.id || generateUUID(),
        conversationId: relation.conversationId,
        claimAId,
        claimBId,
        claimAText: relation.claimAText,
        claimBText: relation.claimBText,
        claimAModelName: relation.claimAModelName,
        claimBModelName: relation.claimBModelName,
        relationship: relation.relationship,
        confidence: Math.min(Math.max(relation.confidence ?? 0.5, 0), 1),
        explanation: relation.explanation,
        status: relation.status || 'detected',
        createdAt: relation.createdAt || new Date().toISOString()
      });
      return { ...created.toObject(), id: created._id } as unknown as ClaimRelation;
    } catch (err: any) {
      // Duplicate-key means another detection already recorded this pair.
      if (err?.code === 11000) return null;
      console.error('Failed to store claim relation:', err?.message || err);
      return null;
    }
  }

  /** Newest-first relationship edges for a room, bounded by `limit`. */
  async getClaimRelations(conversationId: string, limit = 40): Promise<ClaimRelation[]> {
    const docs = await ClaimRelationModel.find({ conversationId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean();
    return docs.map((d: any) => ({ ...d, id: d._id })) as unknown as ClaimRelation[];
  }

  /** Removes every edge that touches a claim, when that claim is deleted. */
  async deleteClaimRelationsForClaim(claimId: string): Promise<number> {
    const relations = await ClaimRelationModel.find({
      $or: [{ claimAId: claimId }, { claimBId: claimId }]
    }).select('_id').lean();
    const relationIds = relations.map((r: any) => r._id as string);

    // A contradiction's discussion is attached to the edge, not the claims, so
    // it must be torn down with the edge.
    await this.deleteDiscussionForRelations(relationIds);

    const res = await ClaimRelationModel.deleteMany({ _id: { $in: relationIds } });
    return res.deletedCount || 0;
  }

  // --- CONTRADICTION DISCUSSION METHODS ---
  // The human side of the contradiction graph: a comment thread with replies
  // and a room poll. Status transitions live with the relation itself; these
  // methods never touch status, and never derive it from votes or confidence.

  /** Drops every comment and vote attached to the given contradiction edges. */
  async deleteDiscussionForRelations(relationIds: string[]): Promise<void> {
    if (!relationIds || relationIds.length === 0) return;
    await DiscussionCommentModel.deleteMany({ relationId: { $in: relationIds } });
    await ContradictionVoteModel.deleteMany({ relationId: { $in: relationIds } });
  }

  /** One contradiction edge, scoped to its room so a stale id can't read another room. */
  async getClaimRelationById(conversationId: string, relationId: string): Promise<ClaimRelation | undefined> {
    const d = await ClaimRelationModel.findOne({ _id: relationId, conversationId }).lean();
    if (!d) return undefined;
    return { ...d, id: d._id } as unknown as ClaimRelation;
  }

  /** The full discussion for one contradiction: comments (chronological) and poll votes. */
  async getDiscussion(relationId: string): Promise<ContradictionDiscussion> {
    const [commentDocs, voteDocs] = await Promise.all([
      DiscussionCommentModel.find({ relationId }).sort({ createdAt: 1, _id: 1 }).lean(),
      ContradictionVoteModel.find({ relationId }).lean(),
    ]);
    return {
      comments: commentDocs.map((d: any) => ({ ...d, id: d._id })) as unknown as DiscussionComment[],
      votes: voteDocs.map((d: any) => ({ ...d, id: d._id })) as unknown as ContradictionVote[],
    };
  }

  /** Stores one comment or reply. */
  async addComment(comment: DiscussionComment): Promise<DiscussionComment> {
    const created = await DiscussionCommentModel.create({
      _id: comment.id || generateUUID(),
      relationId: comment.relationId,
      conversationId: comment.conversationId,
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorAvatar: comment.authorAvatar || '',
      text: comment.text,
      parentId: comment.parentId || null,
      createdAt: comment.createdAt || new Date().toISOString()
    });
    return { ...created.toObject(), id: created._id } as unknown as DiscussionComment;
  }

  /** Whether a comment exists in this thread — used to validate a reply target. */
  async commentExists(relationId: string, commentId: string): Promise<boolean> {
    const doc = await DiscussionCommentModel.findOne({ _id: commentId, relationId }).select('_id').lean();
    return !!doc;
  }

  /**
   * Deletes one comment. Authors may delete their own; the workspace owner and
   * admins may delete anyone's (moderation). The scoping filters keep a comment
   * from being pulled out of another room's thread.
   */
  async deleteComment(relationId: string, commentId: string, userId: string, moderator: boolean): Promise<boolean> {
    const filter: Record<string, unknown> = { _id: commentId, relationId };
    if (!moderator) filter.authorId = userId;
    const res = await DiscussionCommentModel.deleteOne(filter);
    return res.deletedCount > 0;
  }

  /**
   * Records one user's poll vote, or changes it if they have already voted. The
   * unique (relationId, userId) index is the "one vote per user" guarantee; a
   * race between two first-votes lands on a duplicate-key error, which is
   * handled by falling back to an update of the surviving row.
   */
  async setVote(vote: ContradictionVote): Promise<ContradictionVote> {
    const existing = await ContradictionVoteModel.findOne({
      relationId: vote.relationId, userId: vote.userId
    });
    if (existing) {
      existing.choice = vote.choice;
      existing.userName = vote.userName;
      await existing.save();
      return { ...existing.toObject(), id: existing._id } as unknown as ContradictionVote;
    }

    try {
      const created = await ContradictionVoteModel.create({
        _id: vote.id || generateUUID(),
        relationId: vote.relationId,
        conversationId: vote.conversationId,
        userId: vote.userId,
        userName: vote.userName,
        choice: vote.choice,
        createdAt: vote.createdAt || new Date().toISOString()
      });
      return { ...created.toObject(), id: created._id } as unknown as ContradictionVote;
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
      const again = await ContradictionVoteModel.findOne({
        relationId: vote.relationId, userId: vote.userId
      });
      if (!again) throw err;
      again.choice = vote.choice;
      again.userName = vote.userName;
      await again.save();
      return { ...again.toObject(), id: again._id } as unknown as ContradictionVote;
    }
  }

  /** Every vote cast in a contradiction's poll. */
  async getVotes(relationId: string): Promise<ContradictionVote[]> {
    const docs = await ContradictionVoteModel.find({ relationId }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id })) as unknown as ContradictionVote[];
  }

  /**
   * Closes a contradiction as `resolved` or `dismissed`, recording who closed it
   * and why. This is the ONLY place the closed statuses are written — the poll
   * tally and the detector's confidence are never inputs to it.
   */
  async resolveRelation(
    conversationId: string,
    relationId: string,
    closure: { status: 'resolved' | 'evidence-needed' | 'dismissed'; resolution: string; resolvedBy: string; resolvedByName: string }
  ): Promise<ClaimRelation | undefined> {
    const d = await ClaimRelationModel.findOneAndUpdate(
      { _id: relationId, conversationId },
      {
        status: closure.status,
        resolution: closure.resolution,
        resolvedBy: closure.resolvedBy,
        resolvedByName: closure.resolvedByName,
        resolvedAt: new Date().toISOString()
      },
      { new: true }
    ).lean();
    if (!d) return undefined;
    return { ...d, id: d._id } as unknown as ClaimRelation;
  }

  /**
   * Tears down the room memory attached to a set of claims: every contradiction
   * edge they participate in, and the human discussion on each of those edges.
   * Shared by single-message deletion and whole-room clearing.
   */
  private async cascadeClaims(claimIds: string[]): Promise<void> {
    if (!claimIds || claimIds.length === 0) return;
    const rels = await ClaimRelationModel.find({
      $or: [{ claimAId: { $in: claimIds } }, { claimBId: { $in: claimIds } }]
    }).select('_id').lean();
    const relationIds = rels.map((r: any) => r._id as string);
    await this.deleteDiscussionForRelations(relationIds);
    await ClaimRelationModel.deleteMany({ _id: { $in: relationIds } });
    await ClaimModel.deleteMany({ _id: { $in: claimIds } });
  }

  /** Whether any model on a message is still pending or mid-stream. */
  private async isMessageBusy(messageId: string): Promise<boolean> {
    const doc = await MessageModel.findOne({ _id: messageId }).select('modelResponses').lean();
    if (!doc) return false;
    return Object.values(doc.modelResponses || {}).some(
      (r: any) => r?.status === 'streaming' || r?.status === 'pending'
    );
  }

  /**
   * Deletes one prompt and its response card(s). The claims the response
   * produced go with it, cascading to their contradiction edges and discussions,
   * so no room memory outlives the message it came from.
   *
   * Returns false when the message is missing or a model is still generating —
   * deleting mid-stream would let the completion handler resurrect the row.
   */
  async deleteMessage(conversationId: string, messageId: string): Promise<boolean> {
    const exists = await MessageModel.findOne({ _id: messageId, conversationId }).select('_id').lean();
    if (!exists) return false;
    if (await this.isMessageBusy(messageId)) return false;

    const claimDocs = await ClaimModel.find({ conversationId, messageId }).select('_id').lean();
    await this.cascadeClaims(claimDocs.map((c: any) => c._id as string));

    const res = await MessageModel.deleteOne({ _id: messageId, conversationId });
    return res.deletedCount > 0;
  }

  /**
   * Clears every prompt and response in a room, keeping the room itself. The
   * room's whole memory goes with it — claims, contradiction edges, and their
   * discussions — because all of it was derived from the messages being removed.
   *
   * Returns -1 when a model is still generating anywhere in the room, for the
   * same reason as deleteMessage.
   */
  async clearConversationMessages(conversationId: string): Promise<number> {
    // In-flight streams always sit on the newest messages, so a bounded reverse
    // scan is enough to spot a busy room without walking the whole history.
    const recent = await MessageModel.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('modelResponses')
      .lean();
    const busy = recent.some((m: any) =>
      Object.values(m.modelResponses || {}).some((r: any) => r?.status === 'streaming' || r?.status === 'pending')
    );
    if (busy) return -1;

    const claimDocs = await ClaimModel.find({ conversationId }).select('_id').lean();
    await this.cascadeClaims(claimDocs.map((c: any) => c._id as string));
    // Belt-and-braces: any discussion data not reached through an edge.
    await DiscussionCommentModel.deleteMany({ conversationId });
    await ContradictionVoteModel.deleteMany({ conversationId });

    const res = await MessageModel.deleteMany({ conversationId });
    return res.deletedCount || 0;
  }

  // --- SAVED RESPONSE METHODS ---
  async getSavedResponses(workspaceId: string): Promise<SavedResponse[]> {
    const docs = await SavedResponseModel.find({ workspaceId }).lean();
    return docs.map((d: any) => ({ ...d, id: d._id })) as unknown as SavedResponse[];
  }

  async saveResponse(res: SavedResponse): Promise<SavedResponse> {
    const created = await SavedResponseModel.create({
      _id: res.id || generateUUID(),
      workspaceId: res.workspaceId,
      prompt: res.prompt,
      modelName: res.modelName,
      responseContent: res.responseContent,
      savedBy: res.savedBy,
      senderName: res.senderName,
      createdAt: res.createdAt || new Date().toISOString()
    });
    return { ...created.toJSON(), id: created._id } as unknown as SavedResponse;
  }

  async unsaveResponse(id: string): Promise<boolean> {
    const res = await SavedResponseModel.deleteOne({ _id: id });
    return res.deletedCount > 0;
  }

  // --- ADMIN & TELEMETRY AUDIT METHODS ---
  async logAudit(
    userId: string | undefined,
    userName: string | undefined,
    userEmail: string | undefined,
    action: string,
    details: string,
    workspaceId?: string,
    ipAddress?: string
  ): Promise<any> {
    try {
      const log = await AuditLogModel.create({
        _id: generateUUID(),
        userId,
        userName,
        userEmail,
        action,
        details,
        workspaceId,
        ipAddress,
        createdAt: new Date().toISOString()
      });
      return log;
    } catch (err) {
      console.error('Failed to save audit log:', err);
    }
  }

  async blockUser(id: string, blocked: boolean): Promise<boolean> {
    const res = await UserModel.findByIdAndUpdate(id, { blocked }, { new: true });
    return !!res;
  }

  async updateUserRole(id: string, role: string): Promise<boolean> {
    const res = await UserModel.findByIdAndUpdate(id, { role }, { new: true });
    return !!res;
  }

  async deleteUser(id: string): Promise<boolean> {
    const res = await UserModel.deleteOne({ _id: id });
    return res.deletedCount > 0;
  }
}

// Export database interface for application routing
export const db = new MongoDatabaseAdapter();
export default db;

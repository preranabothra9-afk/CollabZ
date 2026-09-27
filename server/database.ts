import mongoose, { Schema } from 'mongoose';
import fs from 'fs';
import path from 'path';
import { User, Workspace, Conversation, Message, SavedResponse } from '../src/types';
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

// AuditLog Schema
const AuditLogSchema = new Schema({
  _id: { type: String, default: generateUUID },
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
for (const schema of [UserSchema, WorkspaceSchema, ConversationSchema, MessageSchema, SavedResponseSchema, AuditLogSchema]) {
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
          email: 'nova-system@collabz.io',
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
        promptText: 'Analyze CollabZ workspace architecture.',
        modelResponses: {
          'gemini-3.5-flash': {
            modelName: 'Gemini 3.5 Flash',
            content: 'Hello! I am Gemini 3.5 Flash. I am fully integrated into **CollabZ** to support streamable team diagnostics, dynamic modeling, and high-fidelity code execution. In this workspace, you can trigger models simultaneously and compare results, observe live presence, edit prompts collaboratively, and save insights instantly.',
            status: 'completed',
            durationMs: 420
          },
          'claude-3-5': {
            modelName: 'Claude 3.5 Sonnet (Simulated)',
            content: 'CollabZ operates as a real-time full-stack environment. It enables multi-model cross-examination under high stress, where multiple collaborative nodes query distinct intelligent agents simultaneously.',
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
    await ConversationModel.deleteMany({ workspaceId: id });
    await SavedResponseModel.deleteMany({ workspaceId: id });
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
    return true;
  }

  // --- MESSAGE METHODS ---
  async getMessages(conversationId: string, limit: number = 50, page: number = 1): Promise<Message[]> {
    const docs = await MessageModel.find({ conversationId })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return docs.map((d: any) => ({ ...d, id: d._id })) as unknown as Message[];
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

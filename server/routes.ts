import { Router, Response } from 'express';
import { requireAuth, requireRole, adminOnly, AuthenticatedRequest, generateUUID } from './auth';
import { db, UserModel, WorkspaceModel, MessageModel, ConversationModel, SavedResponseModel, AuditLogModel } from './database';
import { Workspace, Conversation, SavedResponse, User } from '../src/types';
import { createWorkspaceSchema, createChannelSchema, inviteUserSchema, submitPromptSchema } from './validators';
import { getIo } from './socket';

const router = Router();

// --- AUTH ROUTER ---
import { handleRegister, handleLogin, handleLogout, verifyCurrentUser, handleRefresh, handleForgotPassword, handleResetPassword, handleVerifyEmail, handleCheckVerification, handleResendVerification } from './auth';
router.post('/auth/register', handleRegister);
router.post('/auth/login', handleLogin);
router.post('/auth/refresh', handleRefresh);
router.post('/auth/logout', handleLogout);
router.post('/auth/forgot-password', handleForgotPassword);
router.post('/auth/reset-password', handleResetPassword);
// GET is a read-only status check so link scanners cannot burn the token.
// POST performs the actual activation.
router.get('/auth/verify-email', handleCheckVerification);
router.post('/auth/verify-email', handleVerifyEmail);
router.post('/auth/resend-verification', handleResendVerification);
router.get('/auth/me', requireAuth, verifyCurrentUser);

// --- WORKSPACE ROUTER ---
// Get all workspaces (only workspaces where the user is a member)
router.get('/workspaces', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await db.getWorkspaces();
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Filter workspaces by member access, except for admin who can see all
    const accessible = list.filter(w => 
      userRole === 'admin' || w.ownerId === userId || (w.memberIds && w.memberIds.includes(userId))
    );
    return res.status(200).json(accessible);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve workspaces' });
  }
});

// Create workspace
router.post('/workspaces', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validationResult = createWorkspaceSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: validationResult.error.issues[0]?.message || 'Validation failed'
      });
    }

    const { name, description } = validationResult.data;

    const newWorkspace: Workspace = {
      id: generateUUID(),
      name,
      description: description || 'Collaborative AI workspace sandbox.',
      ownerId: req.user!.id,
      memberIds: [req.user!.id],
      createdAt: new Date().toISOString()
    };

    await db.createWorkspace(newWorkspace);
    await db.logAudit(req.user!.id, req.user!.name, req.user!.email, 'CREATE_WORKSPACE', `Created collaboration workspace: "${newWorkspace.name}" (${newWorkspace.id})`, newWorkspace.id, req.ip);

    // Create a default channel within this new workspace automatically
    const defaultConv: Conversation = {
      id: generateUUID(),
      workspaceId: newWorkspace.id,
      title: '🛰️ Central Brainstorm',
      createdBy: req.user!.id,
      createdAt: new Date().toISOString()
    };
    await db.createConversation(defaultConv);

    // Realtime broadcast to keep all active clients in sync
    const io = getIo();
    if (io) {
      io.emit('workspace-created', newWorkspace);
    }

    return res.status(201).json(newWorkspace);
  } catch (err: any) {
    console.error('Workspace creation error:', err);
    return res.status(500).json({ error: 'Workspace creation failed' });
  }
});

// Invite member to workspace
router.post('/workspaces/:id/invite', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ws = await db.getWorkspaceById(req.params.id);
    if (!ws) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Role-authorization: exclusive to workspace owners, global admins, or current workspace members
    if (ws.ownerId !== req.user!.id && req.user!.role !== 'admin' && !ws.memberIds.includes(req.user!.id)) {
      return res.status(403).json({ error: 'Only authorized workspace members or administrators can invite collaborators' });
    }

    // Zod verification
    const validation = inviteUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: validation.error.issues[0]?.message || 'Validation failed'
      });
    }

    const { email } = validation.data;
    let invitee = await db.getUserByEmail(email);

    if (!invitee) {
      // Auto-register the teammate profile seamlessly so standard emails can be invited beautifully
      const username = email.split('@')[0];
      const fallbackName = username.charAt(0).toUpperCase() + username.slice(1);
      const newId = 'user-' + Math.random().toString(36).substring(2, 11);
      const defaultUser: User = {
        id: newId,
        name: fallbackName,
        email: email.toLowerCase().trim(),
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(newId)}`,
        role: 'user',
        createdAt: new Date().toISOString()
      };

      const bcrypt = await import('bcryptjs');
      const salt = await bcrypt.default.genSalt(10);
      const mockPass = await bcrypt.default.hash('SynapsePassword2026!', salt);
      invitee = await db.createUser(defaultUser, mockPass);

      // Save refresh token field in database empty initially
      await UserModel.findByIdAndUpdate(invitee.id, { refreshToken: null }).catch(() => {});
    }

    // Evade duplications
    if (ws.memberIds.includes(invitee.id)) {
      return res.status(400).json({ error: 'Selected user is already a member of this workspace' });
    }

    ws.memberIds.push(invitee.id);
    await db.updateWorkspace(ws.id, { memberIds: ws.memberIds });
    await db.logAudit(req.user!.id, req.user!.name, req.user!.email, 'INVITE_COLLABORATOR', `Invited user "${invitee.name}" (${invitee.email}) to workspace: "${ws.name}"`, ws.id, req.ip);

    // Broadcast realtime event
    const io = getIo();
    if (io) {
      const roomName = `workspace:${ws.id}`;
      // Notify current workspace room and invitee specifically if connected
      io.to(roomName).emit('workspace-member-added', {
        workspaceId: ws.id,
        user: {
          id: invitee.id,
          name: invitee.name,
          email: invitee.email,
          avatar: invitee.avatar,
        }
      });
      // Emit globallly so workspace list updates in real time for invited user
      io.emit('workspace-updated-global', ws);
    }

    return res.status(200).json({
      message: 'User successfully added to workspace',
      member: {
        id: invitee.id,
        name: invitee.name,
        email: invitee.email,
        avatar: invitee.avatar
      },
      workspace: ws
    });
  } catch (err: any) {
    console.error('Invite member error:', err);
    return res.status(500).json({ error: 'Failed to complete user invitation sequence.' });
  }
});

// Delete workspace
router.delete('/workspaces/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ws = await db.getWorkspaceById(req.params.id);
    if (!ws) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Owner check
    if (ws.ownerId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the workspace owner can delete it.' });
    }

    const success = await db.deleteWorkspace(req.params.id);
    if (success) {
      await db.logAudit(req.user!.id, req.user!.name, req.user!.email, 'DELETE_WORKSPACE', `Deleted collaborative workspace: "${ws.name}" (${ws.id})`, ws.id, req.ip);
      const io = getIo();
      if (io) {
        io.emit('workspace-deleted', { workspaceId: req.params.id });
      }
      return res.status(200).json({ message: 'Workspace and related channels deleted successfully' });
    }
    return res.status(400).json({ error: 'Could not delete workspace' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Workspace deletion failed' });
  }
});

// --- CONVERSATION / CHANNEL ROUTER ---
// Get channels in workspace
router.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId query parameter is required' });
    }
    const list = await db.getConversations(workspaceId);
    return res.status(200).json(list);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve channels' });
  }
});

// Create channel
router.post('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validationResult = createChannelSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: validationResult.error.issues[0]?.message || 'Validation failed'
      });
    }

    const { workspaceId, title } = validationResult.data;

    const newChannel: Conversation = {
      id: generateUUID(),
      workspaceId,
      title: title.startsWith('💬') || title.startsWith('📡') || title.startsWith('🚀') || title.startsWith('🛰️') ? title : `💬 ${title}`,
      createdBy: req.user!.id,
      createdAt: new Date().toISOString()
    };

    await db.createConversation(newChannel);

    const io = getIo();
    if (io) {
      const roomName = `workspace:${workspaceId}`;
      io.to(roomName).emit('channel-created', newChannel);
    }

    return res.status(201).json(newChannel);
  } catch (err: any) {
    return res.status(500).json({ error: 'Channel creation failed' });
  }
});

// Delete channel
router.delete('/conversations/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const conv = await db.getConversationById(req.params.id);
    if (!conv) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    await db.deleteConversation(req.params.id);

    const io = getIo();
    if (io) {
      const roomName = `workspace:${conv.workspaceId}`;
      io.to(roomName).emit('channel-deleted', { conversationId: req.params.id });
    }

    return res.status(200).json({ message: 'Channel deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Channel deletion failed' });
  }
});

// --- MESSAGES ROUTER ---
// Get messages for conversation (with pagination support)
router.get('/messages/:conversationId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const page = parseInt(req.query.page as string) || 1;
    const history = await db.getMessages(req.params.conversationId, limit, page);
    return res.status(200).json(history);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// --- SAVED RESPONSES ROUTER ---
// Get saved responses for workspace
router.get('/saved-responses', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId query parameter is required' });
    }
    const saved = await db.getSavedResponses(workspaceId);
    return res.status(200).json(saved);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to get saved responses' });
  }
});

// Save AI Response
router.post('/saved-responses', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { workspaceId, prompt, modelName, responseContent, senderName } = req.body;
    if (!workspaceId || !prompt || !modelName || !responseContent) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const saved: SavedResponse = {
      id: generateUUID(),
      workspaceId,
      prompt,
      modelName,
      responseContent,
      savedBy: req.user!.id,
      senderName: senderName || 'Gemini',
      createdAt: new Date().toISOString()
    };

    await db.saveResponse(saved);
    return res.status(201).json(saved);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save AI response' });
  }
});

// Unsave response
router.delete('/saved-responses/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await db.unsaveResponse(req.params.id);
    if (success) {
      return res.status(200).json({ id: req.params.id, message: 'Response removed successfully' });
    }
    return res.status(404).json({ error: 'Saved response not found' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to remove response' });
  }
});

// --- ADMIN CONTROL PANEL SCHEMAS & METRICS ---

// Backward compatibility console API endpoint
router.get('/admin/analytics', requireAuth, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalUsers = await UserModel.countDocuments();
    const totalWorkspaces = await WorkspaceModel.countDocuments();
    const totalPromptQueries = await MessageModel.countDocuments();
    
    const rawMessages = await MessageModel.find().lean();
    let totalGeneratedSymbols = 0;
    rawMessages.forEach((msg: any) => {
      if (msg.modelResponses) {
        Object.values(msg.modelResponses).forEach((resp: any) => {
          if (resp && resp.content) {
            totalGeneratedSymbols += resp.content.length;
          }
        });
      }
    });

    const activeConnectionsCount = getIo() ? getIo().engine.clientsCount : 0;

    const recentMessages = await MessageModel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const activityLog = recentMessages.map((m: any) => ({
      id: m._id,
      type: 'AI_QUERY',
      description: `User "${m.senderName}" queried AI models with prompt: "${m.promptText.slice(0, 40)}..."`,
      timestamp: m.createdAt
    }));

    return res.status(200).json({
      metrics: {
        totalUsers,
        totalWorkspaces,
        activeConnections: activeConnectionsCount,
        aiRequestCount: totalPromptQueries,
        totalTokensProcessed: Math.max(totalPromptQueries * 180, Math.round(totalGeneratedSymbols / 4))
      },
      recentActivity: activityLog
    });
  } catch (error) {
    console.error('Failed to gather administrative analytics:', error);
    return res.status(500).json({ error: 'Internal administrative query breakdown.' });
  }
});

// 1. ADVANCED ADMIN METRICS (Dashboard UI Cards & Charts)
router.get(['/admin/dashboard/metrics', '/admin/stats'], requireAuth, adminOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalUsers = await UserModel.countDocuments();
    const totalWorkspaces = await WorkspaceModel.countDocuments();
    const totalMessages = await MessageModel.countDocuments();
    const totalAuditLogs = await AuditLogModel.countDocuments();

    // Calculate Active Users (active within last 24h)
    const yesterdayISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const activeUsersCount = await UserModel.countDocuments({
      lastActiveAt: { $gte: yesterdayISO }
    });

    const onlineUsersCount = getIo() ? getIo().engine.clientsCount : 0;

    // AI queries
    const messages = await MessageModel.find().lean() as any[];
    let totalGeminiRequests = 0;
    let failedRequests = 0;
    let totalLatencyMs = 0;
    let latencyCount = 0;

    // Start of the current local day — used for the "today" counters below so the
    // dashboard reflects actual activity rather than lifetime totals.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();
    let aiRequestsToday = 0;
    let messagesToday = 0;

    const modelCounts: Record<string, number> = {
      'gemini-3.5-flash': 0,
      'gemini-3.1-flash-lite': 0,
      'gemini-flash-latest': 0,
      'claude-3-5': 0,
    };

    messages.forEach((m) => {
      const createdMs = new Date(m.createdAt).getTime();
      const isToday = Number.isFinite(createdMs) && createdMs >= startOfTodayMs;
      if (isToday) messagesToday++;

      if (m.modelResponses) {
        Object.entries(m.modelResponses).forEach(([modelKey, resp]: [string, any]) => {
          totalGeminiRequests++;
          if (isToday) aiRequestsToday++;
          if (resp) {
            if (resp.status === 'failed') failedRequests++;
            if (resp.durationMs) {
              totalLatencyMs += resp.durationMs;
              latencyCount++;
            }
            // Count distribution
            if (modelCounts[modelKey] !== undefined) {
              modelCounts[modelKey]++;
            } else {
              modelCounts[modelKey] = 1;
            }
          }
        });
      }
    });

    // 0 when nothing has streamed yet — previously a hardcoded 480ms placeholder
    const averageResponseTime = latencyCount > 0 ? Math.round(totalLatencyMs / latencyCount) : 0;

    // Helper function to safely extract ISO String format for date comparisons
    const getIsoStr = (val: any): string => {
      if (!val) return '';
      if (typeof val.toISOString === 'function') {
        try {
          return val.toISOString();
        } catch {
          return '';
        }
      }
      if (typeof val === 'string') {
        return val;
      }
      try {
        return new Date(val).toISOString();
      } catch {
        return String(val);
      }
    };

    // Generate Chart Data arrays
    // Daily AI usage (past 7 days)
    const dailyAiUsage = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const isoPrefix = date.toISOString().slice(0, 10); // YYYY-MM-DD
      
      const count = messages.filter(m => {
        const str = getIsoStr(m.createdAt);
        return str && str.startsWith(isoPrefix);
      }).length;
      dailyAiUsage.push({ day: label, requests: count * 2 });
    }

    // User growth (past 7 days cumulative)
    const usergrowth = [];
    const usersList = await UserModel.find().lean() as any[];
    let cumulative = 0;
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const isoPrefix = date.toISOString().slice(0, 10);
      
      const registeredThatDay = usersList.filter(u => {
        const str = getIsoStr(u.createdAt);
        return str && str.startsWith(isoPrefix);
      }).length;
      cumulative += registeredThatDay;
      usergrowth.push({ day: label, users: Math.max(totalUsers - 4 + cumulative, 1) });
    }

    // Workspace activity trends
    const workspaceActivity = [];
    const workspacesList = await WorkspaceModel.find().lean() as any[];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const isoPrefix = date.toISOString().slice(0, 10);
      
      const countCreated = workspacesList.filter(w => {
        const str = getIsoStr(w.createdAt);
        return str && str.startsWith(isoPrefix);
      }).length;
      workspaceActivity.push({ day: label, activeRooms: countCreated });
    }

    // Model usage distribution
    const modelUsage = Object.entries(modelCounts).map(([key, value]) => ({
      name: key === 'gemini-3.5-flash' ? 'Gemini 3.5 Flash' : key === 'gemini-3.1-flash-lite' ? 'Gemini 3.1 Lite' : key === 'claude-3-5' ? 'Claude 3.5' : key,
      value: value || 2
    }));

    // System status summary
    const systemStatus = {
      cpuUsage: 0,
      memoryUsage: 0,
      databaseState: 'HEALTHY',
      socketsPool: onlineUsersCount,
      pingMs: 0
    };

    // System activity feed logs
    const recentAuditList = await AuditLogModel.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    return res.status(200).json({
      metrics: {
        totalUsers,
        activeUsers: Math.max(activeUsersCount, 1),
        onlineUsers: onlineUsersCount,
        totalWorkspaces,
        totalMessages,
        aiRequestsToday,
        messagesToday,
        totalAiRequests: totalGeminiRequests,
        totalPromptStreams: totalGeminiRequests,
        averageResponseTime
      },
      charts: {
        dailyAiUsage,
        usergrowth,
        workspaceActivity,
        modelUsage
      },
      systemStatus,
      recentActivity: recentAuditList
    });
  } catch (err: any) {
    console.error('Error in /admin/dashboard/metrics:', err);
    return res.status(500).json({ error: 'Failed to retrieve advanced dashboards metrics' });
  }
});

// 2. PAGINATED & SEARCHABLE USER LIST
router.get('/admin/users', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const search = (req.query.search as string || '').toLowerCase().trim();
    const roleFilter = req.query.role as string || '';
    const verifyFilter = req.query.verified as string || '';

    let filter: any = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (roleFilter) {
      filter.role = roleFilter;
    }
    if (verifyFilter === 'true') {
      filter.isVerified = true;
    } else if (verifyFilter === 'false') {
      filter.isVerified = { $ne: true };
    }

    const totalUsers = await UserModel.countDocuments(filter);
    const users = await UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Map stats live for each user
    const formattedUsers = await Promise.all(users.map(async (u: any) => {
      const workspacesCount = await WorkspaceModel.countDocuments({
        $or: [{ ownerId: u._id }, { memberIds: u._id }]
      });
      const messagesCount = await MessageModel.countDocuments({
        senderId: u._id
      });
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        role: u.role,
        blocked: !!u.blocked,
        isVerified: u.isVerified === true,
        // Verified accounts retain their token hash so re-opened links resolve
        // gracefully, so this must exclude them.
        hasPendingVerification: u.isVerified !== true && !!u.verifyToken,
        lastActiveAt: u.lastActiveAt || u.createdAt,
        createdAt: u.createdAt,
        workspacesCount,
        messagesCount
      };
    }));

    return res.status(200).json({
      users: formattedUsers,
      pagination: {
        total: totalUsers,
        page,
        limit,
        pages: Math.ceil(totalUsers / limit)
      }
    });

  } catch (err: any) {
    console.error('Error fetching admin users:', err);
    return res.status(500).json({ error: 'Failed to retrieve paginated user directories.' });
  }
});

// 3. BLOCK/UNBLOCK USER
const blockUserHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { blocked } = req.body;
    const userId = req.params.id;

    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Administrative lockout exception: You cannot block yourself.' });
    }

    const doc = await UserModel.findById(userId);
    if (!doc) {
      return res.status(404).json({ error: 'Selected user profile not found.' });
    }

    doc.blocked = !!blocked;
    await doc.save();

    const actionText = blocked ? 'BLOCK_USER' : 'UNBLOCK_USER';
    const descText = blocked ? `Blocked collaborator profile: "${doc.name}" (${doc.email})` : `Restored collaborator profile: "${doc.name}" (${doc.email})`;

    await db.logAudit(req.user!.id, req.user!.name, req.user!.email, actionText, descText, undefined, req.ip);

    // Boot user sockets if blocked
    if (blocked) {
      const io = getIo();
      if (io) {
        // Emit suspension alert across socket connections
        io.emit('session-revoked', { userId });
      }
    }

    return res.status(200).json({ message: 'User updated successfully', user: { id: doc._id, blocked: doc.blocked } });
  } catch (err: any) {
    return res.status(500).json({ error: 'Profile state modification failed.' });
  }
};
router.put('/admin/users/:id/block', requireAuth, requireRole('admin'), blockUserHandler);
router.patch('/admin/users/:id/block', requireAuth, requireRole('admin'), blockUserHandler);

// 4. MODIFY USER ROLE
const modifyUserRoleHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    if (!role || (role !== 'user' && role !== 'admin')) {
      return res.status(400).json({ error: 'Invalid user privileges role requested.' });
    }

    const doc = await UserModel.findById(userId);
    if (!doc) {
      return res.status(404).json({ error: 'Collaborator profile not found.' });
    }

    const oldRole = doc.role;
    doc.role = role;
    await doc.save();

    await db.logAudit(
      req.user!.id,
      req.user!.name,
      req.user!.email,
      'ROLE_CHANGE',
      `Modified privileges for collaborator "${doc.name}": "${oldRole}" -> "${role}"`,
      undefined,
      req.ip
    );

    return res.status(200).json({ message: 'User role updated successfully', user: { id: doc._id, role: doc.role } });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to modify role policies.' });
  }
};
router.put('/admin/users/:id/role', requireAuth, requireRole('admin'), modifyUserRoleHandler);
router.patch('/admin/users/:id/role', requireAuth, requireRole('admin'), modifyUserRoleHandler);

// 4b. MANUALLY MARK AN EMAIL AS VERIFIED
// Escape hatch for accounts whose delivery email bounced or that were created
// before verification existed. Burns any outstanding token.
const verifyUserEmailHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.params.id;

    const doc = await UserModel.findById(userId);
    if (!doc) {
      return res.status(404).json({ error: 'Collaborator profile not found.' });
    }

    if (doc.isVerified === true) {
      return res.status(200).json({ message: 'Email is already verified.', user: { id: doc._id, isVerified: true } });
    }

    doc.isVerified = true;
    doc.verifyTokenExpiresAt = null;
    doc.updatedAt = new Date().toISOString();
    await doc.save();

    await db.logAudit(
      req.user!.id,
      req.user!.name,
      req.user!.email,
      'EMAIL_VERIFIED',
      `Manually marked "${doc.email}" as verified by an administrator.`,
      undefined,
      req.ip
    );

    return res.status(200).json({
      message: 'Email marked as verified.',
      user: { id: doc._id, isVerified: true },
    });
  } catch (err: any) {
    console.error('Error verifying user email:', err);
    return res.status(500).json({ error: 'Failed to update verification status.' });
  }
};
router.patch('/admin/users/:id/verify', requireAuth, requireRole('admin'), verifyUserEmailHandler);

// 5. ENHANCED USER PROFILE DELETION
router.delete('/admin/users/:id', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.params.id;

    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Administrative conflict: Self profile destruction prohibited.' });
    }

    const doc = await UserModel.findById(userId);
    if (!doc) {
      return res.status(404).json({ error: 'Collaborator profile record does not exist.' });
    }

    // Deletion
    const success = await db.deleteUser(userId);
    if (success) {
      await db.logAudit(
        req.user!.id,
        req.user!.name,
        req.user!.email,
        'DELETE_USER',
        `Terminated account data profile: "${doc.name}" (${doc.email})`,
        undefined,
        req.ip
      );
      return res.status(200).json({ message: 'User profile hard deleted successfully.' });
    }
    return res.status(400).json({ error: 'Database adapter rejected deletion sequence.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'General profile deletion fault.' });
  }
});

// 6. DETAILED WORKSPACES VISIBILITY
router.get('/admin/workspaces', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaces = await WorkspaceModel.find().lean() as any[];
    
    const formatted = await Promise.all(workspaces.map(async (ws) => {
      const channelsCount = await ConversationModel.countDocuments({ workspaceId: ws._id });
      const savedCount = await SavedResponseModel.countDocuments({ workspaceId: ws._id });
      
      const owner = await UserModel.findById(ws.ownerId).select('name email avatar').lean();
      
      return {
        id: ws._id,
        name: ws.name,
        description: ws.description,
        owner: owner ? { name: owner.name, email: owner.email, avatar: owner.avatar } : { name: 'System', email: 'nova-system@collabz.io', avatar: 'SYS' },
        membersCount: ws.memberIds ? ws.memberIds.length : 1,
        channelsCount,
        savedCount,
        createdAt: ws.createdAt
      };
    }));

    return res.status(200).json(formatted);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to gather system workspaces registry.' });
  }
});

// 7. ABUSIVE WORKSPACE TERMINATION
router.delete('/admin/workspaces/:id', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wsId = req.params.id;
    const ws = await db.getWorkspaceById(wsId);
    if (!ws) {
      return res.status(404).json({ error: 'Workspace index not found.' });
    }

    const success = await db.deleteWorkspace(wsId);
    if (success) {
      await db.logAudit(
        req.user!.id,
        req.user!.name,
        req.user!.email,
        'WORKSPACE_DEL',
        `Administrative deletion of workspace: "${ws.name}" owner ID (${ws.ownerId})`,
        wsId,
        req.ip
      );

      const io = getIo();
      if (io) {
        io.emit('workspace-deleted', { workspaceId: wsId });
      }

      return res.status(200).json({ message: 'Workspace destroyed successfully.' });
    }
    return res.status(400).json({ error: 'Could not dismantle workspace.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Terminator module database execution defect.' });
  }
});

// 8. AUDIT LOG TELEMETRY LISTINGS
router.get('/admin/audit-logs', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const actionFilter = req.query.action as string || '';

    let filter: any = {};
    if (actionFilter) {
      filter.action = actionFilter;
    }

    const totalLogs = await AuditLogModel.countDocuments(filter);
    const logs = await AuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const formatted = logs.map((l: any) => ({
      id: l._id,
      userId: l.userId,
      userName: l.userName || 'Guest/Anonymous',
      userEmail: l.userEmail || 'N/A',
      action: l.action,
      details: l.details,
      workspaceId: l.workspaceId,
      ipAddress: l.ipAddress || '0.0.0.0',
      createdAt: l.createdAt
    }));

    return res.status(200).json({
      auditLogs: formatted,
      pagination: {
        total: totalLogs,
        page,
        limit,
        pages: Math.ceil(totalLogs / limit)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch telemetry auditing files.' });
  }
});

export default router;

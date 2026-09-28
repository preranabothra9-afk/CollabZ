import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { db } from './database';
import { streamModel, AI_MODELS } from './ai';
import { Message, PresenceUser } from '../src/types';
import { generateUUID, getJwtSecret } from './auth';

// In-memory active presence track: workspaceId -> [ PresenceUsers ]
const workspacePresence: Record<string, PresenceUser[]> = {};

// Keep track of socketId -> {userId, workspaceId} for fast disconnect cleanup
interface SocketMeta {
  userId: string;
  userName: string;
  avatar: string;
  workspaceId: string;
}
const activeSockets: Record<string, SocketMeta> = {};

// Active generation jobs: `${messageId}:${modelKey}` -> abort handle.
// Lets a user stop a single model (or all models of a message) mid-stream.
interface ActiveGeneration {
  controller: AbortController;
  /** True once the user requested a stop; completion/error callbacks then save a 'stopped' status. */
  stopped: boolean;
}
const activeGenerations: Map<string, ActiveGeneration> = new Map();

// Globally accessible Socket Server reference for route-based messaging
let globalIo: SocketServer | null = null;

export function getIo(): SocketServer | null {
  return globalIo;
}

export function setupSocketIO(server: HttpServer) {
  const io = new SocketServer(server, {
    cors: {
      origin: '*', // Allow full connection inside sandbox
      methods: ['GET', 'POST']
    }
  });

  globalIo = io;

  // --- HANDSHAKE AUTHENTICATION MIDDLEWARE ---
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      
      if (!token) {
        return next(new Error('Authentication failed: Missing handshake auth token.'));
      }

      const secret = getJwtSecret();
      if (!secret) {
        return next(new Error('Authentication failed: JWT_SECRET environment key error.'));
      }

      const decoded = jwt.verify(token, secret) as { id: string; email: string; name: string; role: string };
      const user = await db.getUserById(decoded.id);

      if (!user) {
        return next(new Error('Authentication failed: Invalid collaborator credentials.'));
      }

      if (user.blocked) {
        return next(new Error('Authentication failed: Your account has been suspended by system administrators.'));
      }

      // Attach credentials to socket context
      socket.data = { user };
      next();
    } catch (err: any) {
      // An expired access token on reconnect is expected — the client silently
      // refreshes and retries, so log it quietly instead of dumping a stack trace.
      if (err?.name === 'TokenExpiredError') {
        console.warn('Socket handshake: access token expired, awaiting client refresh.');
      } else {
        console.error('Socket authentication handshake signature error:', err);
      }
      return next(new Error('Authentication failed: Invalid token signature or expiration.'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userObj = socket.data?.user;
    console.log(`Secured socket connection active: ${socket.id} (${userObj?.name})`);

    // -- JOIN WORKSPACE ROOM (SECURE CHECK) --
    socket.on('join-workspace', async (data: { workspaceId: string; userId: string; userName: string; avatar: string }) => {
      const { workspaceId, userId, userName, avatar } = data;
      if (!workspaceId || !userId) return;

      try {
        // Strict boundary protection check
        const workspace = await db.getWorkspaceById(workspaceId);
        if (!workspace) {
          socket.emit('error-alert', { message: 'The requested workspace does not exist.' });
          return;
        }

        const isMember = workspace.ownerId === userId || (workspace.memberIds && workspace.memberIds.includes(userId));
        const isAdmin = userObj?.role === 'admin';

        if (!isMember && !isAdmin) {
          socket.emit('error-alert', { message: 'Unauthorized: You are not registered as an authorized member of this workspace.' });
          return;
        }

        const roomName = `workspace:${workspaceId}`;
        socket.join(roomName);

        // Register socket details for cleanup
        activeSockets[socket.id] = { userId, userName, avatar, workspaceId };

        if (!workspacePresence[workspaceId]) {
          workspacePresence[workspaceId] = [];
        }

        // De-duplicate users in presence list
        workspacePresence[workspaceId] = workspacePresence[workspaceId].filter(u => u.userId !== userId);
        
        const newPres: PresenceUser = {
          userId,
          userName,
          avatar,
          lastActive: new Date().toISOString()
        };
        
        workspacePresence[workspaceId].push(newPres);

        // Broadcast presence updates
        io.to(roomName).emit('presence-sync', workspacePresence[workspaceId]);
        console.log(`Secured Channel: ${userName} joined workspace room ID: ${roomName}`);
      } catch (err) {
        console.error('Failed to complete workspace join auth sequences:', err);
      }
    });

    // -- LEAVE WORKSPACE ROOM --
    socket.on('leave-workspace', (data: { workspaceId: string; userId: string }) => {
      const { workspaceId, userId } = data;
      if (!workspaceId || !userId) return;

      const roomName = `workspace:${workspaceId}`;
      socket.leave(roomName);

      if (workspacePresence[workspaceId]) {
        workspacePresence[workspaceId] = workspacePresence[workspaceId].filter(u => u.userId !== userId);
        io.to(roomName).emit('presence-sync', workspacePresence[workspaceId]);
      }

      delete activeSockets[socket.id];
    });

    // -- COLLABORATIVE PROMPT EDITS --
    socket.on('prompt-text-change', (data: { workspaceId: string; promptText: string; userId: string; userName: string }) => {
      const { workspaceId, promptText, userId, userName } = data;
      const roomName = `workspace:${workspaceId}`;
      
      // Update typing/activity status on presence record
      if (workspacePresence[workspaceId]) {
        const presUser = workspacePresence[workspaceId].find(u => u.userId === userId);
        if (presUser) {
          presUser.activity = 'editing...';
          presUser.lastActive = new Date().toISOString();
        }
      }

      // Broadcast content to everyone in room EXCEPT the sender
      socket.to(roomName).emit('prompt-text-sync', {
        workspaceId,
        promptText,
        updatedBy: userId,
        updatedByName: userName
      });
    });

    // -- TYPING FEEDBACK AND THROTLED EVENTS --
    socket.on('user-typing-start', (data: { workspaceId: string; userId: string; userName: string }) => {
      const { workspaceId, userId, userName } = data;
      const roomName = `workspace:${workspaceId}`;

      if (workspacePresence[workspaceId]) {
        const presUser = workspacePresence[workspaceId].find(u => u.userId === userId);
        if (presUser) {
          presUser.activity = 'typing...';
          presUser.lastActive = new Date().toISOString();
        }
        io.to(roomName).emit('presence-sync', workspacePresence[workspaceId]);
        
        // Emit explicit standardized typing event requested in Step 5
        io.to(roomName).emit('user-typing', {
          workspaceId,
          userId,
          userName,
          isTyping: true
        });
      }
    });

    socket.on('user-typing-stop', (data: { workspaceId: string; userId: string }) => {
      const { workspaceId, userId } = data;
      const roomName = `workspace:${workspaceId}`;

      if (workspacePresence[workspaceId]) {
        const presUser = workspacePresence[workspaceId].find(u => u.userId === userId);
        if (presUser) {
          presUser.activity = undefined;
        }
        io.to(roomName).emit('presence-sync', workspacePresence[workspaceId]);
        
        // Emit explicit standardized typing event requested in Step 5
        io.to(roomName).emit('user-typing', {
          workspaceId,
          userId,
          isTyping: false
        });
      }
    });

    // -- SUBMIT PROMPT FOR REALTIME AI MULTI-STREAMING COMPARISON --
    socket.on('submit-prompt', async (data: {
      workspaceId: string;
      conversationId: string;
      promptText: string;
      selectedModels: string[]; // e.g. ["gemini-2.5-flash", "gpt-oss-120b", "qwen3.8-27b"]
      userId: string;
      userName: string;
      userAvatar: string;
    }) => {
      const { workspaceId, conversationId, promptText, selectedModels, userId, userName, userAvatar } = data;
      const roomName = `workspace:${workspaceId}`;

      if (!workspaceId || !conversationId || !promptText || !selectedModels || selectedModels.length === 0) {
        return;
      }

      // Clear any typing activity
      if (workspacePresence[workspaceId]) {
        const presUser = workspacePresence[workspaceId].find(u => u.userId === userId);
        if (presUser) presUser.activity = undefined;
        io.to(roomName).emit('presence-sync', workspacePresence[workspaceId]);
      }

      // Map models parameter correctly using registry config
      const modelResponsesRecord: Message['modelResponses'] = {};

      selectedModels.forEach(modelKey => {
        const modelObj = AI_MODELS[modelKey];
        modelResponsesRecord[modelKey] = {
          modelName: modelObj ? modelObj.name : modelKey,
          content: '',
          status: 'pending'
        };
      });

      const messageId = generateUUID();
      const newMessage: Message = {
        id: messageId,
        conversationId,
        senderId: userId,
        senderName: userName,
        senderAvatar: userAvatar,
        promptText,
        modelResponses: modelResponsesRecord,
        createdAt: new Date().toISOString()
      };

      // Save initial state to MongoDB
      await db.createMessage(newMessage);

      // Log AI query audit trail
      db.logAudit(userId, userName, userObj?.email || 'unknown', 'AI_PROMPT_REQUEST', `Triggered comparative AI queries for models: ${selectedModels.join(', ')}`, workspaceId).catch(() => {});

      // Broadcast Message Created to everyone (so cards with shimmer appear immediately in workspace!)
      io.to(roomName).emit('message-created', newMessage);

      // Execute comparative streaming asynchronously in parallel
      selectedModels.forEach(async (modelKey) => {
        try {
          // Update status to streaming in database
          const msgRef = await db.getMessageById(messageId);
          if (msgRef && msgRef.modelResponses[modelKey]) {
            msgRef.modelResponses[modelKey].status = 'streaming';
            await db.updateMessage(messageId, msgRef);
          }

          // Emit old model update status
          io.to(roomName).emit('model-status-update', {
            messageId,
            modelKey,
            status: 'streaming'
          });

          // Emit new modern standardized stream status (Step 5)
          io.to(roomName).emit('ai-stream-start', {
            messageId,
            modelKey,
            status: 'streaming'
          });

          let fullContent = '';
          const startTime = Date.now();

          const generationKey = `${messageId}:${modelKey}`;
          const controller = new AbortController();
          const generation: ActiveGeneration = { controller, stopped: false };
          activeGenerations.set(generationKey, generation);

          const onChunkCallback = (chunk: string) => {
            fullContent += chunk;
            // Emit traditional chunk
            io.to(roomName).emit('model-stream-chunk', {
              messageId,
              modelKey,
              chunk
            });
            // Emit modern standardized chunk (Step 5)
            io.to(roomName).emit('ai-stream-chunk', {
              messageId,
              modelKey,
              chunk
            });
          };

          // Saves a user-requested stop with whatever text was already streamed.
          const completeStopped = async () => {
            const durationMs = Date.now() - startTime;
            const updatedMsg = await db.getMessageById(messageId);
            if (updatedMsg && updatedMsg.modelResponses[modelKey]) {
              updatedMsg.modelResponses[modelKey].content = fullContent;
              updatedMsg.modelResponses[modelKey].status = 'stopped';
              updatedMsg.modelResponses[modelKey].durationMs = durationMs;
              await db.updateMessage(messageId, updatedMsg);
            }

            io.to(roomName).emit('model-stream-stopped', {
              messageId,
              modelKey,
              content: fullContent,
              durationMs
            });
            io.to(roomName).emit('ai-stream-end', {
              messageId,
              modelKey,
              content: fullContent,
              durationMs,
              status: 'stopped'
            });
          };

          const onCompleteCallback = async (finalText: string) => {
            if (generation.stopped) {
              await completeStopped();
              return;
            }
            const durationMs = Date.now() - startTime;
            
            // Save final rendering inside persistent DB
            const updatedMsg = await db.getMessageById(messageId);
            if (updatedMsg && updatedMsg.modelResponses[modelKey]) {
              updatedMsg.modelResponses[modelKey].content = finalText;
              updatedMsg.modelResponses[modelKey].status = 'completed';
              updatedMsg.modelResponses[modelKey].durationMs = durationMs;
              await db.updateMessage(messageId, updatedMsg);
            }

            // Broadcast traditional complete event
            io.to(roomName).emit('model-stream-complete', {
              messageId,
              modelKey,
              content: finalText,
              durationMs
            });

            // Broadcast modern standardized complete event (Step 5)
            io.to(roomName).emit('ai-stream-end', {
              messageId,
              modelKey,
              content: finalText,
              durationMs,
              status: 'completed'
            });
          };

          const onErrorCallback = async (err: string) => {
            // An aborted stream is a user stop, not a failure.
            if (generation.stopped) {
              await completeStopped();
              return;
            }
            console.error(`[socket] stream failed for model ${modelKey}: ${err}`);
            const updatedMsg = await db.getMessageById(messageId);
            if (updatedMsg && updatedMsg.modelResponses[modelKey]) {
              updatedMsg.modelResponses[modelKey].status = 'failed';
              updatedMsg.modelResponses[modelKey].error = err;
              await db.updateMessage(messageId, updatedMsg);
            }

            io.to(roomName).emit('model-stream-failed', {
              messageId,
              modelKey,
              error: err
            });

            io.to(roomName).emit('ai-stream-end', {
              messageId,
              modelKey,
              error: err,
              status: 'failed'
            });
          };

          // Route to centralized AI providers; transport is resolved from the registry.
          // The abort controller lets the client stop this model mid-stream.
          try {
            await streamModel(modelKey, promptText, onChunkCallback, onCompleteCallback, onErrorCallback, controller.signal);
          } finally {
            const current = activeGenerations.get(generationKey);
            if (current === generation) activeGenerations.delete(generationKey);
          }
        } catch (err: any) {
          console.error(`Socket query loop failure on model ${modelKey}:`, err);
          io.to(roomName).emit('model-stream-failed', {
            messageId,
            modelKey,
            error: err.message || String(err)
          });
        }
      });
    });

    // -- MANUAL STOP OF AN ACTIVE GENERATION --
    socket.on('stop-generation', (data: { messageId: string; modelKey?: string }) => {
      const { messageId, modelKey } = data || {};
      if (!messageId) return;

      const prefix = `${messageId}:`;
      let stopped = 0;

      for (const [key, generation] of Array.from(activeGenerations.entries())) {
        if (!key.startsWith(prefix)) continue;
        if (modelKey && key !== `${messageId}:${modelKey}`) continue;
        generation.stopped = true;
        generation.controller.abort();
        stopped++;
      }

      if (stopped === 0) {
        socket.emit('error-alert', { message: 'That stream has already finished.' });
        return;
      }

      console.log(`[socket] stop requested for ${stopped} active stream(s) on message ${messageId}`);
    });

    // -- DISCONNECT ROUTINES --
    socket.on('disconnect', () => {
      const socketDetails = activeSockets[socket.id];
      if (socketDetails) {
        const { userId, workspaceId, userName } = socketDetails;
        const roomName = `workspace:${workspaceId}`;

        if (workspacePresence[workspaceId]) {
          workspacePresence[workspaceId] = workspacePresence[workspaceId].filter(u => u.userId !== userId);
          io.to(roomName).emit('presence-sync', workspacePresence[workspaceId]);
        }

        console.log(`Presence cleaned up for disconnected user: ${userName}`);
        delete activeSockets[socket.id];
      }
    });
  });
}

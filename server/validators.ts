import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name is too long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long')
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters long')
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional()
});

export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address to invite')
});

export const createChannelSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  title: z.string().min(1, 'Channel title is required').max(100, 'Title is too long')
});

export const submitPromptSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  conversationId: z.string().min(1, 'Conversation ID is required'),
  promptText: z.string().min(1, 'Prompt content is required'),
  selectedModels: z.array(z.string()).min(1, 'Please select at least one AI agent')
});

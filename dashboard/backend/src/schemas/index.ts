import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

// ─── Guild Config ─────────────────────────────────────────────────────────────

export const raidThresholdsSchema = z.object({
  joins10s: z.number().int().min(1).max(100),
  joins30s: z.number().int().min(1).max(200),
  joins2m: z.number().int().min(1).max(500),
  newAccountAgeDays: z.number().int().min(0).max(365),
  mentionSpamCount: z.number().int().min(1).max(50),
});

export const nukeThresholdsSchema = z.object({
  channelDelete: z.number().int().min(1).max(50),
  channelCreate: z.number().int().min(1).max(50),
  roleDelete: z.number().int().min(1).max(50),
  roleCreate: z.number().int().min(1).max(50),
  banCount: z.number().int().min(1).max(50),
  kickCount: z.number().int().min(1).max(50),
  webhookCreate: z.number().int().min(1).max(50),
  windowSeconds: z.number().int().min(5).max(120),
});

export const updateGuildConfigSchema = z.object({
  antiraidEnabled: z.boolean().optional(),
  antiraidLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'EXTREME']).optional(),
  antinukeEnabled: z.boolean().optional(),
  logChannelId: z.string().nullable().optional(),
  raidThresholds: raidThresholdsSchema.optional(),
  antinukeThresholds: nukeThresholdsSchema.optional(),
});

// ─── Bot Activity ─────────────────────────────────────────────────────────────

export const botActivitySchema = z.object({
  type: z.enum(['PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'COMPETING']),
  name: z.string().min(1).max(128),
  url: z.string().url().optional(),
});

// ─── Whitelist ────────────────────────────────────────────────────────────────

export const whitelistAddSchema = z.object({
  targetId: z.string().regex(/^\d{17,20}$/, 'Must be a valid Discord ID'),
  type: z.enum(['USER', 'ROLE', 'BOT']),
});

export const whitelistRemoveSchema = z.object({
  targetId: z.string().regex(/^\d{17,20}$/, 'Must be a valid Discord ID'),
});

// ─── Pagination ───────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

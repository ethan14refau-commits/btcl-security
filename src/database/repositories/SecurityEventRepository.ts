import { SecurityEvent } from '@prisma/client';
import { prisma } from '../client.js';
import { SecuritySeverity, SecurityEventType } from '../../types/discord.js';

export interface CreateSecurityEventInput {
  guildId: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  actorId?: string;
  targetId?: string;
  action: string;
  details?: Record<string, unknown>;
}

/**
 * Create a new security event record.
 */
export async function createSecurityEvent(
  input: CreateSecurityEventInput
): Promise<SecurityEvent> {
  // Ensure guild exists
  await prisma.guild.upsert({
    where: { id: input.guildId },
    create: { id: input.guildId, name: 'Unknown' },
    update: {},
  });

  return prisma.securityEvent.create({
    data: {
      guildId: input.guildId,
      type: input.type,
      severity: input.severity,
      actorId: input.actorId,
      targetId: input.targetId,
      action: input.action,
      details: JSON.stringify(input.details ?? {}),
    },
  });
}

/**
 * Get recent security events for a guild, newest first.
 */
export async function getSecurityEvents(
  guildId: string,
  limit = 50,
  offset = 0
): Promise<SecurityEvent[]> {
  return prisma.securityEvent.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Get security event statistics for a guild.
 */
export async function getSecurityStats(guildId: string): Promise<{
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  last24h: number;
}> {
  const [total, events, last24h] = await Promise.all([
    prisma.securityEvent.count({ where: { guildId } }),
    prisma.securityEvent.findMany({ where: { guildId }, select: { type: true, severity: true } }),
    prisma.securityEvent.count({
      where: {
        guildId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const event of events) {
    byType[event.type] = (byType[event.type] ?? 0) + 1;
    bySeverity[event.severity] = (bySeverity[event.severity] ?? 0) + 1;
  }

  return { total, byType, bySeverity, last24h };
}

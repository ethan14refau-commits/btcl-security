import { ModerationCase } from '@prisma/client';
import { prisma } from '../client.js';
import { ModerationCaseType } from '../../types/discord.js';

export interface CreateCaseInput {
  guildId: string;
  type: ModerationCaseType;
  targetId: string;
  targetTag: string;
  moderatorId: string;
  moderatorTag: string;
  reason?: string;
  duration?: number;
}

/**
 * Get the next case number for a guild.
 */
async function getNextCaseNumber(guildId: string): Promise<number> {
  const last = await prisma.moderationCase.findFirst({
    where: { guildId },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  });
  return (last?.caseNumber ?? 0) + 1;
}

/**
 * Create a new moderation case.
 */
export async function createCase(input: CreateCaseInput): Promise<ModerationCase> {
  // Ensure guild exists
  await prisma.guild.upsert({
    where: { id: input.guildId },
    create: { id: input.guildId, name: 'Unknown' },
    update: {},
  });

  const caseNumber = await getNextCaseNumber(input.guildId);

  return prisma.moderationCase.create({
    data: {
      caseNumber,
      guildId: input.guildId,
      type: input.type,
      targetId: input.targetId,
      targetTag: input.targetTag,
      moderatorId: input.moderatorId,
      moderatorTag: input.moderatorTag,
      reason: input.reason,
      duration: input.duration,
    },
  });
}

/**
 * Get all cases for a target user in a guild.
 */
export async function getUserCases(
  guildId: string,
  targetId: string
): Promise<ModerationCase[]> {
  return prisma.moderationCase.findMany({
    where: { guildId, targetId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a specific case by case number.
 */
export async function getCaseByNumber(
  guildId: string,
  caseNumber: number
): Promise<ModerationCase | null> {
  return prisma.moderationCase.findFirst({
    where: { guildId, caseNumber },
  });
}

/**
 * Deactivate a case (e.g., when a ban is lifted).
 */
export async function deactivateCase(
  guildId: string,
  targetId: string,
  type: ModerationCaseType
): Promise<void> {
  await prisma.moderationCase.updateMany({
    where: { guildId, targetId, type, active: true },
    data: { active: false },
  });
}

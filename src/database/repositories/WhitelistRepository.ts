import { WhitelistEntry } from '@prisma/client';
import { prisma } from '../client.js';
import { WhitelistType } from '../../types/discord.js';

/**
 * Check whether a target ID is whitelisted in a guild.
 */
export async function isWhitelisted(guildId: string, targetId: string): Promise<boolean> {
  const entry = await prisma.whitelistEntry.findUnique({
    where: { guildId_targetId: { guildId, targetId } },
  });
  return entry !== null;
}

/**
 * Check whether any of a member's roles are whitelisted.
 */
export async function hasWhitelistedRole(
  guildId: string,
  roleIds: string[]
): Promise<boolean> {
  if (roleIds.length === 0) return false;
  const entry = await prisma.whitelistEntry.findFirst({
    where: {
      guildId,
      targetId: { in: roleIds },
      type: 'ROLE',
    },
  });
  return entry !== null;
}

/**
 * Add an entry to the whitelist.
 * Returns existing entry if already whitelisted.
 */
export async function addToWhitelist(
  guildId: string,
  targetId: string,
  type: WhitelistType,
  addedBy: string
): Promise<WhitelistEntry> {
  return prisma.whitelistEntry.upsert({
    where: { guildId_targetId: { guildId, targetId } },
    create: { guildId, targetId, type, addedBy },
    update: { type, addedBy },
  });
}

/**
 * Remove an entry from the whitelist.
 * Returns null if it didn't exist.
 */
export async function removeFromWhitelist(
  guildId: string,
  targetId: string
): Promise<WhitelistEntry | null> {
  try {
    return await prisma.whitelistEntry.delete({
      where: { guildId_targetId: { guildId, targetId } },
    });
  } catch {
    return null;
  }
}

/**
 * List all whitelist entries for a guild.
 */
export async function listWhitelist(guildId: string): Promise<WhitelistEntry[]> {
  return prisma.whitelistEntry.findMany({
    where: { guildId },
    orderBy: { addedAt: 'asc' },
  });
}

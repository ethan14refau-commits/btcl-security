import { BotOwner } from '@prisma/client';
import { prisma } from '../client.js';
import { ownerIds } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Check whether a Discord user ID is a Bot Owner.
 * Checks both the in-memory env list and the database.
 */
export async function isBotOwner(userId: string): Promise<boolean> {
  // Fast path: check env-loaded owners
  if (ownerIds.includes(userId)) return true;
  // DB check for dynamically added owners
  const entry = await prisma.botOwner.findUnique({ where: { userId } });
  return entry !== null;
}

/**
 * Get all current Bot Owners.
 */
export async function getAllOwners(): Promise<BotOwner[]> {
  return prisma.botOwner.findMany({ orderBy: { addedAt: 'asc' } });
}

/**
 * Add a new Bot Owner.
 * Throws if the user is already an owner.
 */
export async function addOwner(userId: string, addedBy: string): Promise<BotOwner> {
  return prisma.botOwner.create({
    data: { userId, addedBy },
  });
}

/**
 * Remove a Bot Owner by user ID.
 * Returns null if they weren't an owner.
 */
export async function removeOwner(userId: string): Promise<BotOwner | null> {
  try {
    return await prisma.botOwner.delete({ where: { userId } });
  } catch {
    return null;
  }
}

/**
 * Sync owners from OWNER_IDS env variable into the database on startup.
 * This ensures env-defined owners always exist in DB.
 */
export async function syncOwnersFromEnv(): Promise<void> {
  if (ownerIds.length === 0) {
    logger.warn('No OWNER_IDS defined in environment — no bot owners will be set');
    return;
  }

  for (const userId of ownerIds) {
    await prisma.botOwner.upsert({
      where: { userId },
      create: { userId, addedBy: 'ENV' },
      update: {},
    });
  }

  logger.info(`Synced ${ownerIds.length} owner(s) from environment`);
}

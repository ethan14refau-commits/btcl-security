import { GuildMember } from 'discord.js';
import {
  isWhitelisted,
  hasWhitelistedRole,
  addToWhitelist,
  removeFromWhitelist,
  listWhitelist,
} from '../../database/repositories/WhitelistRepository.js';
import { WhitelistType } from '../../types/discord.js';
import { WhitelistEntry } from '@prisma/client';

/**
 * Check whether a guild member is protected by the whitelist.
 * Checks user ID, all role IDs, and whether the user is a bot.
 */
export async function isMemberWhitelisted(member: GuildMember): Promise<boolean> {
  const guildId = member.guild.id;

  // Check user ID directly
  if (await isWhitelisted(guildId, member.id)) return true;

  // Check roles
  const roleIds = [...member.roles.cache.keys()];
  if (await hasWhitelistedRole(guildId, roleIds)) return true;

  return false;
}

/**
 * Check by raw ID (for use when we don't have a GuildMember object).
 */
export async function isIdWhitelisted(guildId: string, targetId: string): Promise<boolean> {
  return isWhitelisted(guildId, targetId);
}

/**
 * Add a target to the whitelist.
 */
export async function addWhitelistEntry(
  guildId: string,
  targetId: string,
  type: WhitelistType,
  addedBy: string
): Promise<WhitelistEntry> {
  return addToWhitelist(guildId, targetId, type, addedBy);
}

/**
 * Remove a target from the whitelist.
 */
export async function removeWhitelistEntry(
  guildId: string,
  targetId: string
): Promise<WhitelistEntry | null> {
  return removeFromWhitelist(guildId, targetId);
}

/**
 * Get all whitelist entries for a guild.
 */
export async function getWhitelistEntries(guildId: string): Promise<WhitelistEntry[]> {
  return listWhitelist(guildId);
}

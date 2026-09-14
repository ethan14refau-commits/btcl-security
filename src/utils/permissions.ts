import {
  GuildMember,
  PermissionResolvable,
  PermissionsBitField,
  TextChannel,
} from 'discord.js';
import { BotClient } from '../types/discord.js';

/**
 * Check whether a guild member has all the required permissions.
 */
export function memberHasPermissions(
  member: GuildMember,
  permissions: PermissionResolvable[]
): boolean {
  return permissions.every((perm) => member.permissions.has(perm));
}

/**
 * Check whether the bot member has all the required permissions in a guild.
 */
export function botHasPermissions(
  botMember: GuildMember,
  permissions: PermissionResolvable[]
): boolean {
  return permissions.every((perm) => botMember.permissions.has(perm));
}

/**
 * Check whether `executor` is above `target` in the role hierarchy.
 * Returns true if executor can moderate target.
 */
export function canModerate(executor: GuildMember, target: GuildMember): boolean {
  // Guild owner can moderate anyone
  if (executor.guild.ownerId === executor.id) return true;
  // Target is guild owner — untouchable
  if (target.guild.ownerId === target.id) return false;
  // Compare highest role positions
  return executor.roles.highest.position > target.roles.highest.position;
}

/**
 * Check whether the bot can moderate a target member.
 */
export async function botCanModerate(
  client: BotClient,
  target: GuildMember
): Promise<boolean> {
  const botMember = await target.guild.members.fetchMe();
  return canModerate(botMember, target);
}

/**
 * Return a human-readable list of missing permissions.
 */
export function getMissingPermissions(
  member: GuildMember,
  required: PermissionResolvable[]
): string[] {
  return required
    .filter((perm) => !member.permissions.has(perm))
    .map((perm) => {
      // Get flag name from the PermissionsBitField flags
      const flagKey = Object.entries(PermissionsBitField.Flags).find(
        ([, value]) => value === BigInt(perm as number)
      );
      return flagKey ? flagKey[0] : String(perm);
    });
}

/**
 * Check whether the bot has the required permissions in a specific text channel.
 */
export async function botHasChannelPermissions(
  channel: TextChannel,
  permissions: PermissionResolvable[]
): Promise<boolean> {
  const botMember = await channel.guild.members.fetchMe();
  const channelPerms = channel.permissionsFor(botMember);
  if (!channelPerms) return false;
  return permissions.every((perm) => channelPerms.has(perm));
}

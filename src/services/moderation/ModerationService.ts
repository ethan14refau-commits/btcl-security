import {
  Guild,
  GuildMember,
  User,
  TextChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { BotClient, ModerationCaseType } from '../../types/discord.js';
import { createCase } from '../../database/repositories/ModerationRepository.js';
import {
  logBan,
  logKick,
  logTimeout,
  logWarn,
  logUnban,
} from '../logging/LogService.js';
import { canModerate, botCanModerate } from '../../utils/permissions.js';
import { parseDuration, formatDuration } from '../../utils/time.js';
import { getUserCases } from '../../database/repositories/ModerationRepository.js';

export class ModerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModerationError';
  }
}

/**
 * Ban a guild member.
 */
export async function banMember(
  client: BotClient,
  guild: Guild,
  target: GuildMember | User,
  moderator: GuildMember,
  reason: string | null,
  deleteMessageDays = 0
): Promise<void> {
  const targetUser = target instanceof GuildMember ? target.user : target;
  const targetMember = target instanceof GuildMember ? target : null;

  // Hierarchy check
  if (targetMember) {
    if (!canModerate(moderator, targetMember)) {
      throw new ModerationError('You cannot ban this user — they are above you in the role hierarchy.');
    }
    if (!(await botCanModerate(client, targetMember))) {
      throw new ModerationError('I cannot ban this user — they are above me in the role hierarchy.');
    }
  }

  // DM user before ban
  try {
    await targetUser.send(`You have been **banned** from **${guild.name}**.\nReason: ${reason ?? 'No reason provided'}`);
  } catch { /* DM failed — proceed anyway */ }

  await guild.members.ban(targetUser, {
    reason: `${moderator.user.tag}: ${reason ?? 'No reason provided'}`,
    deleteMessageSeconds: deleteMessageDays * 86400,
  });

  await createCase({
    guildId: guild.id,
    type: 'BAN',
    targetId: targetUser.id,
    targetTag: targetUser.tag,
    moderatorId: moderator.id,
    moderatorTag: moderator.user.tag,
    reason: reason ?? undefined,
  });

  await logBan(client, guild, targetUser, moderator.user, reason);
}

/**
 * Kick a guild member.
 */
export async function kickMember(
  client: BotClient,
  guild: Guild,
  target: GuildMember,
  moderator: GuildMember,
  reason: string | null
): Promise<void> {
  if (!canModerate(moderator, target)) {
    throw new ModerationError('You cannot kick this user — they are above you in the role hierarchy.');
  }
  if (!(await botCanModerate(client, target))) {
    throw new ModerationError('I cannot kick this user — they are above me in the role hierarchy.');
  }

  try {
    await target.user.send(`You have been **kicked** from **${guild.name}**.\nReason: ${reason ?? 'No reason provided'}`);
  } catch { /* DM failed */ }

  await target.kick(`${moderator.user.tag}: ${reason ?? 'No reason provided'}`);

  await createCase({
    guildId: guild.id,
    type: 'KICK',
    targetId: target.id,
    targetTag: target.user.tag,
    moderatorId: moderator.id,
    moderatorTag: moderator.user.tag,
    reason: reason ?? undefined,
  });

  await logKick(client, guild.id, target.user, moderator.user, reason);
}

/**
 * Timeout a guild member for a duration.
 * durationStr: e.g. "10m", "2h", "1d"
 */
export async function timeoutMember(
  client: BotClient,
  guild: Guild,
  target: GuildMember,
  moderator: GuildMember,
  durationStr: string,
  reason: string | null
): Promise<number> {
  if (!canModerate(moderator, target)) {
    throw new ModerationError('You cannot timeout this user — they are above you in the role hierarchy.');
  }
  if (!(await botCanModerate(client, target))) {
    throw new ModerationError('I cannot timeout this user — they are above me in the role hierarchy.');
  }

  const ms = parseDuration(durationStr);
  if (!ms || ms <= 0) {
    throw new ModerationError('Invalid duration format. Use: 10m, 2h, 1d (max 28d).');
  }

  // Discord max timeout is 28 days
  const maxMs = 28 * 24 * 60 * 60 * 1000;
  if (ms > maxMs) {
    throw new ModerationError('Maximum timeout duration is 28 days.');
  }

  try {
    await target.user.send(`You have been **timed out** in **${guild.name}** for ${formatDuration(ms)}.\nReason: ${reason ?? 'No reason provided'}`);
  } catch { /* DM failed */ }

  await target.timeout(ms, `${moderator.user.tag}: ${reason ?? 'No reason provided'}`);

  await createCase({
    guildId: guild.id,
    type: 'TIMEOUT',
    targetId: target.id,
    targetTag: target.user.tag,
    moderatorId: moderator.id,
    moderatorTag: moderator.user.tag,
    reason: reason ?? undefined,
    duration: ms,
  });

  await logTimeout(client, guild.id, target.user, moderator.user, formatDuration(ms), reason);

  return ms;
}

/**
 * Remove a timeout from a member.
 */
export async function removetimeoutMember(
  client: BotClient,
  guild: Guild,
  target: GuildMember,
  moderator: GuildMember,
  reason: string | null
): Promise<void> {
  if (!canModerate(moderator, target)) {
    throw new ModerationError('You cannot untimeout this user — they are above you in the role hierarchy.');
  }

  await target.timeout(null, `${moderator.user.tag}: ${reason ?? 'Timeout removed'}`);

  await createCase({
    guildId: guild.id,
    type: 'UNTIMEOUT',
    targetId: target.id,
    targetTag: target.user.tag,
    moderatorId: moderator.id,
    moderatorTag: moderator.user.tag,
    reason: reason ?? undefined,
  });
}

/**
 * Issue a warning to a user.
 * Returns the total warning count for the user.
 */
export async function warnMember(
  client: BotClient,
  guild: Guild,
  target: GuildMember,
  moderator: GuildMember,
  reason: string
): Promise<number> {
  await createCase({
    guildId: guild.id,
    type: 'WARN',
    targetId: target.id,
    targetTag: target.user.tag,
    moderatorId: moderator.id,
    moderatorTag: moderator.user.tag,
    reason,
  });

  const cases = await getUserCases(guild.id, target.id);
  const warnCount = cases.filter((c) => c.type === 'WARN').length;

  try {
    await target.user.send(`⚠️ You have received a warning in **${guild.name}**.\nReason: ${reason}\nTotal warnings: ${warnCount}`);
  } catch { /* DM failed */ }

  await logWarn(client, guild.id, target.user, moderator.user, reason, warnCount);

  return warnCount;
}

/**
 * Unban a user.
 */
export async function unbanUser(
  client: BotClient,
  guild: Guild,
  userId: string,
  moderator: GuildMember,
  reason: string | null
): Promise<User> {
  const ban = await guild.bans.fetch(userId).catch(() => null);
  if (!ban) {
    throw new ModerationError('This user does not have an active ban.');
  }

  await guild.members.unban(userId, `${moderator.user.tag}: ${reason ?? 'No reason provided'}`);

  await createCase({
    guildId: guild.id,
    type: 'UNBAN',
    targetId: ban.user.id,
    targetTag: ban.user.tag,
    moderatorId: moderator.id,
    moderatorTag: moderator.user.tag,
    reason: reason ?? undefined,
  });

  await logUnban(client, guild, ban.user, moderator.user);

  return ban.user;
}

/**
 * Lock a text channel — deny SEND_MESSAGES for @everyone.
 */
export async function lockChannel(
  client: BotClient,
  channel: TextChannel,
  moderator: GuildMember,
  reason: string | null
): Promise<void> {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    SendMessages: false,
  }, { reason: `Locked by ${moderator.user.tag}: ${reason ?? 'No reason provided'}` });

  await createCase({
    guildId: channel.guild.id,
    type: 'LOCK',
    targetId: channel.id,
    targetTag: channel.name,
    moderatorId: moderator.id,
    moderatorTag: moderator.user.tag,
    reason: reason ?? undefined,
  });
}

/**
 * Unlock a text channel — restore SEND_MESSAGES for @everyone (or remove override).
 */
export async function unlockChannel(
  client: BotClient,
  channel: TextChannel,
  moderator: GuildMember,
  reason: string | null
): Promise<void> {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    SendMessages: null, // Reset to parent/default
  }, { reason: `Unlocked by ${moderator.user.tag}: ${reason ?? 'No reason provided'}` });

  await createCase({
    guildId: channel.guild.id,
    type: 'UNLOCK',
    targetId: channel.id,
    targetTag: channel.name,
    moderatorId: moderator.id,
    moderatorTag: moderator.user.tag,
    reason: reason ?? undefined,
  });
}

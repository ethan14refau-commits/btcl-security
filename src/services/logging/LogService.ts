import {
  TextChannel,
  EmbedBuilder,
  Guild,
  User,
  GuildMember,
  Message,
  Role,
  GuildChannel,
} from 'discord.js';
import { BotClient, SecuritySeverity } from '../../types/discord.js';
import { prisma } from '../../database/client.js';
import {
  moderationEmbed,
  securityEmbed,
  raidEmbed,
  nukeEmbed,
  lockdownEmbed,
  createEmbed,
} from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

/**
 * Send an embed to the configured log channel for a guild.
 * Silently ignores if no log channel is configured or channel is inaccessible.
 */
export async function sendLog(
  client: BotClient,
  guildId: string,
  embed: EmbedBuilder
): Promise<void> {
  try {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (!config?.logChannelId) return;

    const channel = await client.channels.fetch(config.logChannelId);
    if (!channel?.isTextBased()) return;

    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (err) {
    logger.warn(`Failed to send log to guild ${guildId}:`, err);
  }
}

// ─── Member Events ────────────────────────────────────────────────────────────

export async function logMemberJoin(client: BotClient, member: GuildMember): Promise<void> {
  const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
  const embed = createEmbed(0x57f287)
    .setTitle('📥 Member Joined')
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
      { name: 'Account Created', value: `<t:${accountCreated}:R>`, inline: true },
      { name: 'Member Count', value: member.guild.memberCount.toString(), inline: true }
    );
  await sendLog(client, member.guild.id, embed);
}

export async function logMemberLeave(client: BotClient, member: GuildMember): Promise<void> {
  const embed = createEmbed(0xed4245)
    .setTitle('📤 Member Left')
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
      { name: 'Member Count', value: member.guild.memberCount.toString(), inline: true }
    );
  await sendLog(client, member.guild.id, embed);
}

// ─── Moderation Events ─────────────────────────────────────────────────────────

export async function logBan(
  client: BotClient,
  guild: Guild,
  target: User,
  moderator: User | null,
  reason: string | null
): Promise<void> {
  const embed = createEmbed(0xed4245)
    .setTitle('🔨 Member Banned')
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Moderator', value: moderator ? `${moderator.tag} (${moderator.id})` : 'Unknown', inline: true },
      { name: 'Reason', value: reason ?? 'No reason provided', inline: false }
    );
  await sendLog(client, guild.id, embed);
}

export async function logUnban(
  client: BotClient,
  guild: Guild,
  target: User,
  moderator: User | null
): Promise<void> {
  const embed = createEmbed(0x57f287)
    .setTitle('✅ Member Unbanned')
    .addFields(
      { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Moderator', value: moderator ? `${moderator.tag}` : 'Unknown', inline: true }
    );
  await sendLog(client, guild.id, embed);
}

export async function logKick(
  client: BotClient,
  guildId: string,
  target: User,
  moderator: User,
  reason: string | null
): Promise<void> {
  const embed = createEmbed(0xfee75c)
    .setTitle('👢 Member Kicked')
    .addFields(
      { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Moderator', value: `${moderator.tag}`, inline: true },
      { name: 'Reason', value: reason ?? 'No reason provided', inline: false }
    );
  await sendLog(client, guildId, embed);
}

export async function logTimeout(
  client: BotClient,
  guildId: string,
  target: User,
  moderator: User,
  duration: string,
  reason: string | null
): Promise<void> {
  const embed = createEmbed(0xfee75c)
    .setTitle('⏰ Member Timed Out')
    .addFields(
      { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Moderator', value: `${moderator.tag}`, inline: true },
      { name: 'Duration', value: duration, inline: true },
      { name: 'Reason', value: reason ?? 'No reason provided', inline: false }
    );
  await sendLog(client, guildId, embed);
}

export async function logWarn(
  client: BotClient,
  guildId: string,
  target: User,
  moderator: User,
  reason: string,
  warnCount: number
): Promise<void> {
  const embed = createEmbed(0xfee75c)
    .setTitle('⚠️ Warning Issued')
    .addFields(
      { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Moderator', value: `${moderator.tag}`, inline: true },
      { name: 'Total Warnings', value: warnCount.toString(), inline: true },
      { name: 'Reason', value: reason, inline: false }
    );
  await sendLog(client, guildId, embed);
}

// ─── Message Events ────────────────────────────────────────────────────────────

export async function logMessageDelete(
  client: BotClient,
  message: Message
): Promise<void> {
  if (!message.guild || message.author.bot) return;
  const embed = createEmbed(0xff6b6b)
    .setTitle('🗑️ Message Deleted')
    .addFields(
      { name: 'Author', value: `${message.author.tag} (${message.author.id})`, inline: true },
      { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
      { name: 'Content', value: message.content.slice(0, 1000) || '[no text content]', inline: false }
    );
  await sendLog(client, message.guild.id, embed);
}

export async function logMessageEdit(
  client: BotClient,
  oldMessage: Message,
  newMessage: Message
): Promise<void> {
  if (!oldMessage.guild || oldMessage.author.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const embed = createEmbed(0xffa500)
    .setTitle('✏️ Message Edited')
    .setURL(newMessage.url)
    .addFields(
      { name: 'Author', value: `${oldMessage.author.tag} (${oldMessage.author.id})`, inline: true },
      { name: 'Channel', value: `<#${oldMessage.channelId}>`, inline: true },
      { name: 'Before', value: oldMessage.content.slice(0, 500) || '[empty]', inline: false },
      { name: 'After', value: newMessage.content.slice(0, 500) || '[empty]', inline: false }
    );
  await sendLog(client, oldMessage.guild.id, embed);
}

// ─── Role Events ───────────────────────────────────────────────────────────────

export async function logRoleCreate(
  client: BotClient,
  role: Role
): Promise<void> {
  const embed = createEmbed(0x57f287)
    .setTitle('✅ Role Created')
    .addFields(
      { name: 'Role', value: `${role.name} (${role.id})`, inline: true },
      { name: 'Color', value: role.hexColor, inline: true }
    );
  await sendLog(client, role.guild.id, embed);
}

export async function logRoleDelete(
  client: BotClient,
  role: Role
): Promise<void> {
  const embed = createEmbed(0xed4245)
    .setTitle('❌ Role Deleted')
    .addFields({ name: 'Role', value: `${role.name} (${role.id})`, inline: true });
  await sendLog(client, role.guild.id, embed);
}

// ─── Channel Events ────────────────────────────────────────────────────────────

export async function logChannelCreate(
  client: BotClient,
  channel: GuildChannel
): Promise<void> {
  const embed = createEmbed(0x57f287)
    .setTitle('✅ Channel Created')
    .addFields(
      { name: 'Channel', value: `<#${channel.id}> (${channel.name})`, inline: true },
      { name: 'Type', value: channel.type.toString(), inline: true }
    );
  await sendLog(client, channel.guild.id, embed);
}

export async function logChannelDelete(
  client: BotClient,
  channel: GuildChannel
): Promise<void> {
  const embed = createEmbed(0xed4245)
    .setTitle('❌ Channel Deleted')
    .addFields(
      { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: true },
      { name: 'Type', value: channel.type.toString(), inline: true }
    );
  await sendLog(client, channel.guild.id, embed);
}

// ─── Security Events ───────────────────────────────────────────────────────────

export async function logRaidDetected(
  client: BotClient,
  guildId: string,
  guildName: string,
  joinCount: number,
  windowSeconds: number,
  action: string,
  members: string[]
): Promise<void> {
  const embed = raidEmbed(guildName, joinCount, windowSeconds, action, [
    { name: 'Affected Members', value: `${members.length} user(s)`, inline: true },
  ]);
  await sendLog(client, guildId, embed);
}

export async function logNukeDetected(
  client: BotClient,
  guildId: string,
  guildName: string,
  eventType: string,
  count: number,
  actorTag: string,
  action: string
): Promise<void> {
  const embed = nukeEmbed(guildName, eventType, count, actorTag, action);
  await sendLog(client, guildId, embed);
}

export async function logSecurityEvent(
  client: BotClient,
  guildId: string,
  title: string,
  description: string,
  severity: SecuritySeverity,
  fields?: { name: string; value: string; inline?: boolean }[]
): Promise<void> {
  const embed = securityEmbed(title, description, severity, fields);
  await sendLog(client, guildId, embed);
}

export async function logLockdown(
  client: BotClient,
  guildId: string,
  guildName: string,
  started: boolean,
  reason?: string,
  channelName?: string
): Promise<void> {
  const embed = lockdownEmbed(guildName, started, reason, channelName);
  await sendLog(client, guildId, embed);
}

export async function logConfigChange(
  client: BotClient,
  guildId: string,
  changedBy: User,
  setting: string,
  oldValue: string,
  newValue: string
): Promise<void> {
  const embed = createEmbed(0x5865f2)
    .setTitle('⚙️ Configuration Changed')
    .addFields(
      { name: 'Changed By', value: `${changedBy.tag}`, inline: true },
      { name: 'Setting', value: setting, inline: true },
      { name: 'Old Value', value: oldValue, inline: true },
      { name: 'New Value', value: newValue, inline: true }
    );
  await sendLog(client, guildId, embed);
}

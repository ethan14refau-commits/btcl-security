import {
  EmbedBuilder,
  ColorResolvable,
  User,
  GuildMember,
  APIEmbedField,
} from 'discord.js';
import { SecuritySeverity } from '../types/discord.js';

const COLORS = {
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x5865f2,
  moderation: 0xeb459e,
  security: 0xff4444,
  raid: 0xff6600,
  nuke: 0xff0000,
  log: 0x99aab5,
  lockdown: 0xc0392b,
} as const;

const SEVERITY_COLORS: Record<SecuritySeverity, ColorResolvable> = {
  INFO: COLORS.info,
  LOW: COLORS.warning,
  MEDIUM: 0xf39c12,
  HIGH: COLORS.raid,
  CRITICAL: COLORS.nuke,
};

export function createEmbed(color: ColorResolvable = COLORS.info): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTimestamp();
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const embed = createEmbed(COLORS.success).setTitle(`✅ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = createEmbed(COLORS.error).setTitle(`❌ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function warningEmbed(title: string, description?: string): EmbedBuilder {
  const embed = createEmbed(COLORS.warning).setTitle(`⚠️ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = createEmbed(COLORS.info).setTitle(`ℹ️ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function moderationEmbed(
  action: string,
  target: User | GuildMember,
  moderator: User | GuildMember,
  reason: string | null,
  fields?: APIEmbedField[]
): EmbedBuilder {
  const targetUser = target instanceof GuildMember ? target.user : target;
  const modUser = moderator instanceof GuildMember ? moderator.user : moderator;

  return createEmbed(COLORS.moderation)
    .setTitle(`🔨 ${action}`)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: 'Target', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
      { name: 'Moderator', value: `${modUser.tag} (${modUser.id})`, inline: true },
      { name: 'Reason', value: reason ?? 'No reason provided', inline: false },
      ...(fields ?? [])
    );
}

export function securityEmbed(
  title: string,
  description: string,
  severity: SecuritySeverity,
  fields?: APIEmbedField[]
): EmbedBuilder {
  const severityLabel: Record<SecuritySeverity, string> = {
    INFO: '🔵 INFO',
    LOW: '🟡 LOW',
    MEDIUM: '🟠 MEDIUM',
    HIGH: '🔴 HIGH',
    CRITICAL: '💀 CRITICAL',
  };

  return createEmbed(SEVERITY_COLORS[severity])
    .setTitle(`🛡️ ${title}`)
    .setDescription(description)
    .addFields(
      { name: 'Severity', value: severityLabel[severity], inline: true },
      ...(fields ?? [])
    );
}

export function raidEmbed(
  guildName: string,
  joinCount: number,
  windowSeconds: number,
  action: string,
  fields?: APIEmbedField[]
): EmbedBuilder {
  return createEmbed(COLORS.raid)
    .setTitle('🚨 RAID DETECTED')
    .setDescription(`**${joinCount}** joins in **${windowSeconds}s** on **${guildName}**`)
    .addFields(
      { name: 'Action Taken', value: action, inline: true },
      ...(fields ?? [])
    );
}

export function nukeEmbed(
  guildName: string,
  eventType: string,
  count: number,
  actorTag: string,
  action: string
): EmbedBuilder {
  return createEmbed(COLORS.nuke)
    .setTitle('☢️ NUKE DETECTED')
    .setDescription(`Suspicious mass action detected on **${guildName}**`)
    .addFields(
      { name: 'Event Type', value: eventType, inline: true },
      { name: 'Count', value: count.toString(), inline: true },
      { name: 'Actor', value: actorTag, inline: true },
      { name: 'Action Taken', value: action, inline: false }
    );
}

export function lockdownEmbed(
  guildName: string,
  started: boolean,
  reason?: string,
  channelName?: string
): EmbedBuilder {
  return createEmbed(started ? COLORS.lockdown : COLORS.success)
    .setTitle(started ? '🔒 LOCKDOWN ACTIVATED' : '🔓 LOCKDOWN LIFTED')
    .setDescription(started
      ? `Server **${guildName}** has been locked down.`
      : `Lockdown on **${guildName}** has been lifted.`)
    .addFields(
      ...(reason ? [{ name: 'Reason', value: reason, inline: false }] : []),
      ...(channelName ? [{ name: 'Scope', value: channelName, inline: true }] : [])
    );
}

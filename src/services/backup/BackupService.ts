import {
  Guild,
  ChannelType,
  PermissionOverwriteType,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
  ForumChannel,
  StageChannel,
  NewsChannel,
  Role,
  GuildChannel,
  OverwriteResolvable,
  PermissionsBitField,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { logger } from '../../utils/logger.js';
import { BotClient } from '../../types/discord.js';

// ─── Backup data structures ───────────────────────────────────────────────────

export interface BackupRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string; // BigInt as string
  position: number;
  managed: boolean;
}

export interface BackupPermissionOverwrite {
  id: string;
  type: number; // 0 = role, 1 = member
  allow: string;
  deny: string;
}

export interface BackupChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId: string | null;
  topic: string | null;
  nsfw: boolean;
  rateLimitPerUser: number;
  bitrate?: number;
  userLimit?: number;
  permissionOverwrites: BackupPermissionOverwrite[];
}

export interface BackupEmoji {
  id: string | null;
  name: string;
  animated: boolean;
  url: string;
}

export interface BackupBotConfig {
  antiraidEnabled: boolean;
  antiraidLevel: string;
  antinukeEnabled: boolean;
  logChannelId: string | null;
  welcomeChannelId: string | null;
  raidThresholds: unknown;
  antinukeThresholds: unknown;
  autoRoles: string[];
  whitelist: { targetId: string; type: string }[];
}

export interface BackupData {
  version: '1';
  createdAt: string;
  guild: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    banner: string | null;
    verificationLevel: number;
    defaultMessageNotifications: number;
    explicitContentFilter: number;
    preferredLocale: string;
    afkTimeout: number;
  };
  roles: BackupRole[];
  channels: BackupChannel[];
  emojis: BackupEmoji[];
  botConfig: BackupBotConfig | null;
}

// ─── Create backup ────────────────────────────────────────────────────────────

export async function createBackup(
  client: BotClient,
  guild: Guild,
  createdBy: string
): Promise<string> {
  logger.info(`[Backup] Creating backup for guild ${guild.name} (${guild.id})`);

  // Fetch all data
  const [roles, channels, emojis] = await Promise.all([
    guild.roles.fetch(),
    guild.channels.fetch(),
    guild.emojis.fetch(),
  ]);

  // ─── Roles ───────────────────────────────────────────────────────────────
  const backupRoles: BackupRole[] = [];
  for (const [, role] of roles) {
    if (!role || role.managed) continue; // skip bot-managed roles
    backupRoles.push({
      id: role.id,
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.bitfield.toString(),
      position: role.position,
      managed: role.managed,
    });
  }
  backupRoles.sort((a, b) => a.position - b.position);

  // ─── Channels ─────────────────────────────────────────────────────────────
  const backupChannels: BackupChannel[] = [];
  for (const [, channel] of channels) {
    if (!channel) continue;
    const guildChannel = channel as GuildChannel;

    const permOverwrites: BackupPermissionOverwrite[] = [];
    if ('permissionOverwrites' in guildChannel) {
      for (const [, overwrite] of guildChannel.permissionOverwrites.cache) {
        permOverwrites.push({
          id: overwrite.id,
          type: overwrite.type,
          allow: overwrite.allow.bitfield.toString(),
          deny: overwrite.deny.bitfield.toString(),
        });
      }
    }

    const channelData: BackupChannel = {
      id: guildChannel.id,
      name: guildChannel.name,
      type: guildChannel.type,
      position: 'position' in guildChannel ? (guildChannel.position as number) : 0,
      parentId: 'parentId' in guildChannel ? (guildChannel.parentId as string | null) : null,
      topic: ('topic' in guildChannel ? (guildChannel as TextChannel).topic : null) ?? null,
      nsfw: 'nsfw' in guildChannel ? (guildChannel as TextChannel).nsfw : false,
      rateLimitPerUser: 'rateLimitPerUser' in guildChannel ? (guildChannel as TextChannel).rateLimitPerUser : 0,
      permissionOverwrites: permOverwrites,
    };

    if (guildChannel.type === ChannelType.GuildVoice || guildChannel.type === ChannelType.GuildStageVoice) {
      channelData.bitrate = (guildChannel as VoiceChannel).bitrate;
      channelData.userLimit = (guildChannel as VoiceChannel).userLimit;
    }

    backupChannels.push(channelData);
  }
  backupChannels.sort((a, b) => a.position - b.position);

  // ─── Emojis ───────────────────────────────────────────────────────────────
  const backupEmojis: BackupEmoji[] = [];
  for (const [, emoji] of emojis) {
    if (!emoji) continue;
    backupEmojis.push({
      id: emoji.id,
      name: emoji.name ?? 'unknown',
      animated: emoji.animated ?? false,
      url: emoji.url,
    });
  }

  // ─── Bot config ───────────────────────────────────────────────────────────
  let botConfig: BackupBotConfig | null = null;
  try {
    const config = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } });
    const autoRoles = await prisma.autoRole.findMany({ where: { guildId: guild.id } });
    const whitelist = await prisma.whitelistEntry.findMany({ where: { guildId: guild.id } });

    if (config) {
      botConfig = {
        antiraidEnabled: config.antiraidEnabled,
        antiraidLevel: config.antiraidLevel,
        antinukeEnabled: config.antinukeEnabled,
        logChannelId: config.logChannelId,
        welcomeChannelId: config.welcomeChannelId,
        raidThresholds: JSON.parse(config.raidThresholds) as unknown,
        antinukeThresholds: JSON.parse(config.antinukeThresholds) as unknown,
        autoRoles: autoRoles.map((r) => r.roleId),
        whitelist: whitelist.map((w) => ({ targetId: w.targetId, type: w.type })),
      };
    }
  } catch (err) {
    logger.warn('[Backup] Could not fetch bot config:', err);
  }

  // ─── Assemble backup data ─────────────────────────────────────────────────
  const data: BackupData = {
    version: '1',
    createdAt: new Date().toISOString(),
    guild: {
      id: guild.id,
      name: guild.name,
      description: guild.description,
      icon: guild.iconURL({ size: 256 }),
      banner: guild.bannerURL({ size: 256 }),
      verificationLevel: guild.verificationLevel,
      defaultMessageNotifications: guild.defaultMessageNotifications,
      explicitContentFilter: guild.explicitContentFilter,
      preferredLocale: guild.preferredLocale,
      afkTimeout: guild.afkTimeout,
    },
    roles: backupRoles,
    channels: backupChannels,
    emojis: backupEmojis,
    botConfig,
  };

  const json = JSON.stringify(data);
  const size = Buffer.byteLength(json, 'utf8');

  // Save to database
  const backup = await prisma.serverBackup.create({
    data: {
      guildId: guild.id,
      guildName: guild.name,
      createdBy,
      data: json,
      size,
    },
  });

  logger.info(`[Backup] Created backup ${backup.id} for ${guild.name} (${size} bytes, ${backupChannels.length} channels, ${backupRoles.length} roles)`);
  return backup.id;
}

// ─── List backups ─────────────────────────────────────────────────────────────

export async function listBackups(guildId: string) {
  return prisma.serverBackup.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      guildName: true,
      createdBy: true,
      size: true,
      createdAt: true,
      // Don't select data — too large
    },
  });
}

// ─── Get backup info ──────────────────────────────────────────────────────────

export async function getBackupInfo(backupId: string) {
  const backup = await prisma.serverBackup.findUnique({
    where: { id: backupId },
    select: { id: true, guildId: true, guildName: true, createdBy: true, size: true, createdAt: true },
  });
  return backup;
}

// ─── Delete backup ────────────────────────────────────────────────────────────

export async function deleteBackup(backupId: string, guildId: string): Promise<boolean> {
  const backup = await prisma.serverBackup.findFirst({
    where: { id: backupId, guildId },
  });
  if (!backup) return false;
  await prisma.serverBackup.delete({ where: { id: backupId } });
  return true;
}

// ─── Load / Restore backup ───────────────────────────────────────────────────

export async function loadBackup(
  client: BotClient,
  guild: Guild,
  backupId: string,
  options: { restoreRoles?: boolean; restoreChannels?: boolean; restoreBotConfig?: boolean } = {}
): Promise<{ restored: string[]; errors: string[] }> {
  const { restoreRoles = true, restoreChannels = true, restoreBotConfig = true } = options;
  const restored: string[] = [];
  const errors: string[] = [];

  const backupRecord = await prisma.serverBackup.findFirst({
    where: { id: backupId, guildId: guild.id },
  });

  if (!backupRecord) {
    throw new Error(`Backup ${backupId} not found for this guild.`);
  }

  const data = JSON.parse(backupRecord.data) as BackupData;
  logger.info(`[Backup] Loading backup ${backupId} into ${guild.name}`);

  // ─── Restore Roles ────────────────────────────────────────────────────────
  if (restoreRoles) {
    const roleIdMap = new Map<string, string>(); // old ID → new ID

    for (const roleData of data.roles) {
      if (roleData.name === '@everyone') continue;
      try {
        // Check if role with same name already exists
        const existing = guild.roles.cache.find((r) => r.name === roleData.name && !r.managed);
        if (existing) {
          roleIdMap.set(roleData.id, existing.id);
          restored.push(`Rôle existant conservé: ${roleData.name}`);
          continue;
        }

        const newRole = await guild.roles.create({
          name: roleData.name,
          color: roleData.color,
          hoist: roleData.hoist,
          mentionable: roleData.mentionable,
          permissions: BigInt(roleData.permissions),
          reason: `[Backup] Restore from ${backupId}`,
        });
        roleIdMap.set(roleData.id, newRole.id);
        restored.push(`Rôle créé: ${roleData.name}`);
      } catch (err) {
        errors.push(`Rôle ${roleData.name}: ${String(err)}`);
      }
    }

    // Store role ID map for channel permission restoration
    (guild as unknown as { _backupRoleMap?: Map<string, string> })._backupRoleMap = roleIdMap;
  }

  // ─── Restore Channels ─────────────────────────────────────────────────────
  if (restoreChannels) {
    const roleIdMap = (guild as unknown as { _backupRoleMap?: Map<string, string> })._backupRoleMap ?? new Map();
    const channelIdMap = new Map<string, string>(); // old ID → new ID

    // First pass: create categories
    const categories = data.channels.filter((c) => c.type === ChannelType.GuildCategory);
    for (const catData of categories) {
      try {
        const existing = guild.channels.cache.find(
          (ch) => ch.name === catData.name && ch.type === ChannelType.GuildCategory
        );
        if (existing) {
          channelIdMap.set(catData.id, existing.id);
          continue;
        }

        const newCat = await guild.channels.create({
          name: catData.name,
          type: ChannelType.GuildCategory,
          position: catData.position,
          reason: `[Backup] Restore from ${backupId}`,
        });
        channelIdMap.set(catData.id, newCat.id);
        restored.push(`Catégorie créée: ${catData.name}`);
      } catch (err) {
        errors.push(`Catégorie ${catData.name}: ${String(err)}`);
      }
    }

    // Second pass: create other channels
    const nonCategories = data.channels.filter((c) => c.type !== ChannelType.GuildCategory);
    for (const chData of nonCategories) {
      try {
        const existing = guild.channels.cache.find(
          (ch) => ch.name === chData.name && ch.type === chData.type
        );
        if (existing) {
          channelIdMap.set(chData.id, existing.id);
          continue;
        }

        // Map old parent ID to new parent ID
        const newParentId = chData.parentId ? (channelIdMap.get(chData.parentId) ?? chData.parentId) : undefined;

        // Map permission overwrites to new role IDs
        const permissionOverwrites: OverwriteResolvable[] = chData.permissionOverwrites.map((ow) => ({
          id: roleIdMap.get(ow.id) ?? ow.id,
          type: ow.type as PermissionOverwriteType,
          allow: BigInt(ow.allow),
          deny: BigInt(ow.deny),
        }));

        const channelOptions: Parameters<Guild['channels']['create']>[0] = {
          name: chData.name,
          type: chData.type as ChannelType,
          position: chData.position,
          parent: newParentId,
          topic: chData.topic ?? undefined,
          nsfw: chData.nsfw,
          rateLimitPerUser: chData.rateLimitPerUser,
          permissionOverwrites,
          reason: `[Backup] Restore from ${backupId}`,
        };

        if (chData.type === ChannelType.GuildVoice || chData.type === ChannelType.GuildStageVoice) {
          (channelOptions as { bitrate?: number; userLimit?: number }).bitrate = chData.bitrate;
          (channelOptions as { bitrate?: number; userLimit?: number }).userLimit = chData.userLimit;
        }

        const newChannel = await guild.channels.create(channelOptions);
        channelIdMap.set(chData.id, newChannel.id);
        restored.push(`Salon créé: ${chData.name}`);
      } catch (err) {
        errors.push(`Salon ${chData.name}: ${String(err)}`);
      }
    }
  }

  // ─── Restore Bot Config ───────────────────────────────────────────────────
  if (restoreBotConfig && data.botConfig) {
    try {
      await prisma.guildConfig.upsert({
        where: { guildId: guild.id },
        create: {
          guildId: guild.id,
          antiraidEnabled: data.botConfig.antiraidEnabled,
          antiraidLevel: data.botConfig.antiraidLevel,
          antinukeEnabled: data.botConfig.antinukeEnabled,
          raidThresholds: JSON.stringify(data.botConfig.raidThresholds),
          antinukeThresholds: JSON.stringify(data.botConfig.antinukeThresholds),
        },
        update: {
          antiraidEnabled: data.botConfig.antiraidEnabled,
          antiraidLevel: data.botConfig.antiraidLevel,
          antinukeEnabled: data.botConfig.antinukeEnabled,
          raidThresholds: JSON.stringify(data.botConfig.raidThresholds),
          antinukeThresholds: JSON.stringify(data.botConfig.antinukeThresholds),
        },
      });
      restored.push('Configuration bot restaurée');
    } catch (err) {
      errors.push(`Config bot: ${String(err)}`);
    }
  }

  logger.info(`[Backup] Loaded backup ${backupId}: ${restored.length} restored, ${errors.length} errors`);
  return { restored, errors };
}

// ─── Export backup as JSON file ───────────────────────────────────────────────

export async function exportBackupAsFile(backupId: string, guildId: string): Promise<{ data: string; filename: string } | null> {
  const backup = await prisma.serverBackup.findFirst({
    where: { id: backupId, guildId },
  });
  if (!backup) return null;

  return {
    data: backup.data,
    filename: `backup_${backup.guildName.replace(/[^a-z0-9]/gi, '_')}_${backupId.slice(0, 8)}.json`,
  };
}

// ─── Format file size ─────────────────────────────────────────────────────────

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

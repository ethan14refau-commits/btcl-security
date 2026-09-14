import { Guild, GuildConfig, Prisma } from '@prisma/client';
import { prisma } from '../client.js';

type RaidThresholds = {
  joins10s: number;
  joins30s: number;
  joins2m: number;
  newAccountAgeDays: number;
  mentionSpamCount: number;
};

type NukeThresholds = {
  channelDelete: number;
  channelCreate: number;
  roleDelete: number;
  roleCreate: number;
  banCount: number;
  kickCount: number;
  webhookCreate: number;
  windowSeconds: number;
};

export type GuildWithConfig = Guild & { config: GuildConfig | null };

/**
 * Ensure a Guild record exists, creating it if necessary.
 */
export async function ensureGuild(id: string, name: string): Promise<Guild> {
  return prisma.guild.upsert({
    where: { id },
    create: { id, name },
    update: { name },
  });
}

/**
 * Get a guild with its config. Creates config if missing.
 */
export async function getGuildWithConfig(guildId: string): Promise<GuildWithConfig> {
  let guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: { config: true },
  });

  if (!guild) {
    guild = await prisma.guild.create({
      data: {
        id: guildId,
        name: 'Unknown Guild',
        config: { create: {} },
      },
      include: { config: true },
    });
  } else if (!guild.config) {
    await prisma.guildConfig.create({ data: { guildId } });
    guild = await prisma.guild.findUniqueOrThrow({
      where: { id: guildId },
      include: { config: true },
    });
  }

  return guild as GuildWithConfig;
}

/**
 * Get parsed raid thresholds for a guild.
 */
export async function getRaidThresholds(guildId: string): Promise<RaidThresholds> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config) return JSON.parse('{"joins10s":10,"joins30s":20,"joins2m":50,"newAccountAgeDays":7,"mentionSpamCount":10}') as RaidThresholds;
  return JSON.parse(config.raidThresholds) as RaidThresholds;
}

/**
 * Get parsed nuke thresholds for a guild.
 */
export async function getNukeThresholds(guildId: string): Promise<NukeThresholds> {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config) return JSON.parse('{"channelDelete":5,"channelCreate":5,"roleDelete":5,"roleCreate":5,"banCount":5,"kickCount":5,"webhookCreate":3,"windowSeconds":10}') as NukeThresholds;
  return JSON.parse(config.antinukeThresholds) as NukeThresholds;
}

/**
 * Update guild config with a partial update.
 */
export async function updateGuildConfig(
  guildId: string,
  data: Prisma.GuildConfigUpdateInput
): Promise<GuildConfig> {
  return prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId, ...(data as Prisma.GuildConfigCreateInput) },
    update: data,
  });
}

export { RaidThresholds, NukeThresholds };

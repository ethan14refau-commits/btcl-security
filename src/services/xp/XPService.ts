import { Message, TextChannel, EmbedBuilder } from 'discord.js';
import { prisma } from '../../database/client.js';
import { BotClient } from '../../types/discord.js';
import { logger } from '../../utils/logger.js';

/** XP cooldown tracking: Map<guildId_userId, lastMessageTimestamp> */
const xpCooldowns = new Map<string, number>();

/** XP needed to reach a given level: 5n² + 50n + 100 */
export function xpForLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

/** Total XP needed to reach a level from level 0 */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += xpForLevel(i);
  return total;
}

/** Get or create a LevelConfig for a guild */
async function getLevelConfig(guildId: string) {
  let config = await prisma.levelConfig.findUnique({ where: { guildId } });
  if (!config) {
    config = await prisma.levelConfig.create({ data: { guildId } });
  }
  return config;
}

/** Handle XP gain on message */
export async function handleMessage(client: BotClient, message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  const config = await getLevelConfig(guildId);
  if (!config.enabled) return;

  // Check excluded channels
  const excludedChannels = JSON.parse(config.excludedChannels) as string[];
  if (excludedChannels.includes(message.channelId)) return;

  // Check excluded roles
  const member = await message.guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const excludedRoles = JSON.parse(config.excludedRoles) as string[];
  if (excludedRoles.some((roleId) => member.roles.cache.has(roleId))) return;

  // Check cooldown
  const cooldownKey = `${guildId}_${userId}`;
  const lastMessage = xpCooldowns.get(cooldownKey) ?? 0;
  const now = Date.now();
  if (now - lastMessage < config.xpCooldownSecs * 1000) return;
  xpCooldowns.set(cooldownKey, now);

  // Award XP (base ± 5 random)
  const xpGained = config.xpPerMessage + Math.floor(Math.random() * 11) - 5;
  const safeXp = Math.max(1, xpGained);

  // Get or create user level
  let userLevel = await prisma.userLevel.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  if (!userLevel) {
    userLevel = await prisma.userLevel.create({
      data: { guildId, userId, xp: safeXp, level: 0, messages: 1 },
    });
  } else {
    userLevel = await prisma.userLevel.update({
      where: { guildId_userId: { guildId, userId } },
      data: { xp: userLevel.xp + safeXp, messages: userLevel.messages + 1 },
    });
  }

  // Check for level up
  const newLevel = calculateLevel(userLevel.xp);
  if (newLevel > userLevel.level) {
    await prisma.userLevel.update({
      where: { guildId_userId: { guildId, userId } },
      data: { level: newLevel },
    });

    // Send level up message
    await sendLevelUp(client, message, newLevel, guildId, config.levelUpChannelId);

    // Assign level role rewards
    await assignLevelRoles(client, member, newLevel, JSON.parse(config.levelRoles) as { level: number; roleId: string }[]);
  }
}

/** Calculate level from total XP */
export function calculateLevel(xp: number): number {
  let level = 0;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
  }
  return level;
}

/** Send level up notification */
async function sendLevelUp(
  client: BotClient,
  message: Message,
  newLevel: number,
  guildId: string,
  levelUpChannelId: string | null
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('⬆️ Level Up !')
    .setDescription(`Félicitations ${message.author.toString()} ! Tu as atteint le **niveau ${newLevel}** ! 🎉`)
    .setThumbnail(message.author.displayAvatarURL())
    .setTimestamp();

  try {
    let targetChannel: TextChannel;
    if (levelUpChannelId) {
      const ch = await client.channels.fetch(levelUpChannelId).catch(() => null);
      targetChannel = (ch as TextChannel) ?? (message.channel as TextChannel);
    } else {
      targetChannel = message.channel as TextChannel;
    }
    await targetChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn('[XP] Failed to send level up message:', err);
  }
}

/** Assign role rewards for reaching a level */
async function assignLevelRoles(
  client: BotClient,
  member: import('discord.js').GuildMember,
  level: number,
  levelRoles: { level: number; roleId: string }[]
): Promise<void> {
  for (const reward of levelRoles) {
    if (level >= reward.level) {
      const role = member.guild.roles.cache.get(reward.roleId);
      if (role && !member.roles.cache.has(reward.roleId)) {
        await member.roles.add(role, `Level ${reward.level} reward`).catch(() => {});
      }
    }
  }
}

/** Get rank position for a user in a guild */
export async function getRankPosition(guildId: string, userId: string): Promise<number> {
  const count = await prisma.userLevel.count({
    where: { guildId, xp: { gt: (await prisma.userLevel.findUnique({ where: { guildId_userId: { guildId, userId } } }))?.xp ?? 0 } },
  });
  return count + 1;
}

/** Get leaderboard for a guild */
export async function getLeaderboard(guildId: string, limit = 10) {
  return prisma.userLevel.findMany({
    where: { guildId },
    orderBy: { xp: 'desc' },
    take: limit,
  });
}

/** Get or create user level entry */
export async function getUserLevel(guildId: string, userId: string) {
  return prisma.userLevel.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId },
    update: {},
  });
}

export { getLevelConfig };

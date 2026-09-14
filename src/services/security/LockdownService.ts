import { Guild, PermissionFlagsBits, ChannelType, TextChannel } from 'discord.js';
import { BotClient } from '../../types/discord.js';
import { prisma } from '../../database/client.js';
import { logLockdown } from '../logging/LogService.js';
import { createSecurityEvent } from '../../database/repositories/SecurityEventRepository.js';
import { logger } from '../../utils/logger.js';
import { formatDuration } from '../../utils/time.js';

/** Track active lockdown timers per guild */
const lockdownTimers: Map<string, NodeJS.Timeout> = new Map();

export class LockdownService {
  private static instance: LockdownService;

  private constructor() {}

  public static getInstance(): LockdownService {
    if (!LockdownService.instance) {
      LockdownService.instance = new LockdownService();
    }
    return LockdownService.instance;
  }

  /**
   * Activate a guild-wide or channel-specific lockdown.
   * Denies SendMessages for @everyone in all text channels (or a specific one).
   *
   * @param client     - BotClient
   * @param guild      - Guild to lock
   * @param reason     - Reason for lockdown
   * @param durationMs - Auto-unlock after this many ms (0 = manual only)
   * @param channelId  - If specified, only lock that channel
   */
  public async activateLockdown(
    client: BotClient,
    guild: Guild,
    reason: string,
    durationMs = 0,
    channelId?: string
  ): Promise<number> {
    let lockedCount = 0;
    const channelNames: string[] = [];

    if (channelId) {
      // Single channel lockdown
      const ch = await guild.channels.fetch(channelId);
      if (ch?.type === ChannelType.GuildText) {
        await this.lockTextChannel(ch as TextChannel, reason);
        lockedCount = 1;
        channelNames.push(ch.name);
      }
    } else {
      // Guild-wide lockdown
      const channels = await guild.channels.fetch();
      for (const [, ch] of channels) {
        if (ch?.type === ChannelType.GuildText) {
          try {
            await this.lockTextChannel(ch as TextChannel, reason);
            lockedCount++;
            channelNames.push(ch.name);
          } catch (e) {
            logger.warn(`[Lockdown] Could not lock #${ch.name}: ${String(e)}`);
          }
        }
      }
    }

    // Update DB state
    await prisma.guildConfig.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, lockdownActive: true },
      update: { lockdownActive: true },
    });

    await createSecurityEvent({
      guildId: guild.id,
      type: 'LOCKDOWN_START',
      severity: 'HIGH',
      action: `Locked ${lockedCount} channel(s)`,
      details: { reason, durationMs, channelId, channelNames },
    });

    await logLockdown(
      client,
      guild.id,
      guild.name,
      true,
      reason,
      channelId ? channelNames[0] : `${lockedCount} channels`
    );

    logger.info(`[Lockdown] Activated on ${guild.name} — ${lockedCount} channels locked`);

    // Set auto-unlock timer
    if (durationMs > 0) {
      const existing = lockdownTimers.get(guild.id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        await this.deactivateLockdown(client, guild, `Auto-unlock after ${formatDuration(durationMs)}`);
        lockdownTimers.delete(guild.id);
      }, durationMs);

      timer.unref();
      lockdownTimers.set(guild.id, timer);
    }

    return lockedCount;
  }

  /**
   * Deactivate lockdown — restore SendMessages for @everyone.
   */
  public async deactivateLockdown(
    client: BotClient,
    guild: Guild,
    reason: string,
    channelId?: string
  ): Promise<number> {
    let unlockedCount = 0;

    if (channelId) {
      const ch = await guild.channels.fetch(channelId);
      if (ch?.type === ChannelType.GuildText) {
        await this.unlockTextChannel(ch as TextChannel, reason);
        unlockedCount = 1;
      }
    } else {
      const channels = await guild.channels.fetch();
      for (const [, ch] of channels) {
        if (ch?.type === ChannelType.GuildText) {
          try {
            await this.unlockTextChannel(ch as TextChannel, reason);
            unlockedCount++;
          } catch (e) {
            logger.warn(`[Lockdown] Could not unlock #${ch.name}: ${String(e)}`);
          }
        }
      }
    }

    await prisma.guildConfig.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, lockdownActive: false },
      update: { lockdownActive: false },
    });

    await createSecurityEvent({
      guildId: guild.id,
      type: 'LOCKDOWN_END',
      severity: 'INFO',
      action: `Unlocked ${unlockedCount} channel(s)`,
      details: { reason, channelId },
    });

    await logLockdown(client, guild.id, guild.name, false, reason);

    // Cancel any pending auto-unlock
    const timer = lockdownTimers.get(guild.id);
    if (timer) {
      clearTimeout(timer);
      lockdownTimers.delete(guild.id);
    }

    logger.info(`[Lockdown] Deactivated on ${guild.name} — ${unlockedCount} channels unlocked`);
    return unlockedCount;
  }

  private async lockTextChannel(channel: TextChannel, reason: string): Promise<void> {
    await channel.permissionOverwrites.edit(
      channel.guild.roles.everyone,
      { SendMessages: false },
      { reason: `[Lockdown] ${reason}` }
    );
  }

  private async unlockTextChannel(channel: TextChannel, reason: string): Promise<void> {
    await channel.permissionOverwrites.edit(
      channel.guild.roles.everyone,
      { SendMessages: null }, // Reset to parent default
      { reason: `[Lockdown End] ${reason}` }
    );
  }
}

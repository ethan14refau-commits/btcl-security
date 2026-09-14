import { Events, GuildChannel, DMChannel, AuditLogEvent } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logChannelDelete } from '../services/logging/LogService.js';
import { NukeDetector } from '../services/antiNuke/NukeDetector.js';

const event: BotEvent<Events.ChannelDelete> = {
  name: Events.ChannelDelete,

  async execute(client: BotClient, channel: GuildChannel | DMChannel): Promise<void> {
    if (!('guild' in channel)) return;
    const guildChannel = channel as GuildChannel;

    await logChannelDelete(client, guildChannel);

    // Try to find who deleted it
    let actorId = 'unknown';
    try {
      const logs = await guildChannel.guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelDelete,
        limit: 1,
      });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === guildChannel.id) {
        actorId = entry.executor?.id ?? 'unknown';
      }
    } catch {
      // Proceed without actor info
    }

    await NukeDetector.getInstance().onEvent(client, guildChannel.guild.id, 'CHANNEL_DELETE', actorId);
  },
};

export default event;

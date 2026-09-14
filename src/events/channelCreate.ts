import { Events, GuildChannel, NonThreadGuildBasedChannel } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logChannelCreate } from '../services/logging/LogService.js';
import { NukeDetector } from '../services/antiNuke/NukeDetector.js';

const event: BotEvent<Events.ChannelCreate> = {
  name: Events.ChannelCreate,

  async execute(client: BotClient, channel: NonThreadGuildBasedChannel): Promise<void> {
    if (!('guild' in channel)) return;
    await logChannelCreate(client, channel as GuildChannel);
    await NukeDetector.getInstance().onEvent(client, channel.guild.id, 'CHANNEL_CREATE', 'unknown');
  },
};

export default event;

import { Events, Guild } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { prisma } from '../database/client.js';

const event: BotEvent<Events.GuildUpdate> = {
  name: Events.GuildUpdate,

  async execute(_client: BotClient, _oldGuild: Guild, newGuild: Guild): Promise<void> {
    // Keep guild name in sync
    await prisma.guild.upsert({
      where: { id: newGuild.id },
      create: { id: newGuild.id, name: newGuild.name },
      update: { name: newGuild.name },
    });
  },
};

export default event;

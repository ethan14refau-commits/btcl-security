import { Events, GuildMember, PartialGuildMember } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logMemberLeave } from '../services/logging/LogService.js';

const event: BotEvent<Events.GuildMemberRemove> = {
  name: Events.GuildMemberRemove,

  async execute(client: BotClient, member: GuildMember | PartialGuildMember): Promise<void> {
    if (member.partial) {
      try {
        await member.fetch();
      } catch {
        return; // Can't fetch partial member, skip
      }
    }
    await logMemberLeave(client, member as GuildMember);
  },
};

export default event;

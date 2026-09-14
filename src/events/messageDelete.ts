import { Events, Message, PartialMessage } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logMessageDelete } from '../services/logging/LogService.js';

const event: BotEvent<Events.MessageDelete> = {
  name: Events.MessageDelete,

  async execute(client: BotClient, message: Message | PartialMessage): Promise<void> {
    if (message.partial) return; // Can't log partial messages
    await logMessageDelete(client, message as Message);
  },
};

export default event;

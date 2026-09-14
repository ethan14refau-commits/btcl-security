import { Events, Message, PartialMessage } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logMessageEdit } from '../services/logging/LogService.js';

const event: BotEvent<Events.MessageUpdate> = {
  name: Events.MessageUpdate,

  async execute(
    client: BotClient,
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage
  ): Promise<void> {
    if (oldMessage.partial || newMessage.partial) return;
    await logMessageEdit(client, oldMessage as Message, newMessage as Message);
  },
};

export default event;

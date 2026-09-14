import { ClientEvents } from 'discord.js';
import { BotClient } from './discord.js';

export interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  /** The Discord.js event name */
  name: K;

  /** Whether this handler runs only once */
  once?: boolean;

  /** Event handler — receives the client + the native Discord.js args */
  execute(client: BotClient, ...args: ClientEvents[K]): Promise<void> | void;
}

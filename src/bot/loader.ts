import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { BotClient } from '../types/discord.js';
import { Command } from '../types/command.js';
import { BotEvent } from '../types/event.js';
import { logger } from '../utils/logger.js';

/**
 * Recursively find all .ts / .js files in a directory.
 */
function getFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...getFiles(fullPath));
    } else if (entry.endsWith('.ts') || entry.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Load all slash commands from src/commands/ into client.commands.
 */
export async function loadCommands(client: BotClient): Promise<void> {
  const commandsPath = join(__dirname, '..', 'commands');
  const files = getFiles(commandsPath).filter(
    (f) => !f.endsWith('.test.ts') && !f.endsWith('.test.js')
  );

  let loaded = 0;
  for (const file of files) {
    try {
      // Convert Windows absolute path to file:// URL for ESM compatibility
      const fileUrl = pathToFileURL(file).href;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const module = await import(fileUrl);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const command: Command = module.default ?? module.command;
      if (!command?.data?.name) {
        logger.warn(`Skipping ${file} — no valid command export found`);
        continue;
      }
      client.commands.set(command.data.name, command);
      loaded++;
    } catch (err) {
      logger.error(`Failed to load command ${file}:`, err);
    }
  }

  logger.info(`Loaded ${loaded} commands`);
}

/**
 * Load all event handlers from src/events/ and register them on the client.
 */
export async function loadEvents(client: BotClient): Promise<void> {
  const eventsPath = join(__dirname, '..', 'events');
  const files = getFiles(eventsPath).filter(
    (f) => !f.endsWith('.test.ts') && !f.endsWith('.test.js')
  );

  let loaded = 0;
  for (const file of files) {
    try {
      // Convert Windows absolute path to file:// URL for ESM compatibility
      const fileUrl = pathToFileURL(file).href;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const module = await import(fileUrl);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const event: BotEvent = module.default ?? module.event;
      if (!event?.name) {
        logger.warn(`Skipping ${file} — no valid event export found`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => {
          void event.execute(client, ...(args as Parameters<typeof event.execute> extends [BotClient, ...infer R] ? R : never[]));
        });
      } else {
        client.on(event.name, (...args) => {
          void event.execute(client, ...(args as Parameters<typeof event.execute> extends [BotClient, ...infer R] ? R : never[]));
        });
      }
      loaded++;
    } catch (err) {
      logger.error(`Failed to load event ${file}:`, err);
    }
  }

  logger.info(`Loaded ${loaded} events`);
}

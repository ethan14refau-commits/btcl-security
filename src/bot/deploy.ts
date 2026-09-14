import { REST, Routes } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { Command } from '../types/command.js';

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

async function deployCommands(): Promise<void> {
  const commandsPath = join(__dirname, '..', 'commands');
  const files = getFiles(commandsPath);
  const commandData: object[] = [];

  for (const file of files) {
    try {
      const fileUrl = pathToFileURL(file).href;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const module = await import(fileUrl);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const command: Command = module.default ?? module.command;
      if (command?.data) {
        commandData.push(command.data.toJSON());
      }
    } catch (err) {
      logger.error(`Failed to load ${file}:`, err);
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const guildId = process.env.GUILD_ID;

  logger.info(`Deploying ${commandData.length} slash commands...`);

  if (guildId) {
    // Guild deployment — instantané
    await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, guildId), { body: commandData });
    logger.info(`✅ ${commandData.length} commandes déployées sur le serveur ${guildId} (instantané)`);
  } else {
    // Global deployment — jusqu'à 1 heure
    await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: commandData });
    logger.info(`✅ ${commandData.length} commandes déployées globalement (peut prendre jusqu'à 1h)`);
  }
}

deployCommands().catch((err: unknown) => {
  logger.error('Deploy failed:', err);
  process.exit(1);
});

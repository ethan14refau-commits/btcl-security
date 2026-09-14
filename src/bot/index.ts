/**
 * Bot entry point.
 * Initializes the Discord client, loads commands and events, then logs in.
 */

import {
  GatewayIntentBits,
  Partials,
  ActivityType,
} from 'discord.js';
import { BotClient } from '../types/discord.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { loadCommands, loadEvents } from './loader.js';
import { prisma } from '../database/client.js';

const client = new BotClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,          // Privileged — enable in Dev Portal
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,         // Privileged — enable in Dev Portal
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildWebhooks,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
    Partials.User,
  ],
  presence: {
    activities: [
      {
        name: '.gg/btcl',
        type: ActivityType.Streaming,
        url: 'https://www.twitch.tv/btcl',
      },
    ],
    status: 'online',
  },
});

async function main(): Promise<void> {
  logger.info('Starting Discord Security Bot...');

  // Load commands and events
  await loadCommands(client);
  await loadEvents(client);

  // Connect to database
  await prisma.$connect();
  logger.info('Database connected');

  // Sync bot owners from env to DB
  const { syncOwnersFromEnv } = await import('../database/repositories/OwnerRepository.js');
  await syncOwnersFromEnv();

  // Log in to Discord
  await client.login(config.DISCORD_TOKEN);
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down...');
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  void shutdown();
});

main().catch((err: unknown) => {
  logger.error('Failed to start bot:', err);
  process.exit(1);
});

export { client };

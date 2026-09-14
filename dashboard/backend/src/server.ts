import { createApp } from './app.js';
import { config } from '../../../src/config/index.js';
import { prisma } from '../../../src/database/client.js';
import { logger } from '../../../src/utils/logger.js';

const PORT = parseInt(config.DASHBOARD_PORT, 10);

async function startServer(): Promise<void> {
  const app = createApp();

  // Connect database
  await prisma.$connect();
  logger.info('Dashboard database connected');

  const server = app.listen(PORT, () => {
    logger.info(`Dashboard API running on http://localhost:${PORT}`);
    logger.info(`Frontend URL: ${config.FRONTEND_URL}`);
    logger.info(`OAuth2 redirect: ${config.OAUTH2_REDIRECT_URI}`);
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down dashboard...');
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });
}

startServer().catch((err: unknown) => {
  logger.error('Failed to start dashboard server:', err);
  process.exit(1);
});

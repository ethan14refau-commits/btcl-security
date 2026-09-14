import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Prisma client singleton.
 * Uses a global variable in development to prevent connection pool exhaustion
 * during hot-reloads with tsx watch.
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });
}

export const prisma: PrismaClient =
  globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Log Prisma warnings and errors through winston
(prisma as unknown as {
  $on: (event: string, cb: (e: { message: string }) => void) => void;
}).$on('warn', (e) => logger.warn(`Prisma warning: ${e.message}`));

(prisma as unknown as {
  $on: (event: string, cb: (e: { message: string }) => void) => void;
}).$on('error', (e) => logger.error(`Prisma error: ${e.message}`));

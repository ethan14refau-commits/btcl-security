import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { botActivitySchema } from '../schemas/index.js';
import { checkBotOwner } from '../../../src/middleware/requireBotOwner.js';
import { prisma } from '../../../src/database/client.js';
import { ActivityType } from 'discord.js';
import { client } from '../../../src/bot/index.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /bot/status — Get bot status
 */
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    online: client.isReady,
    username: client.user?.username ?? null,
    tag: client.user?.tag ?? null,
    id: client.user?.id ?? null,
    guildCount: client.guilds.cache.size,
    uptime: process.uptime(),
  });
});

/**
 * GET /bot/activity — Get current bot activity config
 */
router.get('/activity', async (req: Request, res: Response): Promise<void> => {
  // Only bot owners can view/change bot activity
  const isOwner = await checkBotOwner(req.userId!);
  if (!isOwner) {
    res.status(403).json({ error: 'Only Bot Owners can manage bot activity.' });
    return;
  }

  const config = await prisma.guildConfig.findFirst({
    where: { botActivity: { not: null } },
    select: { botActivity: true },
  });

  res.json({ activity: config?.botActivity ? JSON.parse(config.botActivity as string) : null });
});

/**
 * PATCH /bot/activity — Update bot activity (Bot Owner only)
 */
router.patch(
  '/activity',
  writeLimiter,
  validateBody(botActivitySchema),
  async (req: Request, res: Response): Promise<void> => {
    const isOwner = await checkBotOwner(req.userId!);
    if (!isOwner) {
      res.status(403).json({ error: 'Only Bot Owners can manage bot activity.' });
      return;
    }

    const { type, name, url } = req.body as { type: string; name: string; url?: string };

    const typeMap: Record<string, ActivityType> = {
      PLAYING: ActivityType.Playing,
      STREAMING: ActivityType.Streaming,
      LISTENING: ActivityType.Listening,
      WATCHING: ActivityType.Watching,
      COMPETING: ActivityType.Competing,
    };

    // Apply to bot
    client.user?.setActivity(name, {
      type: typeMap[type.toUpperCase()] ?? ActivityType.Watching,
      url,
    });

    // Persist — store in any guild config (it's global)
    const anyConfig = await prisma.guildConfig.findFirst();
    if (anyConfig) {
      await prisma.guildConfig.update({
        where: { id: anyConfig.id },
        data: { botActivity: JSON.stringify({ type, name, url }) },
      });
    }

    res.json({ success: true, activity: { type, name, url } });
  }
);

export default router;

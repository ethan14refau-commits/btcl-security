import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { paginationSchema } from '../schemas/index.js';
import { getSecurityEvents, getSecurityStats } from '../../../src/database/repositories/SecurityEventRepository.js';
import { fetchUserGuilds, hasManageGuild } from '../oauth/discord.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /security/:guildId/events — Get security event history
 */
router.get(
  '/:guildId/events',
  validateQuery(paginationSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { guildId } = req.params;

    if (!(await userHasGuildAccess(req.accessToken!, guildId))) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    const { limit, offset } = req.query as { limit: string; offset: string };
    const events = await getSecurityEvents(guildId, Number(limit), Number(offset));

    res.json(
      events.map((e) => ({
        id: e.id,
        type: e.type,
        severity: e.severity,
        actorId: e.actorId,
        targetId: e.targetId,
        action: e.action,
        details: JSON.parse(e.details) as unknown,
        createdAt: e.createdAt,
      }))
    );
  }
);

/**
 * GET /security/:guildId/stats — Get security statistics
 */
router.get('/:guildId/stats', async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params;

  if (!(await userHasGuildAccess(req.accessToken!, guildId))) {
    res.status(403).json({ error: 'Forbidden.' });
    return;
  }

  const stats = await getSecurityStats(guildId);
  res.json(stats);
});

async function userHasGuildAccess(accessToken: string, guildId: string): Promise<boolean> {
  try {
    const guilds = await fetchUserGuilds(accessToken);
    const guild = guilds.find((g) => g.id === guildId);
    return !!guild && hasManageGuild(guild);
  } catch {
    return false;
  }
}

export default router;

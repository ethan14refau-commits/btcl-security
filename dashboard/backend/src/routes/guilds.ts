import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import {
  fetchUserGuilds,
  hasManageGuild,
  getGuildIconUrl,
} from '../oauth/discord.js';
import { updateGuildConfig } from '../../../src/database/repositories/GuildRepository.js';
import {
  getWhitelistEntries,
  addToWhitelist,
  removeFromWhitelist,
} from '../../../src/database/repositories/WhitelistRepository.js';
import { prisma } from '../../../src/database/client.js';
import {
  updateGuildConfigSchema,
  whitelistAddSchema,
  whitelistRemoveSchema,
  paginationSchema,
} from '../schemas/index.js';

const router = Router();

// All guild routes require authentication
router.use(requireAuth);

/**
 * GET /guilds — List guilds where the user has Manage Guild permission
 * and the bot is also present.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userGuilds = await fetchUserGuilds(req.accessToken!);

    // Filter to guilds where user has ManageGuild
    const manageableGuilds = userGuilds.filter(hasManageGuild);

    // Filter to guilds where the bot is present (in our DB)
    const botGuildIds = (await prisma.guild.findMany({ select: { id: true } })).map((g) => g.id);
    const botGuilds = manageableGuilds.filter((g) => botGuildIds.includes(g.id));

    res.json(
      botGuilds.map((g) => ({
        id: g.id,
        name: g.name,
        icon: getGuildIconUrl(g),
        isOwner: g.owner,
      }))
    );
  } catch {
    res.status(502).json({ error: 'Failed to fetch guilds from Discord.' });
  }
});

/**
 * GET /guilds/:guildId/config — Get guild configuration
 */
router.get('/:guildId/config', async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params;

  // Verify user has ManageGuild in this guild
  if (!(await userHasGuildAccess(req.accessToken!, guildId))) {
    res.status(403).json({ error: 'You do not have Manage Guild permission in this server.' });
    return;
  }

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config) {
    res.status(404).json({ error: 'Guild configuration not found. Ensure the bot is in this server.' });
    return;
  }

  res.json({
    guildId: config.guildId,
    antiraidEnabled: config.antiraidEnabled,
    antiraidLevel: config.antiraidLevel,
    antinukeEnabled: config.antinukeEnabled,
    logChannelId: config.logChannelId,
    lockdownActive: config.lockdownActive,
    raidThresholds: JSON.parse(config.raidThresholds) as unknown,
    antinukeThresholds: JSON.parse(config.antinukeThresholds) as unknown,
    moderationSettings: JSON.parse(config.moderationSettings) as unknown,
  });
});

/**
 * PATCH /guilds/:guildId/config — Update guild configuration
 */
router.patch(
  '/:guildId/config',
  writeLimiter,
  validateBody(updateGuildConfigSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { guildId } = req.params;

    if (!(await userHasGuildAccess(req.accessToken!, guildId))) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    const updates = req.body as {
      antiraidEnabled?: boolean;
      antiraidLevel?: string;
      antinukeEnabled?: boolean;
      logChannelId?: string | null;
      raidThresholds?: object;
      antinukeThresholds?: object;
    };

    const prismaUpdates: Record<string, unknown> = {};
    if (updates.antiraidEnabled !== undefined) prismaUpdates.antiraidEnabled = updates.antiraidEnabled;
    if (updates.antiraidLevel !== undefined) prismaUpdates.antiraidLevel = updates.antiraidLevel;
    if (updates.antinukeEnabled !== undefined) prismaUpdates.antinukeEnabled = updates.antinukeEnabled;
    if (updates.logChannelId !== undefined) prismaUpdates.logChannelId = updates.logChannelId;
    if (updates.raidThresholds !== undefined) prismaUpdates.raidThresholds = JSON.stringify(updates.raidThresholds);
    if (updates.antinukeThresholds !== undefined) prismaUpdates.antinukeThresholds = JSON.stringify(updates.antinukeThresholds);

    const updated = await updateGuildConfig(guildId, prismaUpdates);
    res.json({ success: true, guildId: updated.guildId });
  }
);

/**
 * GET /guilds/:guildId/whitelist
 */
router.get(
  '/:guildId/whitelist',
  validateQuery(paginationSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { guildId } = req.params;
    if (!(await userHasGuildAccess(req.accessToken!, guildId))) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    const entries = await getWhitelistEntries(guildId);
    res.json(entries);
  }
);

/**
 * POST /guilds/:guildId/whitelist — Add to whitelist
 */
router.post(
  '/:guildId/whitelist',
  writeLimiter,
  validateBody(whitelistAddSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { guildId } = req.params;
    if (!(await userHasGuildAccess(req.accessToken!, guildId))) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    const { targetId, type } = req.body as { targetId: string; type: 'USER' | 'ROLE' | 'BOT' };
    const entry = await addToWhitelist(guildId, targetId, type, req.userId!);
    res.status(201).json(entry);
  }
);

/**
 * DELETE /guilds/:guildId/whitelist — Remove from whitelist
 */
router.delete(
  '/:guildId/whitelist',
  writeLimiter,
  validateBody(whitelistRemoveSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { guildId } = req.params;
    if (!(await userHasGuildAccess(req.accessToken!, guildId))) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    const { targetId } = req.body as { targetId: string };
    const removed = await removeFromWhitelist(guildId, targetId);
    if (!removed) {
      res.status(404).json({ error: 'Entry not found.' });
      return;
    }
    res.json({ success: true });
  }
);

/**
 * Verify that the authenticated user has ManageGuild in a specific guild.
 * Always re-fetches from Discord — never trust frontend.
 */
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

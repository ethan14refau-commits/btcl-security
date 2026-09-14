import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../../src/database/client.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import {
  buildAuthUrl,
  exchangeCode,
  fetchCurrentUser,
  revokeToken,
  getAvatarUrl,
} from '../oauth/discord.js';
import { callbackQuerySchema } from '../schemas/index.js';
import { createSecurityEvent } from '../../../src/database/repositories/SecurityEventRepository.js';
import { logger } from '../../../src/utils/logger.js';
import { config, isProduction } from '../../../src/config/index.js';

const router = Router();

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  signed: true,
  maxAge: SESSION_MAX_AGE,
};

/**
 * GET /auth/discord — Redirect to Discord OAuth2
 */
router.get('/discord', authLimiter, (_req: Request, res: Response): void => {
  const state = randomUUID();

  // Store state in a short-lived signed cookie for CSRF validation
  res.cookie('oauth_state', state, {
    ...cookieOptions,
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  const url = buildAuthUrl(state);
  res.redirect(url);
});

/**
 * GET /auth/callback — Handle OAuth2 callback from Discord
 */
router.get('/callback', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parseResult = callbackQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid callback parameters' });
    return;
  }

  const { code, state } = parseResult.data;

  // CSRF validation — state must match cookie
  const storedState = req.signedCookies?.oauth_state as string | undefined;
  if (!storedState || storedState !== state) {
    logger.warn(`OAuth2 CSRF check failed — state mismatch from IP ${req.ip ?? 'unknown'}`);

    // Log auth failure
    await createSecurityEvent({
      guildId: 'SYSTEM',
      type: 'AUTH_FAILURE',
      severity: 'HIGH',
      action: 'OAuth2 CSRF state mismatch',
      details: { ip: req.ip },
    }).catch(() => {});

    res.status(403).json({ error: 'State mismatch. Possible CSRF attack.' });
    return;
  }

  // Clear the state cookie
  res.clearCookie('oauth_state');

  try {
    // Exchange code for tokens (server-side only — never expose to frontend)
    const tokens = await exchangeCode(code);

    // Fetch user info from Discord
    const user = await fetchCurrentUser(tokens.access_token);

    // Create or update session in database
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const session = await prisma.oAuthSession.create({
      data: {
        userId: user.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenType: tokens.token_type,
        scope: tokens.scope,
        expiresAt,
      },
    });

    // Set session cookie — HttpOnly, no token value exposed to JS
    res.cookie('session_id', session.id, cookieOptions);

    logger.info(`OAuth2 login successful for user ${user.id}`);

    // Redirect to dashboard
    res.redirect(`${config.FRONTEND_URL}/dashboard`);
  } catch (err) {
    logger.error('OAuth2 callback error:', err);
    res.redirect(`${config.FRONTEND_URL}/login?error=auth_failed`);
  }
});

/**
 * GET /auth/me — Return current user info
 */
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await fetchCurrentUser(req.accessToken!);
    res.json({
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      globalName: user.global_name,
      avatar: getAvatarUrl(user),
    });
  } catch {
    res.status(401).json({ error: 'Failed to fetch user info. Token may be expired.' });
  }
});

/**
 * GET /auth/logout — Invalidate session and clear cookie
 */
router.get('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const session = await prisma.oAuthSession.findUnique({ where: { id: req.sessionId! } });
    if (session) {
      // Revoke token with Discord
      await revokeToken(session.accessToken);
      // Delete session from DB
      await prisma.oAuthSession.delete({ where: { id: session.id } });
    }
  } catch (err) {
    logger.warn('Logout cleanup error:', err);
  }

  res.clearCookie('session_id');
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../src/database/client.js';

/**
 * Session authentication middleware.
 * Verifies the session cookie and loads the OAuth session from the database.
 * Attaches userId and accessToken to req for downstream use.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionId = req.signedCookies?.session_id as string | undefined;

  if (!sessionId) {
    res.status(401).json({ error: 'Unauthorized', message: 'No session found. Please log in.' });
    return;
  }

  const session = await prisma.oAuthSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    res.clearCookie('session_id');
    res.status(401).json({ error: 'Unauthorized', message: 'Session not found. Please log in again.' });
    return;
  }

  if (session.expiresAt < new Date()) {
    await prisma.oAuthSession.delete({ where: { id: sessionId } });
    res.clearCookie('session_id');
    res.status(401).json({ error: 'Unauthorized', message: 'Session expired. Please log in again.' });
    return;
  }

  // Attach to request
  req.userId = session.userId;
  req.accessToken = session.accessToken;
  req.sessionId = session.id;

  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      accessToken?: string;
      sessionId?: string;
    }
  }
}

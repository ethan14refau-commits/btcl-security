import express, { Application, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { config, isProduction } from '../../../src/config/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { logger } from '../../../src/utils/logger.js';
import authRouter from './routes/auth.js';
import guildsRouter from './routes/guilds.js';
import securityRouter from './routes/security.js';
import botRouter from './routes/bot.js';

export function createApp(): Application {
  const app = express();

  // ─── Security Headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'],
          connectSrc: ["'self'"],
        },
      },
    })
  );

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ─── Body Parsing ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─── Cookie Parser (signed) ───────────────────────────────────────────────
  app.use(cookieParser(config.SESSION_SECRET));

  // ─── Global Rate Limit ────────────────────────────────────────────────────
  app.use('/api', apiLimiter);

  // ─── Trust Proxy (for rate limiting behind nginx/docker) ─────────────────
  if (isProduction) {
    app.set('trust proxy', 1);
  }

  // ─── Request Logging ─────────────────────────────────────────────────────
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path} — ${req.ip ?? 'unknown'}`);
    next();
  });

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use('/auth', authRouter);
  app.use('/api/guilds', guildsRouter);
  app.use('/api/security', securityRouter);
  app.use('/api/bot', botRouter);

  // ─── Health Check ─────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── 404 Handler ──────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // ─── Global Error Handler ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled API error:', err);
    // Never expose stack traces in production
    res.status(500).json({
      error: 'Internal Server Error',
      message: isProduction ? 'An unexpected error occurred.' : err.message,
    });
  });

  return app;
}

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  CLIENT_ID: z.string().min(1, 'CLIENT_ID is required'),
  CLIENT_SECRET: z.string().min(1, 'CLIENT_SECRET is required'),
  OWNER_IDS: z.string().min(1, 'OWNER_IDS is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  OAUTH2_REDIRECT_URI: z.string().url('OAUTH2_REDIRECT_URI must be a valid URL'),
  DASHBOARD_PORT: z.string().default('3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function validateEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}\n\nCopy .env.example to .env and fill in all values.`);
  }
  return result.data;
}

// Exported config — validated once at startup
export const config = validateEnv();

export const ownerIds: string[] = config.OWNER_IDS.split(',')
  .map((id) => id.trim())
  .filter(Boolean);

export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';

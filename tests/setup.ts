/**
 * Vitest global test setup.
 * Runs before all test files.
 */

import { vi } from 'vitest';

// Mock dotenv so tests don't require a real .env file
vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}));

// Provide safe defaults for env vars used in config/index.ts
process.env.DISCORD_TOKEN = 'test_token_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.CLIENT_ID = '123456789012345678';
process.env.CLIENT_SECRET = 'test_client_secret_32chars_longxx';
process.env.OWNER_IDS = '111111111111111111,222222222222222222';
process.env.DATABASE_URL = 'file:./prisma/test.db';
process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars_long!';
process.env.OAUTH2_REDIRECT_URI = 'http://localhost:3001/auth/callback';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

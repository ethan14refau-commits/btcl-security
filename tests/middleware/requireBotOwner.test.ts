import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the repository
vi.mock('../../src/database/repositories/OwnerRepository.js', () => ({
  isBotOwner: vi.fn(),
}));

vi.mock('../../src/database/client.js', () => ({
  prisma: {
    botOwner: {
      findUnique: vi.fn(),
    },
  },
}));

import { isBotOwner } from '../../src/database/repositories/OwnerRepository.js';
import { checkBotOwner } from '../../src/middleware/requireBotOwner.js';

const mockIsBotOwner = vi.mocked(isBotOwner);

describe('requireBotOwner middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkBotOwner', () => {
    it('should return true for a registered owner', async () => {
      mockIsBotOwner.mockResolvedValue(true);
      const result = await checkBotOwner('111111111111111111');
      expect(result).toBe(true);
      expect(mockIsBotOwner).toHaveBeenCalledWith('111111111111111111');
    });

    it('should return false for a non-owner', async () => {
      mockIsBotOwner.mockResolvedValue(false);
      const result = await checkBotOwner('999999999999999999');
      expect(result).toBe(false);
    });

    it('should return false for a server admin who is not an owner', async () => {
      mockIsBotOwner.mockResolvedValue(false);
      // Even if they have admin perms — that's checked elsewhere, not here
      const result = await checkBotOwner('admin_user_id');
      expect(result).toBe(false);
    });

    it('should return false for the guild owner if not registered as bot owner', async () => {
      mockIsBotOwner.mockResolvedValue(false);
      const result = await checkBotOwner('guild_owner_id');
      expect(result).toBe(false);
    });

    it('should return true for env-loaded owner', async () => {
      mockIsBotOwner.mockResolvedValue(true);
      const result = await checkBotOwner('111111111111111111'); // From test setup OWNER_IDS
      expect(result).toBe(true);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/database/repositories/WhitelistRepository.js', () => ({
  isWhitelisted: vi.fn(),
  hasWhitelistedRole: vi.fn(),
  addToWhitelist: vi.fn(),
  removeFromWhitelist: vi.fn(),
  listWhitelist: vi.fn(),
}));

import {
  isWhitelisted,
  hasWhitelistedRole,
  addToWhitelist,
  removeFromWhitelist,
} from '../../src/database/repositories/WhitelistRepository.js';

const mockIsWhitelisted = vi.mocked(isWhitelisted);
const mockHasWhitelistedRole = vi.mocked(hasWhitelistedRole);
const mockAdd = vi.mocked(addToWhitelist);
const mockRemove = vi.mocked(removeFromWhitelist);

describe('WhitelistService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isWhitelisted', () => {
    it('should return true if target is whitelisted', async () => {
      mockIsWhitelisted.mockResolvedValue(true);
      const result = await isWhitelisted('guild1', 'user1');
      expect(result).toBe(true);
    });

    it('should return false if target is not whitelisted', async () => {
      mockIsWhitelisted.mockResolvedValue(false);
      const result = await isWhitelisted('guild1', 'user1');
      expect(result).toBe(false);
    });

    it('should check guild-specific whitelist (not global)', async () => {
      mockIsWhitelisted.mockResolvedValue(false);
      await isWhitelisted('guild2', 'user1');
      expect(mockIsWhitelisted).toHaveBeenCalledWith('guild2', 'user1');
    });
  });

  describe('hasWhitelistedRole', () => {
    it('should return true if any role is whitelisted', async () => {
      mockHasWhitelistedRole.mockResolvedValue(true);
      const result = await hasWhitelistedRole('guild1', ['role1', 'role2']);
      expect(result).toBe(true);
    });

    it('should return false if no roles are whitelisted', async () => {
      mockHasWhitelistedRole.mockResolvedValue(false);
      const result = await hasWhitelistedRole('guild1', ['role1']);
      expect(result).toBe(false);
    });

    it('should return false with empty role array', async () => {
      mockHasWhitelistedRole.mockResolvedValue(false);
      const result = await hasWhitelistedRole('guild1', []);
      expect(result).toBe(false);
    });
  });

  describe('addToWhitelist', () => {
    it('should call repository with correct params', async () => {
      const mockEntry = {
        id: 'entry1',
        guildId: 'guild1',
        targetId: 'user1',
        type: 'USER',
        addedBy: 'admin1',
        addedAt: new Date(),
      };
      mockAdd.mockResolvedValue(mockEntry);

      await addToWhitelist('guild1', 'user1', 'USER', 'admin1');

      expect(mockAdd).toHaveBeenCalledWith('guild1', 'user1', 'USER', 'admin1');
    });
  });

  describe('removeFromWhitelist', () => {
    it('should return the removed entry', async () => {
      const mockEntry = {
        id: 'entry1',
        guildId: 'guild1',
        targetId: 'user1',
        type: 'USER',
        addedBy: 'admin1',
        addedAt: new Date(),
      };
      mockRemove.mockResolvedValue(mockEntry);

      const result = await removeFromWhitelist('guild1', 'user1');
      expect(result).toEqual(mockEntry);
    });

    it('should return null if not found', async () => {
      mockRemove.mockResolvedValue(null);
      const result = await removeFromWhitelist('guild1', 'nonexistent');
      expect(result).toBeNull();
    });
  });
});

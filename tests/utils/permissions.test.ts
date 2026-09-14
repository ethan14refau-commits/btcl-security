import { describe, it, expect } from 'vitest';
import { accountAgeMs, isNewAccount, parseDuration, formatDuration } from '../../src/utils/time.js';

describe('time utilities', () => {
  describe('parseDuration', () => {
    it('should parse seconds', () => {
      expect(parseDuration('30s')).toBe(30_000);
    });

    it('should parse minutes', () => {
      expect(parseDuration('10m')).toBe(600_000);
    });

    it('should parse hours', () => {
      expect(parseDuration('2h')).toBe(7_200_000);
    });

    it('should parse days', () => {
      expect(parseDuration('1d')).toBe(86_400_000);
    });

    it('should return null for invalid format', () => {
      expect(parseDuration('invalid')).toBeNull();
      expect(parseDuration('10x')).toBeNull();
      expect(parseDuration('')).toBeNull();
    });

    it('should handle uppercase input', () => {
      expect(parseDuration('10M')).toBe(600_000);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(30_000)).toBe('30s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90_000)).toBe('1m 30s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3_660_000)).toBe('1h 1m');
    });

    it('should format days and hours', () => {
      expect(formatDuration(90_000_000)).toBe('1d 1h');
    });
  });

  describe('accountAgeMs', () => {
    it('should return a positive number for a valid snowflake', () => {
      // Use a known old ID (Discord's first user)
      const age = accountAgeMs('80351110224678912');
      expect(age).toBeGreaterThan(0);
    });

    it('should indicate old account is not new', () => {
      // Old Discord ID (2015)
      const result = isNewAccount('80351110224678912', 7 * 24 * 60 * 60 * 1000);
      expect(result).toBe(false);
    });
  });
});

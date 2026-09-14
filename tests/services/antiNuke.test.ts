import { describe, it, expect, beforeEach } from 'vitest';
import { EventBuffer } from '../../src/services/antiNuke/EventBuffer.js';

describe('EventBuffer (Anti-Nuke)', () => {
  let buffer: EventBuffer;

  beforeEach(() => {
    buffer = EventBuffer.getInstance();
    buffer.reset();
  });

  describe('event counting', () => {
    it('should return 0 with no events', () => {
      expect(buffer.countByActor('guild1', 'CHANNEL_DELETE', 'actor1', 10_000)).toBe(0);
    });

    it('should count events by actor', () => {
      buffer.push('guild1', 'CHANNEL_DELETE', 'actor1');
      buffer.push('guild1', 'CHANNEL_DELETE', 'actor1');
      buffer.push('guild1', 'CHANNEL_DELETE', 'actor2');

      expect(buffer.countByActor('guild1', 'CHANNEL_DELETE', 'actor1', 10_000)).toBe(2);
      expect(buffer.countByActor('guild1', 'CHANNEL_DELETE', 'actor2', 10_000)).toBe(1);
    });

    it('should count total events across actors', () => {
      buffer.push('guild1', 'ROLE_DELETE', 'actor1');
      buffer.push('guild1', 'ROLE_DELETE', 'actor2');
      buffer.push('guild1', 'ROLE_DELETE', 'actor3');

      expect(buffer.countTotal('guild1', 'ROLE_DELETE', 10_000)).toBe(3);
    });

    it('should not count events outside window', async () => {
      buffer.push('guild1', 'BAN', 'actor1');
      await new Promise((r) => setTimeout(r, 150));
      expect(buffer.countByActor('guild1', 'BAN', 'actor1', 100)).toBe(0);
    });

    it('should track events per guild independently', () => {
      buffer.push('guild1', 'CHANNEL_DELETE', 'actor1');
      buffer.push('guild2', 'CHANNEL_DELETE', 'actor1');

      expect(buffer.countByActor('guild1', 'CHANNEL_DELETE', 'actor1', 10_000)).toBe(1);
      expect(buffer.countByActor('guild2', 'CHANNEL_DELETE', 'actor1', 10_000)).toBe(1);
    });
  });

  describe('threshold detection', () => {
    it('4 channel deletes → below default threshold of 5', () => {
      const THRESHOLD = 5;
      for (let i = 0; i < 4; i++) buffer.push('guild1', 'CHANNEL_DELETE', 'actor1');
      expect(buffer.countByActor('guild1', 'CHANNEL_DELETE', 'actor1', 10_000)).toBeLessThan(THRESHOLD);
    });

    it('5 channel deletes → at threshold', () => {
      const THRESHOLD = 5;
      for (let i = 0; i < 5; i++) buffer.push('guild1', 'CHANNEL_DELETE', 'actor1');
      expect(buffer.countByActor('guild1', 'CHANNEL_DELETE', 'actor1', 10_000)).toBeGreaterThanOrEqual(THRESHOLD);
    });

    it('10 bans → should be way above threshold', () => {
      const THRESHOLD = 5;
      for (let i = 0; i < 10; i++) buffer.push('guild1', 'BAN', 'actor1');
      expect(buffer.countByActor('guild1', 'BAN', 'actor1', 10_000)).toBeGreaterThan(THRESHOLD);
    });
  });

  describe('top actor detection', () => {
    it('should identify the most active actor', () => {
      buffer.push('guild1', 'ROLE_DELETE', 'actor1');
      buffer.push('guild1', 'ROLE_DELETE', 'actor1');
      buffer.push('guild1', 'ROLE_DELETE', 'actor2');

      const top = buffer.getTopActor('guild1', 'ROLE_DELETE', 10_000);
      expect(top?.actorId).toBe('actor1');
      expect(top?.count).toBe(2);
    });

    it('should return null with no events', () => {
      expect(buffer.getTopActor('guild1', 'CHANNEL_DELETE', 10_000)).toBeNull();
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      buffer.push('guild1', 'BAN', 'actor1');
      buffer.reset();
      expect(buffer.countByActor('guild1', 'BAN', 'actor1', 10_000)).toBe(0);
    });
  });
});

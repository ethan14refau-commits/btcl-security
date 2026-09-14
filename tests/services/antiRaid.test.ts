import { describe, it, expect, beforeEach } from 'vitest';
import { JoinTracker } from '../../src/services/antiRaid/JoinTracker.js';

describe('JoinTracker', () => {
  let tracker: JoinTracker;

  beforeEach(() => {
    tracker = JoinTracker.getInstance();
    tracker.reset();
  });

  describe('join counting', () => {
    it('should return 0 when no joins recorded', () => {
      expect(tracker.getJoinsInWindow('guild1', 10_000)).toBe(0);
    });

    it('should count 9 joins — below default threshold of 10', () => {
      for (let i = 0; i < 9; i++) {
        tracker.recordJoin('guild1');
      }
      const count = tracker.getJoinsInWindow('guild1', 10_000);
      expect(count).toBe(9);
    });

    it('should count exactly 10 joins — at default threshold', () => {
      for (let i = 0; i < 10; i++) {
        tracker.recordJoin('guild1');
      }
      const count = tracker.getJoinsInWindow('guild1', 10_000);
      expect(count).toBe(10);
    });

    it('should count 11 joins — above default threshold', () => {
      for (let i = 0; i < 11; i++) {
        tracker.recordJoin('guild1');
      }
      const count = tracker.getJoinsInWindow('guild1', 10_000);
      expect(count).toBe(11);
    });

    it('should not count joins outside the window', async () => {
      tracker.recordJoin('guild1');

      // Wait slightly longer than 100ms window
      await new Promise((r) => setTimeout(r, 150));

      // Joins outside the 100ms window shouldn't count
      const count = tracker.getJoinsInWindow('guild1', 100);
      expect(count).toBe(0);
    });

    it('should track joins per guild independently', () => {
      for (let i = 0; i < 5; i++) tracker.recordJoin('guild1');
      for (let i = 0; i < 3; i++) tracker.recordJoin('guild2');

      expect(tracker.getJoinsInWindow('guild1', 10_000)).toBe(5);
      expect(tracker.getJoinsInWindow('guild2', 10_000)).toBe(3);
    });

    it('should handle reset correctly', () => {
      for (let i = 0; i < 10; i++) tracker.recordJoin('guild1');
      tracker.reset();
      expect(tracker.getJoinsInWindow('guild1', 10_000)).toBe(0);
    });
  });

  describe('message spam tracking', () => {
    it('should count messages per user per guild', () => {
      for (let i = 0; i < 5; i++) {
        tracker.recordMessage('guild1', 'user1');
      }
      tracker.recordMessage('guild1', 'user2');

      expect(tracker.getMessagesInWindow('guild1', 'user1', 10_000)).toBe(5);
      expect(tracker.getMessagesInWindow('guild1', 'user2', 10_000)).toBe(1);
    });

    it('should return 0 for user with no messages', () => {
      expect(tracker.getMessagesInWindow('guild1', 'unknown_user', 10_000)).toBe(0);
    });
  });

  describe('threshold edge cases', () => {
    it('9 joins in 10s → below threshold (10)', () => {
      const THRESHOLD = 10;
      for (let i = 0; i < 9; i++) tracker.recordJoin('guild1');
      expect(tracker.getJoinsInWindow('guild1', 10_000)).toBeLessThan(THRESHOLD);
    });

    it('10 joins in 10s → at threshold', () => {
      const THRESHOLD = 10;
      for (let i = 0; i < 10; i++) tracker.recordJoin('guild1');
      expect(tracker.getJoinsInWindow('guild1', 10_000)).toBeGreaterThanOrEqual(THRESHOLD);
    });

    it('11 joins in 10s → above threshold', () => {
      const THRESHOLD = 10;
      for (let i = 0; i < 11; i++) tracker.recordJoin('guild1');
      expect(tracker.getJoinsInWindow('guild1', 10_000)).toBeGreaterThan(THRESHOLD);
    });
  });
});

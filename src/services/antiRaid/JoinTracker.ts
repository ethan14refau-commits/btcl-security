/**
 * In-memory sliding window tracker for guild member joins.
 * Stores timestamps of recent joins per guild.
 * Automatically cleans up old entries to prevent memory leaks.
 */
export class JoinTracker {
  private static instance: JoinTracker;

  /** guildId → array of join timestamps (ms) */
  private joins: Map<string, number[]> = new Map();

  /** guildId → per-user message timestamps for spam detection */
  private messages: Map<string, Map<string, number[]>> = new Map();

  private readonly CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
  private readonly MAX_WINDOW_MS = 5 * 60 * 1000;   // 5 minutes max tracking window

  private constructor() {
    // Periodic cleanup of old entries
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL_MS).unref();
  }

  public static getInstance(): JoinTracker {
    if (!JoinTracker.instance) {
      JoinTracker.instance = new JoinTracker();
    }
    return JoinTracker.instance;
  }

  /**
   * Record a member join for a guild.
   */
  public recordJoin(guildId: string): void {
    const now = Date.now();
    const existing = this.joins.get(guildId) ?? [];
    existing.push(now);
    this.joins.set(guildId, existing);
  }

  /**
   * Get the count of joins in the last N milliseconds for a guild.
   */
  public getJoinsInWindow(guildId: string, windowMs: number): number {
    const now = Date.now();
    const entries = this.joins.get(guildId) ?? [];
    return entries.filter((ts) => now - ts <= windowMs).length;
  }

  /**
   * Get all join timestamps in a window (for returning member IDs).
   */
  public getJoinTimestamps(guildId: string, windowMs: number): number[] {
    const now = Date.now();
    return (this.joins.get(guildId) ?? []).filter((ts) => now - ts <= windowMs);
  }

  /**
   * Record a message from a user in a guild.
   */
  public recordMessage(guildId: string, userId: string): void {
    const now = Date.now();
    if (!this.messages.has(guildId)) {
      this.messages.set(guildId, new Map());
    }
    const guildMessages = this.messages.get(guildId)!;
    const userMessages = guildMessages.get(userId) ?? [];
    userMessages.push(now);
    guildMessages.set(userId, userMessages);
  }

  /**
   * Get message count for a user in a guild within the last N ms.
   */
  public getMessagesInWindow(guildId: string, userId: string, windowMs: number): number {
    const now = Date.now();
    const guildMessages = this.messages.get(guildId);
    if (!guildMessages) return 0;
    const userMessages = guildMessages.get(userId) ?? [];
    return userMessages.filter((ts) => now - ts <= windowMs).length;
  }

  /**
   * Clean up entries older than MAX_WINDOW_MS.
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.MAX_WINDOW_MS;

    for (const [guildId, timestamps] of this.joins) {
      const fresh = timestamps.filter((ts) => ts > cutoff);
      if (fresh.length === 0) {
        this.joins.delete(guildId);
      } else {
        this.joins.set(guildId, fresh);
      }
    }

    for (const [guildId, userMap] of this.messages) {
      for (const [userId, timestamps] of userMap) {
        const fresh = timestamps.filter((ts) => ts > cutoff);
        if (fresh.length === 0) {
          userMap.delete(userId);
        } else {
          userMap.set(userId, fresh);
        }
      }
      if (userMap.size === 0) this.messages.delete(guildId);
    }
  }

  /** For testing — reset all state */
  public reset(): void {
    this.joins.clear();
    this.messages.clear();
  }

  /** For testing — get raw join data */
  public getRawJoins(guildId: string): number[] {
    return this.joins.get(guildId) ?? [];
  }
}

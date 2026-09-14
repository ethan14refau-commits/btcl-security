/**
 * In-memory event counter for anti-nuke detection.
 * Tracks counts of destructive events per guild per actor within a sliding window.
 */

export type NukeEventType =
  | 'CHANNEL_DELETE'
  | 'CHANNEL_CREATE'
  | 'CHANNEL_UPDATE'
  | 'ROLE_DELETE'
  | 'ROLE_CREATE'
  | 'ROLE_UPDATE'
  | 'BAN'
  | 'KICK'
  | 'TIMEOUT'
  | 'WEBHOOK_CREATE'
  | 'WEBHOOK_DELETE'
  | 'WEBHOOK_UPDATE';

interface EventEntry {
  type: NukeEventType;
  actorId: string;
  timestamp: number;
}

export class EventBuffer {
  private static instance: EventBuffer;

  /** guildId → array of events */
  private buffer: Map<string, EventEntry[]> = new Map();

  private readonly CLEANUP_INTERVAL_MS = 30 * 1000;
  private readonly MAX_WINDOW_MS = 60 * 1000; // 1 minute retention

  private constructor() {
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL_MS).unref();
  }

  public static getInstance(): EventBuffer {
    if (!EventBuffer.instance) {
      EventBuffer.instance = new EventBuffer();
    }
    return EventBuffer.instance;
  }

  /**
   * Push a new event into the buffer.
   */
  public push(guildId: string, type: NukeEventType, actorId: string): void {
    const existing = this.buffer.get(guildId) ?? [];
    existing.push({ type, actorId, timestamp: Date.now() });
    this.buffer.set(guildId, existing);
  }

  /**
   * Count events of a type for a specific actor in the last N ms.
   */
  public countByActor(
    guildId: string,
    type: NukeEventType,
    actorId: string,
    windowMs: number
  ): number {
    const now = Date.now();
    const entries = this.buffer.get(guildId) ?? [];
    return entries.filter(
      (e) => e.type === type && e.actorId === actorId && now - e.timestamp <= windowMs
    ).length;
  }

  /**
   * Count ALL events of a type in the last N ms (any actor).
   */
  public countTotal(guildId: string, type: NukeEventType, windowMs: number): number {
    const now = Date.now();
    const entries = this.buffer.get(guildId) ?? [];
    return entries.filter((e) => e.type === type && now - e.timestamp <= windowMs).length;
  }

  /**
   * Get the most active actor for an event type in the last N ms.
   */
  public getTopActor(
    guildId: string,
    type: NukeEventType,
    windowMs: number
  ): { actorId: string; count: number } | null {
    const now = Date.now();
    const entries = this.buffer.get(guildId) ?? [];
    const actorCounts = new Map<string, number>();

    for (const e of entries) {
      if (e.type === type && now - e.timestamp <= windowMs) {
        actorCounts.set(e.actorId, (actorCounts.get(e.actorId) ?? 0) + 1);
      }
    }

    if (actorCounts.size === 0) return null;

    let topActor = '';
    let topCount = 0;
    for (const [actorId, count] of actorCounts) {
      if (count > topCount) {
        topActor = actorId;
        topCount = count;
      }
    }

    return { actorId: topActor, count: topCount };
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.MAX_WINDOW_MS;
    for (const [guildId, entries] of this.buffer) {
      const fresh = entries.filter((e) => e.timestamp > cutoff);
      if (fresh.length === 0) {
        this.buffer.delete(guildId);
      } else {
        this.buffer.set(guildId, fresh);
      }
    }
  }

  /** For testing */
  public reset(): void {
    this.buffer.clear();
  }
}

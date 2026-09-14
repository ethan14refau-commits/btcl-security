/**
 * Parse a human-readable duration string into milliseconds.
 * Supported units: s, m, h, d (e.g., "10m", "2h", "1d", "30s")
 */
export function parseDuration(input: string): number | null {
  const match = /^(\d+)(s|m|h|d)$/.exec(input.trim().toLowerCase());
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

/**
 * Convert milliseconds into a human-readable duration string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/**
 * Return the Discord timestamp tag for a given Date or ms timestamp.
 * style: 't' = short time, 'T' = long time, 'd' = short date, 'D' = long date,
 *        'f' = short datetime (default), 'F' = long datetime, 'R' = relative
 */
export function discordTimestamp(
  date: Date | number,
  style: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'f'
): string {
  const unix = Math.floor((date instanceof Date ? date.getTime() : date) / 1000);
  return `<t:${unix}:${style}>`;
}

/**
 * Calculate the age of a Discord account from its ID (snowflake).
 */
export function accountAgeMs(userId: string): number {
  const DISCORD_EPOCH = 1420070400000n;
  const snowflake = BigInt(userId);
  const timestamp = Number((snowflake >> 22n) + DISCORD_EPOCH);
  return Date.now() - timestamp;
}

/**
 * Check if an account is newer than the given threshold in ms.
 */
export function isNewAccount(userId: string, thresholdMs: number): boolean {
  return accountAgeMs(userId) < thresholdMs;
}

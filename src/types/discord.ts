import { Client, Collection } from 'discord.js';
import { Command } from './command.js';

/**
 * Extended Discord.js Client with a commands collection and global state.
 */
export class BotClient extends Client {
  public commands: Collection<string, Command> = new Collection();

  /** Whether the bot has finished its ready routine */
  public isReady = false;
}

/** Severity levels for security events */
export type SecuritySeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Anti-raid detection levels */
export type RaidLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

/** Whitelist entry types */
export type WhitelistType = 'USER' | 'ROLE' | 'BOT';

/** Moderation case types */
export type ModerationCaseType =
  | 'BAN'
  | 'UNBAN'
  | 'KICK'
  | 'TIMEOUT'
  | 'UNTIMEOUT'
  | 'WARN'
  | 'CLEAR'
  | 'LOCK'
  | 'UNLOCK';

/** Security event types */
export type SecurityEventType =
  | 'RAID_DETECTED'
  | 'RAID_ACTION'
  | 'NUKE_DETECTED'
  | 'NUKE_ACTION'
  | 'LOCKDOWN_START'
  | 'LOCKDOWN_END'
  | 'CONFIG_CHANGE'
  | 'WHITELIST_ADD'
  | 'WHITELIST_REMOVE'
  | 'OWNER_ADD'
  | 'OWNER_REMOVE'
  | 'AUTH_FAILURE';

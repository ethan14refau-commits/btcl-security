# Requirements — Discord Security Bot

## Introduction

Professional Discord security, moderation, anti-raid, and anti-nuke bot with a web dashboard. Built with TypeScript, Discord.js v14, Prisma ORM, and a modern React dashboard secured with Discord OAuth2.

---

## Functional Requirements

### FR-01 — Bot Owner System

- MUST read owner IDs from `OWNER_IDS` environment variable at startup.
- MUST support runtime addition/removal of owners via `/owner add|remove|list`.
- MUST persist owners in the database across restarts.
- MUST expose a `requireBotOwner()` middleware that rejects non-owners.
- MUST NOT automatically grant owner status to server admins, moderators, or guild owners.

### FR-02 — Anti-Raid System

- MUST detect: mass joins, very recent accounts, join waves, message spam, mass mentions, suspicious bots, mass channel creation/deletion, mass role creation/deletion, mass permission changes, mass webhook creation.
- MUST support four detection levels: LOW, MEDIUM, HIGH, EXTREME.
- MUST store configurable thresholds per guild in the database.
- MUST support actions: LOG, ALERT, TIMEOUT, KICK, BAN, LOCKDOWN, delete suspicious messages.
- MUST expose commands: `/security antiraid enable|disable|level|config`.
- MUST NOT take irreversible action (ban/kick) when confidence is low.

### FR-03 — Anti-Nuke System

- MUST monitor: mass channel create/delete/edit, mass role create/delete/edit, admin permission grants, critical permission modifications, mass webhook create/delete/edit, mass bans, mass kicks, mass timeouts.
- MUST consult Discord Audit Log to identify the responsible actor.
- MUST check the whitelist before applying any action.
- MUST log every detected event regardless of whitelist status.
- MUST apply configured response action after threshold is exceeded.

### FR-04 — Whitelist

- MUST support per-guild whitelisting of users, roles, and bots.
- MUST expose commands: `/security whitelist add|remove|list`.
- MUST store entries in the database with type and guild context.
- Whitelisted actors MUST bypass automated sanctions but MUST still be logged.

### FR-05 — Logging System

- MUST support a configurable log channel per guild via `/logs channel`.
- MUST log: joins, leaves, bans, kicks, timeouts, warnings, deleted messages, edited messages, role changes, permission changes, channel changes, webhook events, audit log events, anti-raid events, anti-nuke events, errors, configuration changes.
- MUST produce clean Discord embeds with: user, ID, action, timestamp, guild, reason, danger level, action taken.

### FR-06 — Moderation Commands

- MUST implement: `/ban`, `/unban`, `/kick`, `/timeout`, `/untimeout`, `/warn`, `/warnings`, `/clear`, `/lock`, `/unlock`.
- Each command MUST verify caller permissions before executing.
- Each command MUST accept a `reason` parameter.
- Each command MUST create a moderation case log entry.
- MUST verify role hierarchy — bot cannot moderate users above itself or the caller.
- MUST handle all Discord API errors gracefully.

### FR-07 — Per-Guild Configuration

- MUST store a full config record per guild: anti-raid state, anti-nuke state, thresholds, log channel, whitelist reference, moderation settings, lockdown settings.
- Config MUST survive bot restarts.
- MUST use database transactions for multi-step config changes.

### FR-08 — Database

- MUST use Prisma ORM.
- MUST use SQLite in development, PostgreSQL-compatible schema for production.
- MUST define models: `Guild`, `GuildConfig`, `BotOwner`, `WhitelistEntry`, `SecurityEvent`, `ModerationCase`, `OAuthSession`.
- MUST include migrations.

### FR-09 — Dashboard

- MUST authenticate via Discord OAuth2 (official only).
- MUST display user's guilds where they have Manage Guild permission.
- MUST allow configuration of: bot on/off per module, anti-raid level/thresholds, anti-nuke toggles, whitelist management, log channel selection, bot activity (bot's own presence).
- MUST display security event history and statistics.
- MUST verify permissions server-side on every API request.
- MUST NEVER trust frontend-only data for authorization decisions.

### FR-10 — OAuth2

- MUST implement standard OAuth2 authorization code flow.
- MUST use and validate `state` parameter (CSRF protection).
- MUST store sessions with expiry in the database or signed cookies.
- MUST support logout and session invalidation.
- MUST validate all callback parameters before trusting them.
- MUST NEVER request or store Discord user passwords or user tokens.

### FR-11 — Bot Activity (Official Only)

- MUST allow Bot Owners to configure the **bot's own** Discord activity (type, name, URL) via dashboard or command.
- MUST NOT attempt to modify any user account's activity.
- MUST NOT use self-bots, user tokens, or unofficial endpoints.
- Displayed example: bot shows `Streaming — gg/btcl` in its own profile.

### FR-12 — Lockdown

- MUST support guild-wide or per-channel lockdown (denies `SEND_MESSAGES` for `@everyone`).
- MUST support timed lockdown with automatic unlock.
- MUST log lockdown start, end, and reason.

---

## Non-Functional Requirements

### NFR-01 — Security

- All sensitive commands protected by `requireBotOwner()`.
- Rate limiting on all API endpoints.
- CSRF protection on state-mutating endpoints.
- HttpOnly, Secure, SameSite cookies.
- Zod validation on all inputs.
- No secrets exposed to frontend.
- Parameterized queries via Prisma (no raw SQL injection risk).
- Security event logging.

### NFR-02 — Reliability

- Graceful error handling — bot MUST NOT crash on unhandled rejections.
- All Discord API errors caught and logged.
- Database connection retry logic.

### NFR-03 — Maintainability

- TypeScript strict mode throughout.
- Modular file structure — no god files.
- ESLint + Prettier enforced.
- Clear separation: commands / events / services / database / API / dashboard.

### NFR-04 — Testability

- Vitest for all unit tests.
- Tests for: owner middleware, whitelist logic, raid threshold calculations, nuke detection, permission checks, Zod schemas, OAuth2 flows.
- Edge cases tested (e.g., 9 joins = no action, 10 joins = action).

### NFR-05 — Discord API Constraints

| Feature | API Status | Implementation |
|---|---|---|
| Bot own activity | ✅ Supported | `client.user.setActivity()` |
| User account activity via OAuth2 | ❌ Not supported | Bot activity only |
| Reading audit logs | ✅ Supported (requires `VIEW_AUDIT_LOG`) | Used for nuke attribution |
| Slash commands | ✅ Supported | All commands as slash commands |
| Timeout members | ✅ Supported (requires `MODERATE_MEMBERS`) | Used for timeouts |
| Self-bot / user token | ❌ Prohibited | Never used |

---

## Required Discord Intents

```
Guilds
GuildMembers (privileged)
GuildModeration
GuildMessages
GuildMessageReactions
MessageContent (privileged)
GuildVoiceStates
DirectMessages
```

## Required Bot Permissions

```
Administrator (for full protection — or at minimum):
  ManageGuild
  ManageChannels
  ManageRoles
  ManageWebhooks
  KickMembers
  BanMembers
  ModerateMembers
  ViewAuditLog
  SendMessages
  EmbedLinks
  ReadMessageHistory
  ViewChannel
  ManageMessages
```

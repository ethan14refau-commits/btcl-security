# Implementation Tasks — Discord Security Bot

## PHASE 1 — Project Initialization

- [x] Create root `package.json` with all dependencies and npm scripts
- [x] Create `tsconfig.json` (strict mode, paths, composite)
- [x] Create `.eslintrc.json` with TypeScript rules
- [x] Create `.prettierrc`
- [x] Create `vitest.config.ts`
- [x] Create `.env.example` with all required variables
- [x] Create folder structure as per design
- [x] Install all dependencies

## PHASE 2 — Discord.js Client + Loaders

- [x] `src/config/index.ts` — env validation with Zod
- [x] `src/types/command.ts` — Command interface
- [x] `src/types/event.ts` — Event interface
- [x] `src/bot/index.ts` — client initialization, intent setup
- [x] `src/bot/loader.ts` — dynamic command + event loader
- [x] `src/bot/deploy.ts` — slash command deployment script
- [x] `src/events/ready.ts`
- [x] `src/events/interactionCreate.ts`
- [x] `src/utils/logger.ts` — winston structured logger
- [x] `src/utils/embeds.ts` — embed builders
- [x] `src/utils/permissions.ts` — permission helpers
- [x] `src/utils/time.ts` — duration parsers

## PHASE 3 — Prisma + Database

- [x] `prisma/schema.prisma` — all models
- [x] `src/database/client.ts` — Prisma client singleton
- [x] Repository files for all models
- [x] Run initial migration (`db:migrate`)
- [x] `npm run db:generate`

## PHASE 4 — Bot Owner System

- [x] `src/middleware/requireBotOwner.ts`
- [x] `src/database/repositories/OwnerRepository.ts`
- [x] `src/commands/owner/owner.ts` — add/remove/list subcommands
- [x] Seed OWNER_IDS from env at startup

## PHASE 5 — Logging System

- [x] `src/services/logging/LogService.ts`
- [x] `src/commands/configuration/logs.ts` — `/logs channel`
- [x] Wire all Discord events to LogService
- [x] Events: join, leave, ban, kick, timeout, warn, message delete/edit, role/channel/permission changes, webhook events, anti-raid, anti-nuke, config changes

## PHASE 6 — Moderation Commands

- [x] `src/services/moderation/ModerationService.ts`
- [x] `/ban`, `/unban`, `/kick`
- [x] `/timeout`, `/untimeout`
- [x] `/warn`, `/warnings`
- [x] `/clear`
- [x] `/lock`, `/unlock`
- [x] Hierarchy check utility
- [x] ModerationCase repository writes

## PHASE 7 — Whitelist

- [x] `src/services/whitelist/WhitelistService.ts`
- [x] `src/database/repositories/WhitelistRepository.ts`
- [x] `/security whitelist add|remove|list`

## PHASE 8 — Anti-Raid

- [x] `src/services/antiRaid/JoinTracker.ts` — in-memory sliding window
- [x] `src/services/antiRaid/RaidDetector.ts` — threshold analysis
- [x] `src/services/antiRaid/RaidAction.ts` — action dispatcher
- [x] `/security antiraid enable|disable|level|config`
- [x] Wire `guildMemberAdd` event to RaidDetector
- [x] SecurityEvent writes for all detections

## PHASE 9 — Anti-Nuke

- [x] `src/services/antiNuke/EventBuffer.ts` — in-memory event counter per guild
- [x] `src/services/antiNuke/NukeDetector.ts` — threshold + audit log attribution
- [x] `src/services/antiNuke/NukeAction.ts` — actor response actions
- [x] Wire: channelCreate/Delete/Update, roleCreate/Delete/Update, guildBanAdd, webhookUpdate
- [x] `/security antinuke enable|disable|config`

## PHASE 10 — Lockdown

- [x] `src/services/security/LockdownService.ts`
- [x] `/security lockdown start|end` with optional duration + channel scope
- [x] Auto-unlock timer
- [x] Log lockdown events

## PHASE 11 — API Backend

- [x] `dashboard/backend/src/app.ts` — Express + middleware stack
- [x] `dashboard/backend/src/server.ts` — HTTP server
- [x] Rate limiting middleware
- [x] CSRF middleware
- [x] Zod validation middleware
- [x] Session middleware (cookie-based)
- [x] Auth middleware
- [x] `routes/auth.ts`
- [x] `routes/guilds.ts` — GET config, PATCH config
- [x] `routes/security.ts` — GET events, GET stats
- [x] `routes/bot.ts` — GET status, PATCH activity

## PHASE 12 — Discord OAuth2

- [x] `dashboard/backend/src/oauth/discord.ts`
- [x] GET /auth/discord — redirect to Discord
- [x] GET /auth/callback — exchange code, set session
- [x] GET /auth/me — return current user
- [x] GET /auth/logout — invalidate session
- [x] State + CSRF validation
- [x] OAuthSession DB storage

## PHASE 13 — Dashboard Frontend

- [x] React + Vite setup
- [x] Login page with "Login with Discord" button
- [x] OAuth2 callback page
- [x] Guild selection page
- [x] Guild config page (anti-raid, anti-nuke, logs, whitelist panels)
- [x] Security events page with table
- [x] Bot status + activity configuration page
- [x] Responsive design with Tailwind CSS
- [x] API client with auth handling

## PHASE 14 — Bot Activity Configuration

- [x] Store activity config in GuildConfig.botActivity (global for bot owners)
- [x] PATCH /api/bot/activity endpoint (owner-only)
- [x] Bot reads activity on startup and on config update
- [x] Dashboard UI panel for activity configuration

## PHASE 15 — Tests

- [x] `tests/middleware/requireBotOwner.test.ts`
- [x] `tests/services/antiRaid.test.ts` (9/10/11 joins edge cases)
- [x] `tests/services/antiNuke.test.ts`
- [x] `tests/services/whitelist.test.ts`
- [x] `tests/api/auth.test.ts`
- [x] `tests/api/guilds.test.ts`
- [x] `tests/utils/permissions.test.ts`

## PHASE 16 — Security Hardening

- [x] Review all API endpoints for missing auth checks
- [x] Confirm no secrets in any source file
- [x] Confirm cookie flags: httpOnly, secure (prod), sameSite
- [x] Confirm Zod validation on all inputs
- [x] Confirm rate limits applied
- [x] Add security event logging for failed auth attempts

## PHASE 17 — Build + Documentation

- [x] `npm run build` passes with zero errors
- [x] `npm run test` all pass
- [x] `npm run lint` zero warnings
- [x] `README.md` complete with all sections
- [x] `docker-compose.yml` for production deployment
- [x] Final architecture review

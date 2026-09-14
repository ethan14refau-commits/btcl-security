# Design — Discord Security Bot

## Architecture Overview

```
heheheha/
├── src/
│   ├── bot/
│   │   ├── index.ts                  # Bot entry point, client init
│   │   ├── loader.ts                 # Command + event loader
│   │   └── deploy.ts                 # Slash command deployment script
│   │
│   ├── commands/
│   │   ├── owner/
│   │   │   └── owner.ts
│   │   ├── moderation/
│   │   │   ├── ban.ts
│   │   │   ├── unban.ts
│   │   │   ├── kick.ts
│   │   │   ├── timeout.ts
│   │   │   ├── untimeout.ts
│   │   │   ├── warn.ts
│   │   │   ├── warnings.ts
│   │   │   ├── clear.ts
│   │   │   ├── lock.ts
│   │   │   └── unlock.ts
│   │   ├── security/
│   │   │   ├── antiraid.ts
│   │   │   ├── antinuke.ts
│   │   │   └── whitelist.ts
│   │   ├── configuration/
│   │   │   └── logs.ts
│   │   └── utility/
│   │       └── status.ts
│   │
│   ├── events/
│   │   ├── ready.ts
│   │   ├── guildMemberAdd.ts
│   │   ├── guildMemberRemove.ts
│   │   ├── guildBanAdd.ts
│   │   ├── guildBanRemove.ts
│   │   ├── messageCreate.ts
│   │   ├── messageDelete.ts
│   │   ├── messageUpdate.ts
│   │   ├── channelCreate.ts
│   │   ├── channelDelete.ts
│   │   ├── channelUpdate.ts
│   │   ├── roleCreate.ts
│   │   ├── roleDelete.ts
│   │   ├── roleUpdate.ts
│   │   ├── guildUpdate.ts
│   │   └── interactionCreate.ts
│   │
│   ├── services/
│   │   ├── antiRaid/
│   │   │   ├── RaidDetector.ts
│   │   │   ├── RaidAction.ts
│   │   │   └── JoinTracker.ts
│   │   ├── antiNuke/
│   │   │   ├── NukeDetector.ts
│   │   │   ├── NukeAction.ts
│   │   │   └── EventBuffer.ts
│   │   ├── moderation/
│   │   │   └── ModerationService.ts
│   │   ├── logging/
│   │   │   └── LogService.ts
│   │   ├── whitelist/
│   │   │   └── WhitelistService.ts
│   │   └── security/
│   │       └── LockdownService.ts
│   │
│   ├── middleware/
│   │   ├── requireBotOwner.ts
│   │   └── requireGuildPermission.ts
│   │
│   ├── database/
│   │   ├── client.ts                 # Prisma client singleton
│   │   └── repositories/
│   │       ├── GuildRepository.ts
│   │       ├── OwnerRepository.ts
│   │       ├── WhitelistRepository.ts
│   │       ├── SecurityEventRepository.ts
│   │       └── ModerationRepository.ts
│   │
│   ├── config/
│   │   └── index.ts                  # Env validation + typed config
│   │
│   ├── types/
│   │   ├── command.ts
│   │   ├── event.ts
│   │   └── discord.ts
│   │
│   └── utils/
│       ├── embeds.ts
│       ├── permissions.ts
│       ├── time.ts
│       └── logger.ts
│
├── dashboard/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── app.ts                # Express app setup
│   │   │   ├── server.ts             # HTTP server entry
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts           # OAuth2 routes
│   │   │   │   ├── guilds.ts         # Guild config API
│   │   │   │   ├── security.ts       # Security events API
│   │   │   │   └── bot.ts            # Bot status/activity API
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # Session check
│   │   │   │   ├── rateLimit.ts
│   │   │   │   └── validate.ts       # Zod middleware
│   │   │   ├── oauth/
│   │   │   │   └── discord.ts        # OAuth2 flow
│   │   │   └── schemas/
│   │   │       └── index.ts          # Zod schemas
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/
│       ├── src/
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── Login.tsx
│       │   │   ├── Dashboard.tsx
│       │   │   ├── GuildSelect.tsx
│       │   │   ├── GuildConfig.tsx
│       │   │   ├── SecurityEvents.tsx
│       │   │   └── Callback.tsx
│       │   ├── components/
│       │   │   ├── Navbar.tsx
│       │   │   ├── GuildCard.tsx
│       │   │   ├── ConfigPanel.tsx
│       │   │   ├── EventTable.tsx
│       │   │   └── StatsCard.tsx
│       │   ├── hooks/
│       │   │   └── useAuth.ts
│       │   └── api/
│       │       └── client.ts
│       ├── package.json
│       └── tsconfig.json
│
├── prisma/
│   └── schema.prisma
│
├── tests/
│   ├── middleware/
│   │   └── requireBotOwner.test.ts
│   ├── services/
│   │   ├── antiRaid.test.ts
│   │   ├── antiNuke.test.ts
│   │   └── whitelist.test.ts
│   ├── api/
│   │   ├── auth.test.ts
│   │   └── guilds.test.ts
│   └── utils/
│       └── permissions.test.ts
│
├── .env.example
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── vitest.config.ts
├── docker-compose.yml
└── README.md
```

---

## Data Model

### Guild
```
id            String   @id  (Discord guild ID)
name          String
createdAt     DateTime
updatedAt     DateTime
config        GuildConfig?
whitelistEntries WhitelistEntry[]
securityEvents   SecurityEvent[]
moderationCases  ModerationCase[]
```

### GuildConfig
```
id                  String   @id
guildId             String   @unique
antiraidEnabled     Boolean  @default(false)
antiraidLevel       String   @default("MEDIUM")  -- LOW|MEDIUM|HIGH|EXTREME
antinukeEnabled     Boolean  @default(false)
logChannelId        String?
lockdownActive      Boolean  @default(false)
raidThresholds      Json     -- { joins10s, joins30s, joins2m, ... }
antinukeThresholds  Json     -- { channelDelete, roleDelete, banCount, ... }
moderationSettings  Json     -- { dmOnPunish, ... }
botActivity         Json?    -- { type, name, url }
createdAt           DateTime
updatedAt           DateTime
```

### BotOwner
```
id        String   @id
userId    String   @unique
addedBy   String
addedAt   DateTime
```

### WhitelistEntry
```
id        String   @id
guildId   String
targetId  String   -- user/role/bot ID
type      String   -- USER | ROLE | BOT
addedBy   String
addedAt   DateTime
```

### SecurityEvent
```
id          String   @id
guildId     String
type        String   -- RAID | NUKE | MODERATION | CONFIG | ...
severity    String   -- INFO | LOW | MEDIUM | HIGH | CRITICAL
actorId     String?
targetId    String?
action      String
details     Json
createdAt   DateTime
```

### ModerationCase
```
id            String   @id (auto-increment case number)
guildId       String
type          String   -- BAN | KICK | TIMEOUT | WARN | UNBAN | ...
targetId      String
targetTag     String
moderatorId   String
moderatorTag  String
reason        String?
duration      Int?     -- ms for timeout
active        Boolean  @default(true)
createdAt     DateTime
```

### OAuthSession
```
id           String   @id
userId       String
accessToken  String   -- encrypted at rest
refreshToken String?
expiresAt    DateTime
createdAt    DateTime
```

---

## Key Service Flows

### Anti-Raid Join Flow
```
guildMemberAdd event
  → JoinTracker.record(guildId, memberId, timestamp, accountAge)
  → RaidDetector.analyze(guildId)
      → query thresholds from GuildConfig
      → count joins in last 10s / 30s / 2min windows
      → compute confidence score
      → if threshold exceeded AND antiraid enabled:
          → RaidAction.execute(guildId, members, level)
              → LOG always
              → ALERT if level >= MEDIUM
              → TIMEOUT if level >= HIGH
              → KICK/BAN if level == EXTREME
              → LOCKDOWN if configured
  → LogService.logRaidEvent(...)
```

### Anti-Nuke Detection Flow
```
channelDelete / roleDelete / banAdd / etc. event
  → EventBuffer.push(guildId, eventType, timestamp)
  → NukeDetector.analyze(guildId, eventType)
      → count events of type in last 10s window
      → fetch Audit Log entry for attribution
      → check WhitelistService.isWhitelisted(guildId, actorId)
      → if NOT whitelisted AND threshold exceeded AND antinuke enabled:
          → NukeAction.execute(guildId, actorId, eventType)
              → strip dangerous roles / timeout / ban actor
              → attempt to restore deleted resources if possible
      → SecurityEventRepository.create(event)
  → LogService.logNukeEvent(...)
```

### OAuth2 Flow
```
User clicks "Login" on dashboard
  → GET /auth/discord
      → generate state (crypto.randomUUID)
      → store state in signed cookie
      → redirect to Discord OAuth2 URL with state + scopes
  
  → Discord redirects to /auth/callback?code=...&state=...
      → validate state matches cookie
      → exchange code for tokens (server-side POST to Discord)
      → fetch user info from Discord API
      → create/update OAuthSession in DB
      → set HttpOnly session cookie
      → redirect to dashboard
  
  GET /auth/logout
      → invalidate OAuthSession
      → clear cookie
      → redirect to login
```

---

## Security Architecture

### Layers
1. **Discord permissions** — bot checks guild member permissions before executing.
2. **Bot Owner middleware** — `requireBotOwner()` wraps sensitive commands.
3. **Whitelist** — anti-protection bypass for trusted actors, still logged.
4. **Dashboard API** — every request validates session cookie + re-fetches user guilds from Discord API to confirm `MANAGE_GUILD` permission.
5. **Input validation** — Zod on all command options and API request bodies.
6. **Rate limiting** — express-rate-limit on all API routes.
7. **CSRF** — state param + SameSite cookies for OAuth2; double-submit cookie for API mutations.
8. **Secrets** — never in source, only `.env`.

### Cookie Config (production)
```
httpOnly: true
secure: true
sameSite: 'lax'
maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
signed: true (using SESSION_SECRET)
```

---

## Technology Decisions

| Decision | Choice | Reason |
|---|---|---|
| ORM | Prisma | Type-safe, migration support, SQLite + PG dual |
| Validation | Zod | Runtime + compile-time safety |
| Test framework | Vitest | Fast, native ESM, compatible with TS |
| Dashboard frontend | React + Vite | Lightweight, no SSR complexity needed |
| Dashboard backend | Express | Mature, well-understood, easy to secure |
| Session storage | DB (OAuthSession model) | Survives restarts, revocable |
| Rate limiting | express-rate-limit | Simple, effective |
| Logging (internal) | winston | Structured JSON logs |

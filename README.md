# 🛡️ Discord Security Bot

A professional, production-ready Discord security bot featuring Anti-Raid, Anti-Nuke, moderation, whitelist, and a modern web dashboard — built with TypeScript, Discord.js v14, Prisma, and React.

---

## Features

| Feature | Description |
|---|---|
| 🛡️ **Anti-Raid** | Detects and responds to mass joins, spam, mass mentions |
| ☢️ **Anti-Nuke** | Detects mass channel/role deletions, mass bans/kicks |
| 🔨 **Moderation** | `/ban`, `/kick`, `/timeout`, `/warn`, `/clear`, `/lock`, `/unlock` |
| 👑 **Bot Owners** | Independent owner system, separate from Discord permissions |
| 📝 **Whitelist** | Per-guild whitelist for trusted users, roles, bots |
| 📜 **Logging** | Full audit log to a Discord channel |
| 🔒 **Lockdown** | Guild-wide or per-channel lockdown with auto-unlock |
| 🌐 **Dashboard** | Web dashboard with Discord OAuth2 |
| 🔑 **OAuth2** | Official Discord OAuth2 — no password, no user tokens |

---

## Prerequisites

- **Node.js** v20 or higher — https://nodejs.org/
- **npm** (included with Node.js)
- A Discord application + bot token

---

## 1 — Create a Discord Application

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name
3. Go to **Bot** tab:
   - Click **Add Bot**
   - Copy the **Bot Token** (keep this secret!)
   - Enable **Server Members Intent** (Privileged Gateway Intents)
   - Enable **Message Content Intent** (Privileged Gateway Intents)
4. Go to **OAuth2** → **General**:
   - Copy the **Client ID**
   - Copy the **Client Secret**
5. Add your redirect URI:
   - **Development**: `http://localhost:3001/auth/callback`
   - **Production**: `https://yourdomain.com/auth/callback`

---

## 2 — Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id
CLIENT_SECRET=your_application_client_secret
OWNER_IDS=your_discord_user_id
DATABASE_URL=file:./prisma/dev.db
SESSION_SECRET=generate_a_random_32char_string_here
OAUTH2_REDIRECT_URI=http://localhost:3001/auth/callback
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

> **Tip:** Generate a SESSION_SECRET with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

---

## 3 — Install Dependencies

```bash
npm install
```

---

## 4 — Set Up Database

```bash
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run migrations (creates dev.db)
```

---

## 5 — Deploy Slash Commands

```bash
npm run deploy
```

> Global commands take up to 1 hour to propagate. For instant testing, use guild-specific deployment.

---

## 6 — Start the Bot

```bash
npm run dev          # Development (hot reload)
npm start            # Production (after npm run build)
```

---

## 7 — Start the Dashboard

**Backend API:**
```bash
npm run dashboard:dev   # Development
```

**Frontend:**
```bash
cd dashboard/frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## 8 — Invite the Bot

Generate an invite URL with the required permissions:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your application's Client ID.

> `permissions=8` grants Administrator. For minimal permissions, compute the specific bits from the [permissions calculator](https://discordapi.com/permissions.html).

---

## Commands Reference

### 👑 Owner Commands (Bot Owners only)
| Command | Description |
|---|---|
| `/owner add @user` | Add a Bot Owner |
| `/owner remove @user` | Remove a Bot Owner |
| `/owner list` | List all Bot Owners |

### 🛡️ Security Commands (Manage Guild)
| Command | Description |
|---|---|
| `/antiraid enable` | Enable Anti-Raid |
| `/antiraid disable` | Disable Anti-Raid |
| `/antiraid level [LOW\|MEDIUM\|HIGH\|EXTREME]` | Set response level |
| `/antiraid config` | View configuration |
| `/antiraid thresholds` | Configure thresholds |
| `/antinuke enable` | Enable Anti-Nuke |
| `/antinuke disable` | Disable Anti-Nuke |
| `/antinuke config` | View configuration |
| `/whitelist add @user` | Whitelist a user |
| `/whitelist remove @user` | Remove from whitelist |
| `/whitelist list` | List whitelist |
| `/lockdown start` | Activate lockdown |
| `/lockdown end` | Deactivate lockdown |

### 🔨 Moderation Commands (Manage Members / Moderate Members)
| Command | Description |
|---|---|
| `/ban @user [reason]` | Ban a member |
| `/unban <user_id> [reason]` | Unban a user |
| `/kick @user [reason]` | Kick a member |
| `/timeout @user <duration> [reason]` | Timeout a member (e.g. `10m`, `2h`, `1d`) |
| `/untimeout @user` | Remove timeout |
| `/warn @user <reason>` | Issue a warning |
| `/warnings @user` | View warnings |
| `/clear <amount>` | Delete messages (1-100) |
| `/lock [channel]` | Lock a channel |
| `/unlock [channel]` | Unlock a channel |

### ⚙️ Configuration Commands (Manage Guild)
| Command | Description |
|---|---|
| `/logs channel #channel` | Set log channel |
| `/logs disable` | Disable logging |

---

## Troubleshooting

### Missing Permissions
- Ensure the bot role is **above** the roles of members you want to moderate.
- The bot needs `Administrator` or specific permissions listed in the requirements.
- Check the bot's role position in **Server Settings → Roles**.

### Missing Intents
- Go to the [Developer Portal](https://discord.com/developers/applications).
- Open your application → **Bot** tab.
- Enable **Server Members Intent** and **Message Content Intent** under Privileged Gateway Intents.

### Invalid OAuth2 Redirect
- The `OAUTH2_REDIRECT_URI` in `.env` must **exactly match** a URI registered in the Developer Portal.
- Go to **OAuth2 → General → Redirects** and add your URI.

### Bot Offline
- Verify `DISCORD_TOKEN` in `.env` is correct.
- Check `logs/error.log` for startup errors.
- Ensure Node.js v20+ is installed: `node --version`

### Slash Commands Not Appearing
- Run `npm run deploy` again.
- Global commands take up to 1 hour to propagate.
- Try removing and re-inviting the bot.

### Database Errors
- Run `npm run db:migrate` to apply all migrations.
- Run `npm run db:generate` to regenerate the Prisma client.
- For production: ensure `DATABASE_URL` points to PostgreSQL.

### Dashboard Login Fails
- Verify `CLIENT_SECRET` and `OAUTH2_REDIRECT_URI` are correct in `.env`.
- Ensure the redirect URI is registered in the Developer Portal.
- Check `SESSION_SECRET` is at least 32 characters.

---

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Change `DATABASE_URL` to a PostgreSQL connection string
3. Set `OAUTH2_REDIRECT_URI` to your production domain
4. Run: `npm run build && npm run db:migrate:prod && npm start`

Or use Docker:
```bash
docker-compose up -d
```

---

## Architecture

```
src/
├── bot/          Discord.js client, command/event loaders, deploy script
├── commands/     Slash commands (owner, moderation, security, configuration)
├── events/       Discord.js event handlers
├── services/     Business logic (antiRaid, antiNuke, moderation, logging, whitelist, security)
├── database/     Prisma client + repositories
├── middleware/   requireBotOwner, requireGuildPermission
├── config/       Environment validation
├── types/        TypeScript type definitions
└── utils/        Logger, embeds, permissions, time utilities

dashboard/
├── backend/      Express API (OAuth2, guild config, security events, bot status)
└── frontend/     React + Vite + Tailwind dashboard

prisma/
└── schema.prisma Database schema (SQLite dev, PostgreSQL prod)

tests/
└── ...           Vitest unit tests
```

---

## Security Notes

- Bot tokens are **never** exposed in source code or logs.
- OAuth2 token exchange happens **server-side only** — tokens never reach the browser.
- Session cookies are **HttpOnly**, **Secure** (in production), **SameSite: lax**.
- All API inputs are validated with **Zod**.
- Rate limiting is applied to all API routes.
- Guild permission checks are **re-validated server-side** on every API call.

---

## License

MIT — Free to use and modify.

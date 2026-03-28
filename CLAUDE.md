# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TFT (Teamfight Tactics) tournament management platform with three components:
- **frontend/** — Next.js web app (leaderboard with 30s auto-refresh, player profile modals, LP graph)
- **backend/** — Express.js REST API (business logic, cron job, Riot API integration)
- **tipti-clanker/** — Discord bot (Discordx + TypeScript) for player registration and admin commands

## Commands

### Frontend (`frontend/`)
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
```

### Backend (`backend/`)
```bash
npm run dev      # Run with tsx (development)
npm run build    # Compile TypeScript to dist/
npm run start    # Run compiled output
npm run test     # Run Vitest tests
```

Run a single test:
```bash
npx vitest run src/__tests__/cronJob.test.ts
```

### Discord Bot (`tipti-clanker/`)
```bash
npm run dev      # Run bot with tsx
npm run watch    # Auto-reload with nodemon
npm run build    # Compile TypeScript
npm run test     # Run Vitest tests
```

### Docker (tipti-clanker only)
```bash
docker-compose up --build
```

## Architecture

### Data Flow
```
Discord Bot ──HTTP──► Backend API ──► MongoDB (shared DB)
                           │                 ▲
                           └── Riot API      │
                           (15-min cron)     │
Frontend ──/api proxy──► Backend API
```

- Bot calls backend REST API for all data ops (does NOT hit MongoDB directly)
- Backend owns all business logic, Riot API calls, and the 15-minute cron job
- Frontend uses SWR for 30-second client-side polling via Next.js API route proxies
- Shared MongoDB database: `tft-tournament`

### Discord Bot (tipti-clanker)
- Uses **discordx** (decorator-based command registration on top of discord.js 14)
- **Singleton clients**: `src/lib/riot/` and `src/lib/mongodb/` — initialized once in `main.ts`, reused across commands
- `RiotClient` wraps Riot API with methods: `getPuuidByRiotId()`, `getAccountByPuuid()`, `getTftLeagueByPuuid()`
- Region mapping handled in `RiotClient` (Asia, SEA, PH, NA, etc.)
- Commands: `/link`, `/profile`, `/leaderboard`, `/add-player`, `/remove-player`, `/tournament-settings`, `/get-user-by-account`, `/raw-message`
- Riot API response types defined in `src/types/RiotAPI/`

### Frontend
- Next.js App Router (`app/` directory)
- Path alias `@/*` maps to project root
- Tailwind CSS 4 via PostCSS
- Components: `Leaderboard` (client, SWR polling), `Navbar`, `UserBanner` (Discord avatar + inline rank image), `ProfileModal`, `LPGraph` (Recharts), `RankImage`
- API route proxies: `/api/leaderboard` (strips puuid), `/api/players/[discordId]`
- Hooks: `useLeaderboard` (30s refresh), `usePlayer`

### Backend
- Express.js 5 on port 5000
- CORS enabled, JSON middleware
- Mongoose models: `Player` (with `discordAvatarUrl`, `discordUsername`), `LpSnapshot`, `MatchRecord`, `TournamentSettings`
- Cron job (`*/15 * * * *`): captures LP snapshots + match records for active players, enforces tournament start/end dates
- Match capture uses Riot API `startTime` param (last captured match timestamp) to prevent gaps during outages; only stores matches within the tournament date window
- Snapshot deduplication: skips creating a new `LpSnapshot` when rank data is unchanged from the previous snapshot
- Player reactivation (soft-deleted → re-added) re-fetches rank from Riot and creates a fresh baseline snapshot
- Tournament dates configurable via API (`GET/PUT/PATCH /api/tournament/settings`) and Discord `/tournament-settings` command
- Leaderboard LP gain is **daily** (UTC+8 calendar day), not cumulative tournament gain; tiebreaker sort uses total tournament LP gain
- `normalizeLP()` utility in `src/lib/normalizeLP.ts` — shared by leaderboard and player controller
- `getDayBoundsUTC8()` / `getTodayUTC8()` in `src/lib/dateUtils.ts` — shared UTC+8 date helpers used by leaderboard and notifications
- Rate-limit queue (`src/lib/riotQueue.ts`) handles Riot API 429s with configurable request timeout (`RIOT_REQUEST_TIMEOUT_MS`)

### Logging
- **Backend + Bot**: `pino` with `pino-pretty` (dev). Logger in `src/lib/logger.ts`. Debug logs in development, warn/error only in production.
- **Frontend**: Simple console wrapper in `src/lib/logger.ts`. Same level behavior.
- Bot also uses `debug` package for Riot/MongoDB client trace logging (`DEBUG=riot:client`)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/leaderboard` | Leaderboard sorted by tier/division/LP |
| GET | `/api/players` | List all active players |
| POST | `/api/players` | Register player |
| GET | `/api/players/:discordId` | Player + snapshots (with normalizedLP) + matches |
| PATCH | `/api/players/:discordId` | Update player profile (avatar URL, username) |
| DELETE | `/api/players/:discordId` | Soft-delete player |
| GET | `/api/snapshots/:puuid` | LP history snapshots |
| GET | `/api/tournament/settings` | Current tournament settings |
| PUT | `/api/tournament/settings` | Update tournament dates/name |
| POST | `/api/cron/run` | Manually trigger cron cycle |

## Environment Variables

All three projects use `NODE_ENV` (`development` or `production`) to control log levels.

**backend** (`.env`):
- `NODE_ENV` — `development` or `production`
- `PORT` — Server port (default: 5000)
- `MONGODB_URI` — MongoDB connection string
- `MONGODB_DB_NAME` — Database name (default: `tft-tournament`)
- `RIOT_API_KEY` — Riot Games API key
- `TOURNAMENT_START_DATE` — Fallback tournament start (ISO 8601)
- `TOURNAMENT_END_DATE` — Fallback tournament end (ISO 8601)

**frontend** (`.env`):
- `NODE_ENV` — `development` or `production`
- `NEXT_PUBLIC_BACKEND_URL` — Backend base URL (default: `http://localhost:5000`)

**tipti-clanker** (`.env`):
- `NODE_ENV` — `development` or `production`
- `BOT_TOKEN` — Discord bot token
- `RIOT_API_KEY` — Riot Games API key
- `MONGODB_URI` — MongoDB connection string
- `MONGODB_DB_NAME` — Database name
- `BACKEND_URL` — Backend API URL (default: `http://localhost:5000`)

## Key Dependencies

- **Backend**: express, mongoose, node-cron, pino, pino-pretty (dev), vitest (dev)
- **Frontend**: next, react, swr, recharts, tailwindcss
- **Bot**: discord.js, discordx, mongodb, pino, pino-pretty (dev), vitest (dev)

## TypeScript Configuration Notes
- `tipti-clanker` requires `experimentalDecorators` (discordx uses decorators) — already in `tsconfig.json`
- Frontend uses `tsconfig.json` path aliases (`@/*`)
- Backend uses `@/*` → `src/*` path alias
- All three components target ESNext/modern Node

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TFT (Teamfight Tactics) tournament management platform with a **God System** — a faction-based competitive event themed around Set 17: Space Gods. Three components:
- **frontend/** — Next.js web app (leaderboard with tabs for Players/Gods, player profile modals with point breakdowns, LP graph, match links)
- **backend/** — Express.js REST API (business logic, cron jobs, Riot API integration, god/buff/scoring systems)
- **tipti-clanker/** — Discord bot (Discordx + TypeScript) for player registration, god commands, and admin tools

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
                           (daily cron)      │
Frontend ──/api proxy──► Backend API
```

- Bot calls backend REST API for all data ops (does NOT hit MongoDB directly)
- Backend owns all business logic, Riot API calls, cron jobs, and god/buff/scoring systems
- Frontend uses SWR for 30-second client-side polling via Next.js API route proxies
- Shared MongoDB database: `tft-tournament`

### God System
- **9 Gods**: Varus (Love), Ekko (Time), Evelynn (Temptation), Thresh (Pacts), Yasuo (Abyss), Soraka (Stars), Kayle (Order), Ahri (Opulence), Aurelion Sol (Wonders)
- Players choose a god at registration (two-step flow: enter Riot ID, then select god from dropdown)
- Each god has unique per-match buff mechanics (computed in real-time during 15-min cron, per-player daily cap)
- **Elimination phases**: Phase 1 (Day 1-5, bottom 3 eliminated), Phase 2 (Day 6-10, bottom 3), Phase 3 (Day 11-14, finals)
- Buffs activate Day 6+ (after Phase 1 elimination)
- God score = average of top N players' scores, where N = clamp(floor(playerCount/3), 2, 5)
- **10 leaderboards**: 1 global (by scorePoints) + 9 god leaderboards
- Final scoring: TotalPoints + GodPlacementBonus (1st: +100, 2nd: +75, 3rd: +50)

### Scoring System
- LP → Points (1:1 mapping for daily LP gain as "match" points)
- `scorePoints = matchPoints + buffs - penalties + godPlacementBonus`
- All point changes stored as `PointTransaction` records (event sourcing)
- `DailyPlayerScore` caches each player's daily LP gain, match count, and placements for stats
- `MatchRecord` has `buffProcessed` flag to track which matches have had buffs computed

### Discord Bot (tipti-clanker)
- Uses **discordx** (decorator-based command registration on top of discord.js 14)
- **Singleton clients**: `src/lib/riot/` and `src/lib/mongodb/` — initialized once in `main.ts`, reused across commands
- `RiotClient` wraps Riot API with methods: `getPuuidByRiotId()`, `getAccountByPuuid()`, `getTftLeagueByPuuid()`
- Region mapping handled in `RiotClient` (Asia, SEA, PH, NA, etc.)
- Commands: `/register` (two-step with god selection), `/profile`, `/leaderboard`, `/add-player`, `/remove-player`, `/tournament-settings`, `/get-user-by-account`, `/raw-message`, `/god-standings`, `/god-leaderboard`, `/assign-god`, `/eliminate-god`, `/seed-gods` (guild-locked), `/wipe-data` (guild-locked)
- Riot API response types defined in `src/types/RiotAPI/`
- God definitions and constants in `src/lib/constants.ts`

### Frontend
- Next.js App Router (`app/` directory)
- Path alias `@/*` maps to project root
- Tailwind CSS 4 via PostCSS
- Components: `Leaderboard` (client, SWR polling, Players/Gods tabs), `Navbar`, `UserBanner` (Discord avatar + rank + god badge), `ProfileModal` (stats + point breakdown + match links), `LPGraph` (Recharts), `RankImage`, `GodBadge`, `GodStandings`, `PointBreakdown`
- API route proxies: `/api/leaderboard` (strips puuid), `/api/players/[discordId]`, `/api/gods/standings`
- Hooks: `useLeaderboard` (30s refresh), `usePlayer`, `useGods` (30s refresh)
- Match links: tactics.tools and metatft URLs generated from gameName/tagLine/matchId

### Backend
- Express.js 5 on port 5000
- CORS enabled, JSON middleware
- Mongoose models: `Player` (with `godSlug`, `isEliminatedFromGod`), `LpSnapshot`, `MatchRecord`, `TournamentSettings` (with `phases`, `currentPhase`, `buffsEnabled`), `God`, `PointTransaction`, `DailyPlayerScore`
- **15-min cron** (`*/15 * * * *`): captures LP snapshots + match records for active players, then runs real-time per-match buff processing
- **Daily cron** (`0 16 * * *` = midnight UTC+8): computes daily LP gains → creates match PointTransactions → checks phase/tournament end
- Services: `playerService`, `snapshotService`, `matchService`, `leaderboardService`, `tournamentService`, `notificationService`, `godService`, `scoringEngine`, `matchBuffProcessor`, `phaseService`
- `godService`: seed gods, assign players, eliminate gods, get standings
- `scoringEngine`: compute player/god scores, breakdowns, daily point gains
- `matchBuffProcessor`: real-time per-match buff processing for all 9 gods, per-player daily cap enforcement
- `phaseService`: end-of-phase (elimination), end-of-tournament (god placement bonuses)
- Match capture uses Riot API `startTime` param to prevent gaps during outages
- Snapshot deduplication: skips unchanged snapshots
- Leaderboard sorted by **scorePoints** (sum of PointTransactions), with normalizedLP as tiebreaker
- `normalizeLP()` utility in `src/lib/normalizeLP.ts`
- `getDayBoundsUTC8()` / `getTodayUTC8()` in `src/lib/dateUtils.ts` — UTC+8 date helpers
- Rate-limit queue (`src/lib/riotQueue.ts`) handles Riot API 429s
- God and buff constants in `src/constants.ts`

### Logging
- **Backend + Bot**: `pino` with `pino-pretty` (dev). Logger in `src/lib/logger.ts`. Debug logs in development, warn/error only in production.
- **Frontend**: Simple console wrapper in `src/lib/logger.ts`. Same level behavior.
- Bot also uses `debug` package for Riot/MongoDB client trace logging (`DEBUG=riot:client`)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/leaderboard` | Leaderboard sorted by scorePoints |
| GET | `/api/players` | List all active players |
| POST | `/api/players` | Register player (requires godSlug) |
| GET | `/api/players/:discordId` | Player + snapshots + matches + god info + point breakdown |
| PATCH | `/api/players/:discordId` | Update player profile (avatar URL, username) |
| DELETE | `/api/players/:discordId` | Soft-delete player |
| GET | `/api/snapshots/:puuid` | LP history snapshots |
| GET | `/api/tournament/settings` | Current tournament settings (includes phases) |
| PUT | `/api/tournament/settings` | Update tournament settings |
| GET | `/api/riot/account/:gameName/:tagLine` | Look up Riot account |
| POST | `/api/cron/run` | Manually trigger 15-min cron cycle |
| POST | `/api/cron/run-daily` | Manually trigger daily processing (optional `day` in body) |
| GET | `/api/gods` | List all gods with scores and player counts |
| GET | `/api/gods/standings` | God leaderboard sorted by score |
| GET | `/api/gods/:slug` | Single god details + players |
| POST | `/api/gods/seed` | Admin: seed all 9 gods |
| POST | `/api/gods/:slug/assign` | Assign player to god (`{ discordId }`) |
| POST | `/api/gods/:slug/eliminate` | Eliminate a god (`{ phase }`) |
| POST | `/api/admin/wipe-data` | Admin: wipe all players, matches, snapshots, points |
| GET | `/api/points/:discordId` | Player point breakdown by type |
| GET | `/api/points/:discordId/daily` | Day-by-day point transactions |
| GET | `/api/notifications/feed` | Unnotified 1st/8th placements |
| POST | `/api/notifications/feed/ack` | Mark notifications as sent |
| GET | `/api/notifications/daily-summary` | Daily climber/slider |
| GET | `/api/notifications/daily-graph` | Top 5 LP timeseries |

## Buff System Summary

Buffs are calculated **per match in real-time** during the 15-min cron cycle. Each match generates buff points immediately based on placement and god mechanics. Daily cap is **per player** (default 75, with god-specific overrides). Penalties are uncapped.

| God | Buff Mechanic | Daily Cap |
|-----|---------------|-----------|
| Varus (Love) | +7/match. Top 10 in god leaderboard: +8/match | 75 |
| Ekko (Time) | +2/match. +20 if same placement as previous match | 75 |
| Evelynn (Temptation) | +1/match, or +25/match if LP gain exceeds rank threshold (Unranked-Plat: 350, Emerald: 250, Diamond: 200, Master+: 150) | 75 |
| Thresh (Pacts) | +2/match. +13 if matching Top 1's latest placement. Top 1: +13/match | 75 |
| Yasuo (Abyss) | Top 5-7 → +10/match. Top 8 → +35/match | 140 |
| Soraka (Stars) | +5/-2 per streak match (cap 15 streak length) | 100 |
| Kayle (Order) | +2/match. +10 bonus if ≥5 matches played that day | 75 |
| Ahri (Opulence) | +13 per 1st place match | 75 |
| Aurelion Sol (Wonders) | Random per match based on placement (1st: 0-12, 8th: -6 to 6) | 90 |

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

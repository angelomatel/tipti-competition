# CLAUDE.md

This file gives coding agents the current repo-specific context for `tipti-competition`.

## Project Overview

TFT tournament platform for the Set 17 "God System" event.

Main packages:

- `frontend/`: Next.js 16 + React 19 web UI
- `backend/`: Express 5 + TypeScript API, scoring engine, cron jobs, Riot integration
- `tipti-clanker/`: discordx bot for registration, admin commands, and scheduled Discord posts

The backend is the source of truth. The frontend and bot both talk to it over HTTP.

## Commands

Shared conventions live in `CONTRIBUTING.md`.

### Root

```bash
npm run lint
npm run lint:all
npm run lint:frontend
npm run lint:backend
npm run lint:bot
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run start
npm run lint
```

### Backend

```bash
cd backend
npm run dev
npm run build
npm run start
npm run test
npm run lint
```

Single-test example:

```bash
npx vitest run src/__tests__/cronJob.test.ts
```

### Discord Bot

```bash
cd tipti-clanker
npm run dev
npm run watch
npm run build
npm run start
npm run lint
```

### PM2 Dev Helper

```powershell
.\scripts\pm2-dev.ps1 start all
.\scripts\pm2-dev.ps1 restart backend
.\scripts\pm2-dev.ps1 logs frontend
.\scripts\pm2-dev.ps1 stop all
```

Targets: `frontend`, `backend`, `bot`, `all`.

## High-Level Architecture

```text
Discord bot --> Backend API --> MongoDB
                    |
                    +--> Riot API

Frontend --> Next.js API routes --> Backend API
```

Key ownership:

- Bot handles Discord interactions and scheduled Discord posts
- Backend owns scoring, tournament state, Riot access, and persistence
- Frontend renders read-only public views from backend data

## Current Runtime Behavior

### Backend jobs

- Data fetch job: every 5 minutes
- Daily processing job: `0 0 * * *` in `Asia/Manila`
- Database backup job: every 12 hours in production only

### Bot jobs

- Feed job: every 5 minutes
- Daily recap job: `00:05` Asia/Manila
- God standings job: `00:10` Asia/Manila

### Frontend

- SWR polling interval: 30 seconds
- Uses Next.js App Router and backend proxy routes under `app/api/`

## Backend Notes

### Routes

Read routes:

- `GET /api/health`
- `GET /api/leaderboard`
- `GET /api/players`
- `GET /api/players/:discordId`
- `GET /api/snapshots/:puuid`
- `GET /api/tournament/settings`
- `GET /api/riot/account/:gameName/:tagLine`
- `GET /api/gods`
- `GET /api/gods/standings`
- `GET /api/gods/:slug`
- `GET /api/points/:discordId`
- `GET /api/points/:discordId/daily`
- `GET /api/notifications/feed`
- `GET /api/notifications/daily-summary`
- `GET /api/notifications/daily-graph`

Protected write routes require `x-admin-password`:

- `POST /api/players`
- `PATCH /api/players/:discordId`
- `DELETE /api/players/:discordId`
- `PUT /api/tournament/settings`
- `POST /api/cron/run`
- `POST /api/cron/run-daily`
- `POST /api/gods/seed`
- `POST /api/gods/:slug/assign`
- `POST /api/admin/wipe-data`
- `POST /api/admin/reset-player-ranks`
- `POST /api/notifications/feed/ack`

### Important backend modules

- `playerService`: player lifecycle and profile updates
- `matchService`: match capture and reconciliation
- `snapshotService`: LP snapshot persistence
- `leaderboardService`: global standings and player ranking views
- `tournamentService`: tournament settings and state
- `godService`: god seeding, assignment, standings
- `scoringEngine`: score calculations and breakdowns
- `matchBuffProcessor`: per-match god buff handling
- `dailyProcessingService`: daily LP gain conversion into point transactions
- `phaseService`: phase progression and elimination logic

### Data model highlights

- `Player`: includes `godSlug`, elimination flags, Riot identity, Discord metadata
- `MatchRecord`: tracked match history with buff processing metadata
- `PointTransaction`: event-sourced score ledger
- `DailyPlayerScore`: cached daily LP gain and aggregate stats
- `TournamentSettings`: stores dates, channels, phases, current phase, `buffsEnabled`
- `God`: god standings and elimination state

### Scoring model

- Daily LP gain becomes match points during daily processing
- Buffs are processed per match during the 5-minute cron cycle
- `scorePoints = match points + buffs - penalties + god placement bonus`
- God score averages the top `clamp(floor(playerCount / 3), 2, 5)` eligible players

Current god caps:

- Default cap: 75
- Yasuo: 120
- Soraka: 100
- Aurelion Sol: 90

## Frontend Notes

Current major views/components:

- `app/leaderboard/page.tsx`: main global leaderboard page
- `app/leaderboard/gods/page.tsx`: god standings page
- `app/leaderboard/gods/[slug]/*`: per-god leaderboard page
- `src/components/Leaderboard/*`: podium, leaderboard rows, player modal, LP graph, point breakdown
- `src/components/Gods/*`: god standings and god leaderboard UI

Hooks:

- `useLeaderboard`
- `useGods`
- `useGod`
- `usePlayer`
- `useTournament`

Backend proxy routes live in `frontend/app/api/...`.

## Discord Bot Notes

Slash commands currently present:

- `/register`
- `/leaderboard`
- `/profile`
- `/god-standings`
- `/god-leaderboard`
- `/get-user-by-account`

Admin slash group:

- `/admin add-player`
- `/admin remove-player`
- `/admin assign-god`
- `/admin refresh-data`
- `/admin settings`
- `/admin trigger-daily-jobs`
- `/admin reset-player-ranks`
- `/admin raw-message`
- `/admin edit-raw-message`
- `/admin wipe-data`

Bot specifics:

- Uses `discordx` decorators
- Starts notification jobs from `src/jobs/notificationJobs.ts` on ready
- Uses backend HTTP calls rather than direct MongoDB writes for tournament operations
- Uses `BACKEND_ADMIN_PASSWORD` for protected backend mutations

## Environment Variables

### Root

No shared root `.env`.

### Backend

Documented and currently used:

- `NODE_ENV`
- `PORT`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `RIOT_API_KEY`
- `ADMIN_API_PASSWORD`
- `ENABLE_DEV_DATA_FETCH_CRONS`

Notes:

- `TOURNAMENT_START_DATE` and `TOURNAMENT_END_DATE` are not env-driven today; defaults are hard-coded in `backend/src/constants.ts`
- Scheduled data fetches are skipped outside production unless `ENABLE_DEV_DATA_FETCH_CRONS=true`

### Frontend

- `NODE_ENV`
- `NEXT_PUBLIC_BACKEND_URL`

### Discord Bot

- `NODE_ENV`
- `BOT_TOKEN`
- `BACKEND_URL`
- `BACKEND_ADMIN_PASSWORD`
- `LOG_LEVEL`
- `LOG_FILE_PATH`
- `NO_COLOR`

## Logging

- Backend: `pino`; pretty console logging in development, structured file logging in production
- Frontend: lightweight console wrapper
- Bot: `pino`; same general production/dev split as backend

## Working Notes For Agents

- Prefer updating backend-facing docs when routes, cron timing, or admin auth changes
- Do not describe old 15-minute polling behavior; the current fetch cadence is 5 minutes
- Do not document `/tournament-settings` as a Discord slash command; the bot uses `/admin settings`
- Do not claim the bot writes directly to MongoDB for tournament data flow; the current integration path is backend HTTP

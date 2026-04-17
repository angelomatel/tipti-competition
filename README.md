# Tipti Competition

Full-stack TFT tournament platform for the Set 17 "God System" event. Players register through Discord, the backend tracks ranked activity through the Riot API, and the frontend publishes live player and god standings.

## What It Does

- Runs a faction-based tournament with 9 gods, per-match buffs, eliminations, and final god placement bonuses
- Tracks ranked progress and match history for registered players every 5 minutes
- Computes daily match points at midnight PHT and updates score-based leaderboards
- Publishes player standings, god standings, profile modals, point breakdowns, and LP graphs on the web frontend
- Posts Discord feed notifications, daily recaps, and god standings updates through the bot

## Architecture

```text
Discord Bot --> Backend API --> MongoDB
                    |
                    +--> Riot API

Browser --> Next.js frontend --> Backend API
```

The backend is the system of record. The frontend and Discord bot both use the backend over HTTP.

## Repo Layout

| Path | Stack | Responsibility |
|------|-------|----------------|
| `backend/` | Express 5 + TypeScript + Mongoose | API, scoring, cron jobs, Riot integration, tournament state |
| `frontend/` | Next.js 16 + React 19 + SWR | Public leaderboard UI and player/god views |
| `tipti-clanker/` | discordx + discord.js | Registration flow, admin commands, scheduled Discord posts |

Shared repo-level lint commands live in [CONTRIBUTING.md](CONTRIBUTING.md).

## Getting Started

Each package has its own `.env`. Current examples are in:

- `backend/.env.example`
- `tipti-clanker/.env.example`
- `frontend/.env`

### Backend

```bash
cd backend
npm install
npm run dev
```

Defaults to `http://localhost:5000`.

Scheduled Riot fetch jobs are disabled outside production unless `ENABLE_DEV_DATA_FETCH_CRONS=true` is set.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Defaults to `http://localhost:3000`.

### Discord Bot

```bash
cd tipti-clanker
npm install
npm run dev
```

## Common Commands

```bash
npm run lint:all
```

Per-package commands:

- `frontend`: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`
- `backend`: `npm run dev`, `npm run build`, `npm run start`, `npm run test`, `npm run lint`
- `tipti-clanker`: `npm run dev`, `npm run watch`, `npm run build`, `npm run start`, `npm run lint`

## PM2 Dev Workflow

On Windows, the repo helper starts all three services under PM2 watch mode:

```powershell
.\scripts\pm2-dev.ps1 start all
.\scripts\pm2-dev.ps1 restart backend
.\scripts\pm2-dev.ps1 logs frontend
.\scripts\pm2-dev.ps1 stop all
```

Targets: `frontend`, `backend`, `bot`, `all`.

## Runtime Behavior

- Backend data fetch cron: every 5 minutes
- Backend daily processing cron: `00:00` Asia/Manila
- Bot feed notifications: every 5 minutes
- Bot daily recap: `00:05` Asia/Manila
- Bot god standings post: `00:10` Asia/Manila
- Frontend SWR refresh: 30 seconds
- Backend production backup job: every 12 hours, retaining 14 compressed backups in `backend/backups/`

## API Surface

Main read endpoints:

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

Protected mutation endpoints require the `x-admin-password` header:

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

## Tournament Model

- 9 gods: Varus, Ekko, Evelynn, Thresh, Yasuo, Soraka, Kayle, Ahri, Aurelion Sol
- Score points are built from daily match points, god buffs, penalties, and god placement bonuses
- God scores are based on the average of the top `clamp(floor(playerCount / 3), 2, 5)` eligible players
- Tournament phases eliminate gods across a 14-day event
- Buffs are enabled after Phase 1

For deeper implementation notes, command references, and environment details, see [CLAUDE.md](CLAUDE.md) and [overview.md](overview.md).

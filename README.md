# Tipti Bootcamp — TFT Tournament Manager

A full-stack platform for running Teamfight Tactics (TFT) tournaments. Players register via Discord, and the platform automatically tracks their ranked LP, records match history, and displays live standings on a web leaderboard.

## What it does

- Players link their Riot account to their Discord account via a bot command
- Every 15 minutes, the backend polls the Riot API to capture LP snapshots and match records for all registered players
- A web leaderboard shows current standings, auto-refreshing every 30 seconds
- Admins can configure tournament start/end dates; only snapshots taken during the window count
- Each player has a profile page with their LP progression graph and recent match history

## Architecture

```
Discord Bot ──HTTP──► Backend API ──► MongoDB
                           │
                           └──► Riot API (every 15 min)

Browser ──► Frontend (Next.js) ──/api proxy──► Backend API
```

Three components share a single MongoDB database (`tft-tournament`):

| Component | Tech | Role |
|-----------|------|------|
| `backend/` | Express.js + TypeScript | REST API, cron job, Riot API integration |
| `frontend/` | Next.js + Tailwind + Recharts | Leaderboard UI, player profiles, LP graph |
| `tipti-clanker/` | Discord.js + discordx | Player registration, admin commands |

The backend is the single source of truth — the Discord bot and frontend both talk to it via HTTP. Neither touches MongoDB directly.

## Getting Started

Each component has its own `.env` file. See `CLAUDE.md` for the full list of environment variables.

For repo-wide coding standards and lint commands, see [CONTRIBUTING.md](CONTRIBUTING.md).

### Backend
```bash
cd backend
npm install
npm run dev       # http://localhost:5000
```

By default, the scheduled 15-minute and daily data-fetch jobs only auto-run in production. To allow them in local development, set `ENABLE_DEV_DATA_FETCH_CRONS=true` in `backend/.env`.

### Frontend
```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
```

### Discord Bot
```bash
cd tipti-clanker
npm install
npm run dev
```

### Linting
```bash
npm run lint:all
```

You can also run `npm run lint` inside `frontend/`, `backend/`, or `tipti-clanker/`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/leaderboard` | Standings sorted by tier/division/LP |
| GET/POST | `/api/players` | List or register players |
| GET/DELETE | `/api/players/:discordId` | Player profile or removal |
| GET | `/api/snapshots/:puuid` | LP history for a player |
| GET/PUT | `/api/tournament/settings` | Read or update tournament dates |
| POST | `/api/cron/run` | Manually trigger a cron cycle |

## PM2 Dev Workflow

For local development on Windows, use the repo helper instead of raw `pm2 start --watch` commands:

```powershell
.\scripts\pm2-dev.ps1 start all
.\scripts\pm2-dev.ps1 stop all
.\scripts\pm2-dev.ps1 restart backend
.\scripts\pm2-dev.ps1 logs frontend
.\scripts\pm2-dev.ps1 status all
```

Available targets are `frontend`, `backend`, `bot`, and `all`.

The helper uses `ecosystem.dev.config.js`, which runs each package's `npm run dev` under PM2 with:

- file watching enabled
- a 5-second debounce before restart (`watch_delay: 5000`)
- ignore rules for generated folders like `.next`, `dist`, `build`, `logs`, and `node_modules`
- `NODE_ENV=development` for each managed process

`stop` removes the PM2 process instead of only stopping it, so the watcher is actually off.

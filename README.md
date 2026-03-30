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

### Backend
```bash
cd backend
npm install
npm run dev       # http://localhost:5000
```

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

## Deploying frontend + backend together on Vercel

This repository is now configured for a single Vercel project at the repo root.

- Root config file: `vercel.json`
- Frontend (`frontend/`) is served as the main app
- Backend (`backend/`) is deployed as a Node function mounted at `/backend/*`

How requests flow in production:

- Browser/UI calls Next routes like `/api/leaderboard`
- Next route handlers proxy to `${BACKEND_URL}/api/*`
- On Vercel, default `BACKEND_URL` resolves to `https://<deployment>/backend`

Scheduled jobs are configured via Vercel Cron (not in-process timers), and call:

- `/backend/api/cron/run` every 15 minutes
- `/backend/api/cron/run-daily` at `0 16 * * *` (midnight UTC+8)

### Required Vercel environment variables

Set these in your Vercel project:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `RIOT_API_KEY`
- tournament and app vars used by backend/frontend `.env` files (see `CLAUDE.md`)

Optional:

- `NEXT_PUBLIC_BACKEND_URL` (only if you want to override the default `/backend` mount)

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

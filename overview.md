# Tipti Set 17 Bootcamp Tournament - Platform Overview

This document is for tournament admins. It describes how the current platform behaves in production and what controls exist today.

## What The Platform Runs

The tournament is built around the Set 17 "God System":

- Players register through Discord and choose one of 9 gods
- The backend pulls ranked data and match history from Riot every 5 minutes
- The backend computes score points from daily LP gains, god buffs, penalties, and final god bonuses
- The website shows player standings, god standings, and player drill-downs
- The bot posts scheduled updates to Discord during the tournament window

Once the tournament is configured, day-to-day operation is mostly automated.

## Components

| Component | Role |
|-----------|------|
| Website | Public leaderboard, god views, player profile modal, point breakdowns, LP graph |
| Discord bot | Registration flow, admin commands, scheduled posts |
| Backend | Riot polling, scoring, tournament state, REST API, persistence |

All three components share the same MongoDB database through the backend.

## Operational Flow

```text
/register in Discord
  -> player selects a god
  -> backend stores player + god assignment

Every 5 minutes
  -> backend fetches updated ranked state and recent matches
  -> backend records snapshots and match records
  -> per-match god buffs are processed for eligible matches

At 00:00 Asia/Manila
  -> backend computes daily LP gains
  -> backend writes point transactions
  -> backend evaluates phase changes and tournament end state

At 00:05 Asia/Manila
  -> bot posts the daily recap

At 00:10 Asia/Manila
  -> bot posts god standings
```

The bot also checks the notification feed every 5 minutes and posts match updates while the tournament is active.

## God System

### Gods

| God | Title | Buff Summary | Daily Cap |
|-----|-------|--------------|-----------|
| Varus | Love | `+7` per match, or `+8` for top 10 within the god leaderboard | 75 |
| Ekko | Time | `+2` per match, plus `+20` when placement repeats the previous match | 75 |
| Evelynn | Temptation | `+1` per match, or `+25` when daily LP gain beats the rank threshold | 75 |
| Thresh | Pacts | `+2` per match, or `+13` if matching the top player's latest placement | 75 |
| Yasuo | Abyss | 5th `+7`, 6th `+15`, 7th `+25`, 8th `+33` | 120 |
| Soraka | Stars | `+5` win streak match, `-2` loss streak match, capped at 15 streak length | 100 |
| Kayle | Order | `+2` per match, plus `+15` after 4 matches in a day | 75 |
| Ahri | Opulence | `+17` for each 1st place match | 75 |
| Aurelion Sol | Wonders | Random roll based on placement | 90 |

Buffs are processed per match during the 5-minute data fetch cycle. Penalties are not capped.

### Phases

The current tournament model supports three phases:

- Phase 1: 9 gods active, bottom 3 eliminated
- Phase 2: 6 gods active, bottom 3 eliminated
- Phase 3: 3 gods active, finals

Buffs are intended to activate after Phase 1 ends. Eliminated players remain visible in individual standings but stop contributing to god scoring.

### Scoring

- `scorePoints = match points + buffs - penalties + god placement bonus`
- God scores use the top `clamp(floor(playerCount / 3), 2, 5)` eligible players
- End-of-tournament bonuses are `+100`, `+75`, and `+50` for 1st, 2nd, and 3rd gods

## Player And Admin Flows

### Player registration

Players use `/register` with their Riot ID. The bot validates the account and then asks them to choose a god before creating the record.

### Admin commands

The bot currently exposes these main commands:

- Player-facing: `/register`, `/leaderboard`, `/profile`, `/god-standings`, `/god-leaderboard`, `/get-user-by-account`
- Admin group: `/admin add-player`, `/admin remove-player`, `/admin assign-god`, `/admin refresh-data`, `/admin settings`, `/admin trigger-daily-jobs`, `/admin reset-player-ranks`, `/admin raw-message`, `/admin edit-raw-message`, `/admin wipe-data`

### Tournament settings

The backend stores:

- Tournament name, start date, end date
- Feed channel
- Daily recap channel
- God standings channel
- Audit channel
- Bootcamp chat channel
- Phase configuration
- Current phase
- Whether buffs are enabled

`/admin settings` currently updates and displays start/end dates plus the feed, daily, audit, and bootcamp chat channels. The backend API can also store `godStandingsChannelId`.

## Website Behavior

The frontend uses Next.js App Router with 30-second SWR refreshes.

Current user-visible views include:

- Global leaderboard with podium, search, and pagination
- Dedicated god standings page
- Per-god leaderboard page
- Player profile modal with LP graph and point breakdown

The frontend reads data through Next.js API routes that proxy the backend.

## Backend Behavior

Important backend facts that affect operations:

- Data fetch cron runs every 5 minutes
- Daily processing runs at midnight in `Asia/Manila`
- Protected write routes require the `x-admin-password` header
- A production-only backup job runs every 12 hours and keeps the latest 14 backups
- Scheduled Riot fetch jobs are disabled in non-production unless `ENABLE_DEV_DATA_FETCH_CRONS=true`

## Troubleshooting

### Data stops moving

If standings or profiles stop updating:

- Check the backend process first
- Check whether the Riot API key is still valid
- Check whether the tournament window has already ended
- In local development, confirm `ENABLE_DEV_DATA_FETCH_CRONS=true` if you expect automatic scheduled fetches

### Scores look wrong

If score points seem too low or missing:

- Confirm daily processing ran at `00:00` Asia/Manila
- Confirm tournament phases are configured correctly
- Confirm buffs are enabled if you expect post-Phase-1 buff scoring
- Manually trigger backend jobs through `/admin refresh-data` or `/admin trigger-daily-jobs` when needed

### Discord scheduled posts are missing

Likely causes:

- Missing or incorrect channel IDs in tournament settings
- Bot process is down
- Bot lacks permission to post in the configured channels
- God standings channel is not configured in backend settings

### A removed player cannot register again

Player removal is a soft delete. Use `/admin add-player` to restore or recreate the player record.

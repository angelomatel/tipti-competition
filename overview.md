# Tipti Set 17 Bootcamp Tournament — Platform Overview
*TFT Set 17: Space Gods — God System Tournament*
This document is intended for tournament admins. It covers what the platform does, how everything fits together, and what to watch out for.

---

## What This Platform Does

The Tipti Set 17 Bootcamp Tournament platform is a faction-based competitive event system for TFT. Players choose one of 9 gods at registration, earn points through matches and god-specific buffs, and compete across 10 leaderboards. Gods are eliminated in phases, creating strategic depth and engagement beyond simple LP tracking.

Once set up, it runs almost entirely on its own — no manual data entry required.

---

## The Three Components

| Component | What It Is | What It Does |
|-----------|------------|--------------|
| **Website** | Public leaderboard | Shows player standings (by score points), god standings, point breakdowns, and match history with external links. Refreshes every 30 seconds. |
| **Discord Bot** | Admin & player interface | Players register with god selection. Admins manage the tournament, gods, and settings. |
| **Backend** | The engine | Connects everything — pulls data from Riot, computes scores and buffs, powers both the website and bot. |

---

## How Everything Connects

```
Players register via Discord (/register)
         │
         ▼
   Choose a God → Backend stores player + god assignment
         │
         ▼
Every 15 minutes: Backend pulls rank data from Riot API
         │
         ▼
Database updated with latest LP, rank, and match history
         │
         ├──► Per-match buff points computed in real-time (if buffs enabled, Day 6+)
         │
         ├──► Website + Discord /leaderboard show updated standings (by score points)
         │
         ├──► Every 5 min: Bot checks for new 1st/8th placements → posts to Feed Channel
         │
         ├──► Midnight (PHT): Daily processing runs:
         │      1. Compute daily LP gains → create match point transactions
         │      2. Check for phase end → eliminate bottom 3 gods
         │      3. Check for tournament end → apply god placement bonuses
         │
         ├──► 5 min after midnight: Bot posts daily recap + god standings
         │
         └──► God standings update posted to God Standings Channel
```

---

## The God System

### The 9 Gods

| God | Title | Buff Mechanic | Daily Cap |
|-----|-------|---------------|-----------|
| Varus | Love | +3/match. Top 10 in god leaderboard: +10/match | 75 |
| Ekko | Time | +2/match. +10 if same placement as previous match | 75 |
| Evelynn | Temptation | +1/match, or +15/match if LP gain exceeds rank threshold (300/200/150/100) | 75 |
| Thresh | Pacts | +2/match. +13 if matching Top 1's latest placement. Top 1: +8/match | 75 |
| Yasuo | Abyss | Top 5-7 → +10/match. Top 8 → +35/match | 140 |
| Soraka | Stars | +5/-2 per streak match (cap 15 streak) | 100 |
| Kayle | Order | +3/match. +3 bonus if ≥3 matches played that day | 75 |
| Ahri | Opulence | +13 per 1st place match | 75 |
| Aurelion Sol | Wonders | Random per match based on placement (1st: 0-12, 8th: -6 to 6) | 90 |

Buffs are calculated **per match in real-time** during each 15-minute cron cycle. Daily cap is **per player** (penalties are uncapped).

### Elimination Phases (2-week tournament)

| Phase | Days | Gods | Eliminations |
|-------|------|------|-------------|
| Phase 1 | 1-5 | 9 gods | Bottom 3 eliminated |
| Phase 2 | 6-10 | 6 gods | Bottom 3 eliminated. **Buffs activate after Phase 1 ends.** |
| Phase 3 | 11-14 | 3 gods (finals) | No elimination |

Eliminated players stay in the individual leaderboard but are removed from god scoring and don't receive buffs.

### Scoring
- **Score Points** = match points + buff points - penalties + god placement bonus
- **God Score** = average of top N players' scores (N = clamp(floor(playerCount/3), 2, 5))
- **Final Bonuses**: 1st place god → +100, 2nd → +75, 3rd → +50 (applied to all players in that god)

---

## The Player Journey

### 1. Registration
A player uses `/register PlayerName#TAG` in Discord. The bot validates their Riot account, then shows an ephemeral dropdown to **choose their god**. After selecting, the player is registered with their chosen god faction.

Admins can also register players with `/add-player @user Name#TAG` (same two-step god selection flow).

### 2. Automatic Tracking (Every 15 Minutes)
The backend polls Riot's API for every registered player. It records LP snapshots (only when changed) and logs recent ranked matches within the tournament window.

### 3. Daily Processing (Midnight PHT)
At the end of each day:
1. Each player's daily LP gain is calculated from snapshots
2. Match point transactions are created
3. Phase/tournament end checks run automatically

God buffs are applied in real-time during each 15-minute cron cycle (if enabled, Day 6+).

### 4. Discord Notifications
- **Feed Channel (every 5 min):** Posts 1st and 8th place finishes
- **Daily Channel (midnight PHT):** Posts daily recap with climber/slider + LP graph
- **God Standings Channel (5 min after midnight):** Posts current god rankings

### 5. Leaderboards
**10 leaderboards total:**
1. **Global** — All players sorted by score points (with normalized LP as tiebreaker)
2-10. **God leaderboards** — One per god, showing that god's players sorted by score points

The website has "Players" and "Gods" tabs. The player modal shows score breakdown, point history, and match links to tactics.tools and metatft.

### 6. End of Tournament
Final processing runs automatically: god placement bonuses are applied (1st: +100, 2nd: +75, 3rd: +50). Final standings are frozen.

---

## Tournament Controls

### Setup (Before Tournament)
1. **Seed gods**: `POST /api/gods/seed` (or via admin script)
2. **Configure phases**: Use `/tournament-settings` or `PUT /api/tournament/settings` with phases array
3. **Set channels**: `/tournament-settings feed_channel:#channel daily_channel:#channel`
4. **Set dates**: `/tournament-settings start:2026-04-01T00:00:00+08:00 end:2026-04-14T23:59:59+08:00`

### During Tournament
- Gods are automatically eliminated at end of each phase
- Buffs activate automatically after Phase 1 ends
- Use `/god-standings` to check current rankings
- Use `/eliminate-god` for manual elimination if needed
- Use `/assign-god` to reassign a player's god (admin)

---

## Admin Commands (Quick Reference)

| Command | What It Does |
|---------|-------------|
| `/add-player @user Name#TAG` | Register a player (with god selection) |
| `/remove-player @user` | Remove a player from the tournament |
| `/tournament-settings` | View or update dates, channels, phases |
| `/leaderboard` | Show current standings in Discord |
| `/profile` or `/profile @user` | View player rank, god, and score points |
| `/refresh-data` | Manually trigger a data update cycle |
| `/god-standings` | Show current god rankings |
| `/god-leaderboard god:Name` | Show leaderboard for a specific god |
| `/assign-god @user god:Name` | Reassign a player to a different god |
| `/eliminate-god god:Name phase:N` | Manually eliminate a god |

---

## What Could Go Wrong

### Data Stops Updating
**Symptom:** The leaderboard hasn't changed in over 15 minutes.
**Likely causes:** Riot API key expired, backend down, or tournament end date passed.
**What to do:** Check backend status. If end date passed, update it and run `/refresh-data`.

### A Player's Score Looks Wrong
**Symptom:** Score points seem incorrect or missing.
**Likely cause:** Daily processing hasn't run yet, or tournament phases aren't configured.
**What to do:** Check tournament settings have phases configured. Manually trigger daily processing via `POST /api/cron/run-daily` if needed.

### God Buffs Not Applying
**Symptom:** No buff transactions appearing for players.
**Likely cause:** Buffs only activate Day 6+ (after Phase 1 ends). Check `buffsEnabled` in tournament settings.

### A Player Can't Re-Register After Being Removed
**Symptom:** Player tries to `/register` and gets an error.
**Cause:** Removal is a soft delete. An admin must use `/add-player` to re-register them.

### Feed/Daily Notifications Not Posting
**Likely causes:** Channels not configured, tournament inactive, bot lacks permissions, or bot is down.
**What to do:** Verify config with `/tournament-settings`. Check bot permissions.

---

## Normal vs. Abnormal Behavior

| Situation | Normal? |
|-----------|---------|
| Leaderboard refreshes every 30 sec on website | Yes |
| Cron runs every 15 min even with no games played | Yes |
| Player shows 0 score points | Yes — daily processing hasn't run yet |
| Buffs not appearing in Days 1-5 | Yes — buffs activate Day 6+ |
| Daily processing at midnight PHT (16:00 UTC) | Yes |
| Gods eliminated automatically at end of Phase 1/2 | Yes |
| Score points increase even without playing (buffs) | Yes — some buffs reward top performers |
| Data completely frozen for 30+ minutes | No — investigate |
| Bot not responding to any commands | No — check backend |

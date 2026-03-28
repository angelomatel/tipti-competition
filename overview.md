# Tipti Set 17 Bootcamp Tournament — Platform Overview
*TFT Set 17: Space Gods*
This document is intended for tournament admins. It covers what the platform does, how everything fits together, and what to watch out for.

---

## What This Platform Does

The Tipti Set 17 Bootcamp Tournament platform is an automated TFT tracker for the Space Gods set. It monitors registered players' ranked progress throughout the bootcamp period, displays live standings on a web leaderboard, lets admins manage everything through Discord commands, and automatically posts game highlights and daily recaps to designated Discord channels.

Once set up, it runs almost entirely on its own — no manual data entry required.

---

## The Three Components

| Component | What It Is | What It Does |
|-----------|------------|--------------|
| **Website** | Public leaderboard | Shows player standings, LP gains, and match history. Refreshes automatically every 30 seconds. |
| **Discord Bot** | Admin & player interface | Players register themselves. Admins manage the tournament roster and settings. |
| **Backend** | The engine | Connects everything — pulls data from Riot, saves it to the database, powers both the website and bot. |

---

## How Everything Connects

```
Players register via Discord
         │
         ▼
   Backend stores them
         │
         ▼
Every 15 minutes: Backend pulls rank data from Riot API
         │
         ▼
Database updated with latest LP, rank, and match history
         │
         ├──► Website + Discord /leaderboard show updated standings
         │
         ├──► Every 5 min: Bot checks for new 1st/8th placements → posts to Feed Channel
         │
         └──► Midnight (PHT): Bot posts daily recap + LP graph → Daily Channel
```

---

## The Player Journey

### 1. Registration
A player uses `/link PlayerName#TAG` in Discord. The bot looks up their Riot account, saves their current rank as a baseline, and adds them to the tournament. From that point on, the system tracks their progress automatically.

Admins can also register players directly with `/add-player`.

### 2. Automatic Tracking (Every 15 Minutes)
The backend silently polls Riot's API for every registered player. It records a snapshot of their current rank and LP (only when rank data has actually changed), and logs any recent ranked matches played within the tournament window. Match fetching uses the timestamp of the last captured match to avoid gaps during outages. This runs on its own — no admin action needed.

### 3. Discord Notifications
Two additional automated jobs run in the background once channels are configured:

- **Feed Channel (every 5 minutes):** The bot checks for any new 1st or 8th place finishes during the tournament window and posts them immediately. It also refreshes player Discord avatars when it encounters them. Example messages:
  - 👑 *@User just secured a 1st Place (+42 LP)!*
  - 🚨 *@User just went 8th (-45 LP)! The tilt is real!*

- **Daily Channel (midnight PHT):** At the end of each day, the bot posts a daily recap with the Climber of the Day (most LP gained) and Slider of the Day (most LP lost), along with a line graph showing the top 5 players' LP progression throughout that day.

These channels are configured via `/tournament-settings feed_channel:#channel daily_channel:#channel`.

### 4. Leaderboard
Players are ranked by their current LP (converted to a single comparable score across tiers). In case of a tie, total LP gained since the tournament started is the tiebreaker. The LP gain displayed on both the website and the Discord `/leaderboard` command is the **daily** delta (UTC+8 calendar day) — not the cumulative tournament gain. If a player hasn't played today, their displayed LP gain is 0. The website always shows the most current data.

### 5. End of Tournament
When the end date is reached, automatic updates stop. The final standings are frozen on the website.

---

## Tournament Controls

Admins set tournament dates and notification channels via the `/tournament-settings` Discord command.

- **Start date** — When LP gain tracking begins. Snapshots before this date don't count toward standings.
- **End date** — When automatic data updates stop.
- **Feed channel** — The text channel where 1st/8th place notifications are posted.
- **Daily channel** — The text channel where the midnight recap and LP graph are posted.

> If you extend the tournament past the original end date, manually run `/refresh-data` to resume updates right away (otherwise the system waits for the next scheduled cycle).

> Notification jobs automatically skip posting when the tournament is inactive (outside start–end dates).

---

## Admin Commands (Quick Reference)

| Command | What It Does |
|---------|-------------|
| `/add-player @user Name#TAG` | Register a player as admin |
| `/remove-player @user` | Remove a player from the tournament |
| `/tournament-settings` | View or update start/end dates, name, and notification channels |
| `/leaderboard` | Show current standings in Discord |
| `/profile` or `/profile @user` | View a player's rank and match history |
| `/refresh-data` | Manually trigger a data update cycle |

All admin commands are restricted to designated admin roles only.

---

## What Could Go Wrong

### Data Stops Updating
**Symptom:** The leaderboard hasn't changed in over 15 minutes.

**Likely causes:**
- The Riot API key has expired (keys must be renewed periodically)
- The backend server is down
- The tournament end date has already passed

**What to do:** Check if the backend is running. If the end date passed and you want to extend, update it and run `/refresh-data`.

---

### A Player's LP Gain Looks Wrong
**Symptom:** A player shows negative LP gain, or their starting point seems off.

**Likely cause:** The tournament start date may be set incorrectly, or the player was registered after the tournament started and their baseline wasn't captured properly.

**What to do:** Verify the tournament start date with `/tournament-settings`. If a player's baseline is wrong, re-registering them will set a new baseline from the current moment.

---

### A Player Can't Re-Register After Being Removed
**Symptom:** Player tries to `/link` and gets an error saying they're already registered.

**Cause:** Removal is a soft delete — the record still exists, just marked inactive.

**What to do:** An admin must use `/add-player` to re-register them, or manually reactivate their account in the database. When a player is reactivated, their current rank is automatically re-fetched from Riot and a fresh LP baseline is created — so LP gain starts from the moment they rejoin, not from their original registration.

---

### Riot Account Name Changed
**Symptom:** A player's displayed name on the leaderboard no longer matches their current Riot ID.

**Cause:** The player's Riot ID changed (Riot allows name changes). Data continues to update correctly (the system tracks by PUUID, not name), but the stored display name becomes stale.

**What to do:** Remove the player and re-add them with their new Riot ID. Their rank will be re-fetched and a fresh LP baseline created. Historical data from the old entry is preserved but won't link to the new one.

---

### Leaderboard Shows Stale Data on Website
**Symptom:** Discord `/leaderboard` shows updated data but the website is behind.

**Cause:** The website caches data briefly. This is usually self-resolving within 30–60 seconds.

**What to do:** Wait for the next auto-refresh, or do a hard refresh in the browser (Ctrl+Shift+R).

---

### Feed/Daily Notifications Not Posting
**Symptom:** No messages appear in the configured channels after games are played or at midnight.

**Likely causes:**
- Channels haven't been configured yet — run `/tournament-settings feed_channel:#channel daily_channel:#channel`
- The tournament is inactive (current date is outside start–end dates)
- The bot lacks `Send Messages` or `Attach Files` permissions in those channels
- The bot process is down

**What to do:** Verify channel config with `/tournament-settings`. Check the bot has the correct channel permissions. Confirm the tournament is currently active.

---

### Slow Discord Bot Responses
**Symptom:** Bot commands take a long time or time out.

**Cause:** The backend server may be slow or overloaded (e.g., in the middle of a large cron cycle with many players).

**What to do:** Check if the backend is under heavy load. This is more likely if there are 20+ active players and the cron is running simultaneously.

---

## Things to Know Before the Tournament Starts

- **Configure notification channels before the tournament starts.** Use `/tournament-settings feed_channel:#channel daily_channel:#channel`. The bot won't post to any channel until these are set.
- **Set the start date before players register.** If the start date is set after players have already been snapshotted, LP baselines may be calculated correctly — but verify this.
- **The Riot API key has a limited lifespan.** If using a development key, it expires every 24 hours. A production key (requires Riot approval) lasts much longer.
- **All historical data is preserved even if players are removed.** Nothing is permanently deleted through normal admin actions.
- **The system handles Riot API rate limits automatically.** If there are many players, updates may be slightly delayed within a cycle — this is normal.
- **Only ranked matches within the tournament window are tracked.** Matches played before the start date or after the end date are ignored.
- **Snapshots are deduplicated.** If a player's rank and LP haven't changed since the last snapshot, no new snapshot is created. This keeps the database lean and LP graphs clean.
- **Discord avatars are refreshed automatically.** When the bot encounters a player (via `/leaderboard` or feed notifications), it updates their stored avatar URL if it has changed.
- **HTTP requests have timeouts.** Backend requests to Riot API time out after 15 seconds, and bot requests to the backend time out after 10 seconds, preventing the system from hanging on unresponsive services.

---

## Normal vs. Abnormal Behavior

| Situation | Normal? |
|-----------|---------|
| Leaderboard refreshes every 30 sec on website | Yes |
| Cron runs every 15 min even when no games were played | Yes — it just records the same rank |
| Player shows 0 LP gain | Yes — no games played today, or LP unchanged since first snapshot of the day |
| A player's snapshot is missing for one cycle | Usually fine — next cycle picks it up (snapshots are skipped when rank is unchanged) |
| Cron takes a few minutes to complete with many players | Yes — normal with large rosters |
| Data completely frozen for 30+ minutes | No — investigate |
| Bot not responding to any commands | No — check if backend is running |
| Feed post appears up to 5 min after a game ends | Yes — feed job runs every 5 minutes |
| Daily recap posts at midnight PHT (16:00 UTC) | Yes — this is expected |
| No daily recap if no games were played that day | Yes — bot skips posting when there's no data |

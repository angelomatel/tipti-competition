/** Discord embed color palette. */
export const EMBED_COLORS = {
  PRIMARY: 0x7b2fff,   // Purple — default for all command embeds
  GOLD: 0xffd700,      // Gold — 1st place notification
  DANGER: 0xff4444,    // Red — 8th place / error notifications
} as const;

/** Cron schedule expressions for notification jobs. */
export const CRON_SCHEDULES = {
  FEED_JOB: '*/5 * * * *',   // Every 5 minutes
  DAILY_JOB: '0 16 * * *',   // 16:00 UTC (midnight UTC+8)
} as const;

/** Maximum entries shown in the /leaderboard command. */
export const LEADERBOARD_TOP_N = 10;

/** Timeout in milliseconds for outbound HTTP requests to the backend API. */
export const BACKEND_REQUEST_TIMEOUT_MS = 10_000;

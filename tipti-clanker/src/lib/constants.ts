/** Discord embed color palette. */
export const EMBED_COLORS = {
  PRIMARY: 0x7b2fff,   // Purple — default for all command embeds
  GOLD: 0xffd700,      // Gold — 1st place notification
  DANGER: 0xff4444,    // Red — 8th place / error notifications
  ELIMINATION: 0x8b0000,  // Dark red — god elimination
  GOD_STANDINGS: 0x4b0082, // Indigo — god standings
} as const;

/** Cron schedule expressions for notification jobs. */
export const CRON_SCHEDULES = {
  FEED_JOB: '*/5 * * * *',   // Every 5 minutes
  DAILY_JOB: '0 16 * * *',   // 16:00 UTC (midnight UTC+8)
  GOD_STANDINGS_JOB: '5 16 * * *', // 16:05 UTC (5 min after daily processing)
} as const;

/** Maximum entries shown in the /leaderboard command. */
export const LEADERBOARD_TOP_N = 10;

/** Timeout in milliseconds for outbound HTTP requests to the backend API. */
export const BACKEND_REQUEST_TIMEOUT_MS = 10_000;

/** God definitions for Discord interactions. */
export const GOD_CHOICES = [
  { slug: 'varus',        name: 'Varus',        title: 'Love' },
  { slug: 'ekko',         name: 'Ekko',         title: 'Time' },
  { slug: 'evelynn',      name: 'Evelynn',      title: 'Temptation' },
  { slug: 'thresh',       name: 'Thresh',       title: 'Pacts' },
  { slug: 'yasuo',        name: 'Yasuo',        title: 'Abyss' },
  { slug: 'soraka',       name: 'Soraka',       title: 'Stars' },
  { slug: 'kayle',        name: 'Kayle',        title: 'Order' },
  { slug: 'ahri',         name: 'Ahri',         title: 'Opulence' },
  { slug: 'aurelion_sol', name: 'Aurelion Sol', title: 'Wonders' },
] as const;

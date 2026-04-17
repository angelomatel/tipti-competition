import { Tier } from '@/types/Rank';

/** Discord embed color palette. */
export const EMBED_COLORS = {
  PRIMARY: 0x7b2fff,   // Purple — default for all command embeds
  GOLD: 0xffd700,      // Gold — 1st place notification
  DANGER: 0xff4444,    // Red — 8th place / error notifications
  ELIMINATION: 0x8b0000,  // Dark red — god elimination
  GOD_STANDINGS: 0x4b0082, // Indigo — god standings
  REGULAR_TOP: 0x2dd4bf,  // Teal — top-half placements (2nd–4th)
  REGULAR_BOT: 0xfb923c,  // Orange — bottom-half placements (5th–7th)
} as const;

/** Cron schedule expressions for notification jobs. */
export const CRON_SCHEDULES = {
  FEED_JOB: '*/5 * * * *',   // Every 5 minutes
  DAILY_JOB: '5 16 * * *',   // 16:05 UTC (5 min after daily processing)
  GOD_STANDINGS_JOB: '10 16 * * *', // 16:10 UTC (after daily recap)
} as const;

/** Maximum entries shown in the /leaderboard command. */
export const LEADERBOARD_TOP_N = 10;

/** Timeout in milliseconds for outbound HTTP requests to the backend API. */
export const BACKEND_REQUEST_TIMEOUT_MS = 10_000;

/** Shared header name used for protected backend mutations. */
export const BACKEND_ADMIN_PASSWORD_HEADER = 'x-admin-password';

/** Fallback bootcamp chat channel used when not configured in tournament settings. */
export const DEFAULT_BOOTCAMP_CHAT_CHANNEL_ID = '1487949806021247016';

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

/** Canonical god buff summary lines shown in registration/admin selection embeds. */
export const GOD_BUFF_SUMMARIES = [
  '**Varus** — *Love*: +7/match. Top 10 in god leaderboard: +8/match',
  '**Ekko** — *Time*: +2/match. +20 if same placement as previous match',
  '**Evelynn** — *Temptation*: +1/match, or +25/match if LP gain exceeds rank threshold (300/200/150/100)',
  "**Thresh** — *Pacts*: +2/match. +13 if matching Top 1's latest placement. Top 1: +13/match",
  '**Yasuo** — *Abyss*: 5th → +7, 6th → +15, 7th → +25, 8th → +33. Daily cap: 120',
  '**Soraka** — *Stars*: +5/-2 per streak match (cap 15 streak). Daily cap: 100',
  '**Kayle** — *Order*: +2/match. +15 bonus if ≥4 matches played that day',
  '**Ahri** — *Opulence*: +17 per 1st place match',
  '**Aurelion Sol** — *Wonders*: Random per match based on placement (1st: 0-10, 8th: -6 to 4). Daily cap: 90',
] as const;

/** Custom rank emojis for Discord embeds (uploaded to the server). */
export const RANK_EMOJIS: Partial<Record<Tier, string>> = {
  [Tier.IRON]:        '<:iron:1457026116001988763>',
  [Tier.BRONZE]:      '<:bronze:1457026206674194556>',
  [Tier.SILVER]:      '<:silver:1457026070854373619>',
  [Tier.GOLD]:        '<:gold:1457026180694933650>',
  [Tier.PLATINUM]:    '<:platinum:1461948180471218267>',
  [Tier.EMERALD]:     '<:emerald:1457026255894478890>',
  [Tier.DIAMOND]:     '<:diamond:1457026145739346012>',
  [Tier.MASTER]:      '<:master:1457026279210483743>',
  [Tier.GRANDMASTER]: '<:grandmaster:1457026329148002395>',
  [Tier.CHALLENGER]:  '<:challenger:1457026304279974063>',
};

/** God-specific embed colors (primary color per god). */
export const GOD_COLORS: Record<string, number> = {
  varus:        0xf472b6,
  ekko:         0x67e8f9,
  evelynn:      0xa78bfa,
  thresh:       0x4ade80,
  yasuo:        0x94a3b8,
  soraka:       0xfbbf24,
  kayle:        0xf97316,
  ahri:         0xe879f9,
  aurelion_sol: 0x60a5fa,
};

/** Labels for point transaction sources (buffs). */
export const SOURCE_LABELS: Record<string, string> = {
  daily_lp_gain: 'Matches',
  lp_data: 'LP Delta',
  lp_delta: 'LP Delta',
  varus_flat: 'Varus (Flat)',
  varus_top10: 'Varus (Top 10)',
  ekko_flat: 'Ekko (Flat)',
  ekko_repeat: 'Ekko (Repeat)',
  evelynn_flat: 'Evelynn (Flat)',
  evelynn_high: 'Evelynn (High LP)',
  thresh_flat: 'Thresh (Flat)',
  thresh_match: 'Thresh (Match)',
  thresh_top1: 'Thresh (Top 1)',
  yasuo_5th: 'Yasuo (5th)',
  yasuo_6th: 'Yasuo (6th)',
  yasuo_7th: 'Yasuo (7th)',
  yasuo_8th: 'Yasuo (8th)',
  soraka_streak: 'Soraka Win Streak',
  soraka_loss_streak: 'Soraka Loss Streak',
  kayle_flat: 'Kayle (Flat)',
  kayle_activity: 'Kayle (Activity)',
  ahri_first_place: 'Ahri (1st Place)',
  asol_cosmic: 'Aurelion Sol (Random)',
  god_1st_place: 'God 1st Place Bonus',
  god_2nd_place: 'God 2nd Place Bonus',
  god_3rd_place: 'God 3rd Place Bonus',
};

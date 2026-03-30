export const RIOT_API_KEY = process.env.RIOT_API_KEY ?? '';
export const BACKEND_PORT = parseInt(process.env.PORT ?? '5000', 10);
export const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
export const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME ?? 'tft-tournament';
export const TOURNAMENT_START_DATE = new Date(process.env.TOURNAMENT_START_DATE ?? '2025-01-01T00:00:00Z');
export const TOURNAMENT_END_DATE = new Date(process.env.TOURNAMENT_END_DATE ?? '2025-01-14T23:59:59Z');

/** Maximum number of snapshots/matches returned in player queries. */
export const QUERY_LIMITS = {
  SNAPSHOTS: 200,
  SNAPSHOTS_RAW: 100,
  MATCHES: 50,
} as const;

/** Match placements that trigger feed notifications. */
export const NOTIFICATION_PLACEMENTS = [1, 8] as const;

/** Number of top players included in the daily LP graph. */
export const DAILY_GRAPH_TOP_N = 5;

/** Regex for validating YYYY-MM-DD date query parameters. */
export const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Milliseconds offset for UTC+8 (Asia/Manila) timezone. */
export const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Timeout in milliseconds for outbound Riot API requests. */
export const RIOT_REQUEST_TIMEOUT_MS = 15_000;

/** How long Mongoose buffers commands while disconnected before failing them. */
export const MONGODB_BUFFER_TIMEOUT_MS = 30_000;

/** Maximum retry attempts for transient MongoDB write failures. */
export const MONGODB_WRITE_RETRY_ATTEMPTS = 3;

/** Base delay in milliseconds for MongoDB write retry backoff (doubles each attempt). */
export const MONGODB_WRITE_RETRY_BASE_DELAY_MS = 1_000;

// ── God System Constants ──────────────────────────────────────────────

import type { GodDefinition } from '@/types/God';

/** All god definitions with slug, display name, and title. */
export const GOD_DEFINITIONS: GodDefinition[] = [
  { slug: 'varus',        name: 'Varus',        title: 'Love' },
  { slug: 'ekko',         name: 'Ekko',         title: 'Time' },
  { slug: 'evelynn',      name: 'Evelynn',      title: 'Temptation' },
  { slug: 'thresh',       name: 'Thresh',       title: 'Pacts' },
  { slug: 'yasuo',        name: 'Yasuo',        title: 'Abyss' },
  { slug: 'soraka',       name: 'Soraka',       title: 'Stars' },
  { slug: 'kayle',        name: 'Kayle',        title: 'Order' },
  { slug: 'ahri',         name: 'Ahri',         title: 'Opulence' },
  { slug: 'aurelion_sol', name: 'Aurelion Sol', title: 'Wonders' },
];

/** Array of all valid god slugs. */
export const GOD_SLUGS = GOD_DEFINITIONS.map((g) => g.slug);

/** Number of tournament phases. */
export const PHASE_COUNT = 3;

/** Number of gods eliminated per phase. */
export const ELIMINATION_COUNTS = [3, 3, 0] as const;

/** Default maximum buff points per player per day. */
export const BUFF_DAILY_CAP = 75;

/** Per-god daily cap overrides. */
export const GOD_DAILY_CAP_OVERRIDES: Partial<Record<string, number>> = {
  yasuo: 140,
  soraka: 125,
  aurelion_sol: 90,
};

/** God placement bonuses awarded at end of tournament. */
export const GOD_PLACEMENT_BONUSES = [100, 75, 50] as const;

/** Minimum and maximum players counted for god score average. */
export const GOD_SCORE_TOP_N = { MIN: 2, MAX: 5 } as const;

// ── Per-Match Buff Constants ─────────────────────────────────────────

/** Varus: flat bonus per match for all players. */
export const VARUS_FLAT_PER_MATCH = 3;
/** Varus: additional bonus per match for top N players in god leaderboard. */
export const VARUS_TOP10_BONUS = 7;
/** Varus: number of top players who receive the extra bonus. */
export const VARUS_TOP_N = 10;

/** Ekko: flat bonus per match. */
export const EKKO_FLAT_PER_MATCH = 2;
/** Ekko: bonus when placement matches previous match. */
export const EKKO_REPEAT_BONUS = 8;

/** Evelynn: flat bonus per match (below LP threshold). */
export const EVELYNN_FLAT_PER_MATCH = 1;
/** Evelynn: bonus per match when daily LP gain exceeds tier threshold. */
export const EVELYNN_HIGH_LP_PER_MATCH = 15;
/** Evelynn: LP gain thresholds by tier order (from normalizeLP TIER_ORDER). */
export const EVELYNN_LP_TIER_THRESHOLDS = [
  { maxTierOrder: 5, lp: 300 },  // Unranked through Platinum
  { maxTierOrder: 6, lp: 200 },  // Emerald
  { maxTierOrder: 7, lp: 150 },  // Diamond
] as const;
/** Evelynn: default LP threshold for Master and above. */
export const EVELYNN_LP_DEFAULT_THRESHOLD = 100;

/** Thresh: flat bonus per match for non-top-1 players. */
export const THRESH_FLAT_PER_MATCH = 2;
/** Thresh: bonus when placement matches top 1's latest placement. */
export const THRESH_MATCH_BONUS = 13;
/** Thresh: flat bonus per match for the top 1 player. */
export const THRESH_TOP1_FLAT = 8;

/** Yasuo: bonus for placement 5-7. */
export const YASUO_TOP5_7_BONUS = 10;
/** Yasuo: bonus for placement 8. */
export const YASUO_TOP8_BONUS = 35;

/** Soraka: points per win streak match. */
export const SORAKA_WIN_STREAK_PER = 3;
/** Soraka: points per loss streak match. */
export const SORAKA_LOSS_STREAK_PER = -1;
/** Soraka: maximum streak length counted. */
export const SORAKA_STREAK_CAP = 15;

/** Kayle: flat bonus per match. */
export const KAYLE_FLAT_PER_MATCH = 3;
/** Kayle: one-time daily bonus when match threshold is met. */
export const KAYLE_ACTIVITY_BONUS = 3;
/** Kayle: minimum matches for activity bonus. */
export const KAYLE_ACTIVITY_MIN_MATCHES = 3;

/** Ahri: points per 1st-place match. */
export const AHRI_PER_FIRST = 13;

/** Aurelion Sol: base upper bound for random roll. */
export const ASOL_BASE_UPPER = 12;
/** Aurelion Sol: max placement shift for bounds. */
export const ASOL_SHIFT_CAP = 6;

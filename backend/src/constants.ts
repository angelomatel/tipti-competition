function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const APP_ENV = process.env.NODE_ENV ?? 'development';
export const IS_PRODUCTION = APP_ENV === 'production';
export const RIOT_API_KEY = process.env.RIOT_API_KEY ?? '';
export const BACKEND_PORT = parsePositiveIntEnv(process.env.PORT, 5000);
export const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
export const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME ?? 'tft-tournament';
function parseBackendMode(value: string | undefined): 'all' | 'cron' | 'http' {
  switch (value) {
    case 'cron':
    case 'http':
    case 'all':
      return value;
    default:
      return 'all';
  }
}

export const BACKEND_MODE = parseBackendMode(process.env.BACKEND_MODE);
export const FETCH_INTERVAL_MINUTES = 5;
export const CRON_PLAYER_CONCURRENCY = 4;
export const HOT_POLL_INTERVAL_SECONDS = 60;
// Riot's ranked endpoint typically lags 30–75 min after a match ends before publishing LP.
// This TTL must exceed that lag so hot players are still polled when LP finally appears.
// Measured p75 lag across production data: ~74 min. Set to 75 for p75 coverage.
export const HOT_PLAYER_TTL_MINUTES = 75;
export const HOT_IDLE_POLLS_TO_COOLDOWN = 3;
export const COLD_DISCOVERY_RESERVE_PER_MINUTE = 10;
export const HOT_RANK_REFRESH_INTERVAL_MINUTES = 5;
export const BASELINE_RANK_REFRESH_INTERVAL_MINUTES = 15;
export const DATABASE_BACKUP_ENABLED = IS_PRODUCTION;
export const DATABASE_BACKUP_CRON = '0 */12 * * *';
export const PHT_TIMEZONE = 'Asia/Manila';
export const DATABASE_BACKUP_TIMEZONE = PHT_TIMEZONE;
export const DATABASE_BACKUP_DIR = 'backups';
export const DATABASE_BACKUP_RETENTION_COUNT = 14;
export const LEADERBOARD_CACHE_TTL_MS = 30_000;
export const NOTIFICATION_FEED_LIMIT = 50;
export const TOURNAMENT_START_DATE = new Date('2025-01-01T00:00:00Z');
export const TOURNAMENT_END_DATE = new Date('2025-01-14T23:59:59Z');
export const ADMIN_PASSWORD_HEADER = 'x-admin-password';
export const ADMIN_PASSWORD = process.env.ADMIN_API_PASSWORD ?? '';
export const LOG_LEVEL = IS_PRODUCTION ? 'info' : 'debug';
export const LOG_FILE_PATH = 'logs/app.jsonl';
export const LOG_CONSOLE_COLORS_ENABLED = true;
export const ENABLE_DEV_DATA_FETCH_CRONS_ENV = 'ENABLE_DEV_DATA_FETCH_CRONS';

/** Maximum number of snapshots/matches returned in player queries. */
export const QUERY_LIMITS = {
  SNAPSHOTS: 200,
  SNAPSHOTS_RAW: 100,
  /** Default match limit when no matchLimit query param is provided. */
  MATCHES: 20,
  /** Hard cap on matchLimit query param to prevent abuse. */
  MATCHES_MAX: 500,
} as const;


/** Number of top players included in the daily LP graph. */
export const DAILY_GRAPH_TOP_N = 5;

/** Regex for validating YYYY-MM-DD date query parameters. */
export const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Milliseconds offset for PHT (Asia/Manila). */
export const PHT_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
export const UTC8_OFFSET_MS = PHT_UTC_OFFSET_MS;

/** Timeout in milliseconds for outbound Riot API requests. */
export const RIOT_REQUEST_TIMEOUT_MS = 15_000;
/**
 * Production defaults are buffered below Riot's published starting production limits.
 * Development defaults stay aligned with personal-key limits unless explicitly overridden.
 */
export const RIOT_APP_RATE_PER_SECOND = parsePositiveIntEnv(
  process.env.RIOT_APP_RATE_PER_SECOND,
  IS_PRODUCTION ? 80 : 20,
);
export const RIOT_APP_RATE_PER_120_SECONDS = parsePositiveIntEnv(
  process.env.RIOT_APP_RATE_PER_120_SECONDS,
  IS_PRODUCTION ? 9_600 : 100,
);
export const RIOT_QUEUE_MAX_IN_FLIGHT = parsePositiveIntEnv(
  process.env.RIOT_QUEUE_MAX_IN_FLIGHT,
  IS_PRODUCTION ? 6 : 3,
);
export const SCHEDULER_MAX_PENDING_REQUESTS = parsePositiveIntEnv(
  process.env.SCHEDULER_MAX_PENDING_REQUESTS,
  IS_PRODUCTION ? 60 : 20,
);
export const SCHEDULER_MAX_P95_QUEUE_WAIT_MS = parsePositiveIntEnv(
  process.env.SCHEDULER_MAX_P95_QUEUE_WAIT_MS,
  IS_PRODUCTION ? 45_000 : 20_000,
);
export const SCHEDULER_MAX_BLOCKED_FOR_MS = parsePositiveIntEnv(
  process.env.SCHEDULER_MAX_BLOCKED_FOR_MS,
  IS_PRODUCTION ? 5_000 : 1_000,
);
export const MATCH_ID_FETCH_COUNT_BASELINE = 10;
export const MATCH_ID_FETCH_COUNT_HOT = 10;
export const MATCH_DETAIL_FETCH_CAP_BASELINE = 3;
export const MATCH_DETAIL_FETCH_CAP_HOT = MATCH_ID_FETCH_COUNT_HOT;
export const MATCH_ID_FETCH_COUNT_NORMAL = 10;
export const MATCH_ID_FETCH_COUNT_CATCHUP = 25;
export const MATCH_DETAIL_FETCH_CAP_NORMAL = 3;
export const MATCH_DETAIL_FETCH_CAP_CATCHUP = 10;

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

/** Dead-god buff lottery: base chance for the top-ranked surviving god. */
export const DEAD_GOD_LOTTERY_BASE = 0.10;
/** Dead-god buff lottery: chance increment per rank step downward. */
export const DEAD_GOD_LOTTERY_STEP = 0.15;
/** Dead-god buff lottery: maximum chance (clamped at 6th rank and below). */
export const DEAD_GOD_LOTTERY_MAX = 0.85;

/** Per-god daily cap overrides. */
export const GOD_DAILY_CAP_OVERRIDES: Partial<Record<string, number>> = {
  yasuo: 120,
  soraka: 100,
  aurelion_sol: 90,
};

/** God placement bonuses awarded at end of tournament. */
export const GOD_PLACEMENT_BONUSES = [100, 75, 50] as const;

/** Minimum and maximum players counted for god score average. */
export const GOD_SCORE_TOP_N = { MIN: 2, MAX: 5 } as const;

// ── Per-Match Buff Constants ─────────────────────────────────────────

/** Varus: flat bonus per match for all players. */
export const VARUS_FLAT_PER_MATCH = 7;
/** Varus: additional bonus per match for top N players in god leaderboard. */
export const VARUS_TOP10_BONUS = 8;
/** Varus: number of top players who receive the extra bonus. */
export const VARUS_TOP_N = 10;

/** Ekko: flat bonus per match. */
export const EKKO_FLAT_PER_MATCH = 2;
/** Ekko: bonus when placement matches previous match. */
export const EKKO_REPEAT_BONUS = 20;

/** Evelynn: flat bonus per match (below LP threshold). */
export const EVELYNN_FLAT_PER_MATCH = 1;
/** Evelynn: bonus per match when daily LP gain exceeds tier threshold. */
export const EVELYNN_HIGH_LP_PER_MATCH = 25;
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
export const THRESH_TOP1_FLAT = 13;

/** Yasuo: bonuses indexed by placement offset (index 0 = 5th, 1 = 6th, 2 = 7th, 3 = 8th). */
export const YASUO_PLACEMENT_BONUSES = [7, 15, 25, 33] as const;

/** Soraka: points per win streak match. */
export const SORAKA_WIN_STREAK_PER = 5;
/** Soraka: points per loss streak match. */
export const SORAKA_LOSS_STREAK_PER = -2;
/** Soraka: maximum streak length counted. */
export const SORAKA_STREAK_CAP = 15;

/** Kayle: flat bonus per match. */
export const KAYLE_FLAT_PER_MATCH = 2;
/** Kayle: one-time daily bonus when match threshold is met. */
export const KAYLE_ACTIVITY_BONUS = 15;
/** Kayle: minimum matches for activity bonus. */
export const KAYLE_ACTIVITY_MIN_MATCHES = 4;

/** Ahri: points per 1st-place match. */
export const AHRI_PER_FIRST = 17;

/** Aurelion Sol: base upper bound for random roll. */
export const ASOL_BASE_UPPER = 10;
/** Aurelion Sol: max placement shift for bounds. */
export const ASOL_SHIFT_CAP = 7;

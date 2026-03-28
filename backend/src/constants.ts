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

/** Maximum total buff points a god can receive per day. */
export const BUFF_DAILY_CAP = 50;

/** God placement bonuses awarded at end of tournament. */
export const GOD_PLACEMENT_BONUSES = [100, 75, 50] as const;

/** Minimum and maximum players counted for god score average. */
export const GOD_SCORE_TOP_N = { MIN: 2, MAX: 5 } as const;

// ── Individual Buff Thresholds ────────────────────────────────────────

/** Varus: points awarded to top player. */
export const VARUS_TOP_BONUS = 8;
/** Varus: points awarded to bottom player. */
export const VARUS_BOTTOM_BONUS = 6;

/** Ekko: flat bonus awarded at end of each phase. */
export const EKKO_PHASE_FLAT_BONUS = 50;

/** Evelynn: base bonus for top player. */
export const EVELYNN_BASE_BONUS = 3;
/** Evelynn: bonus when top player's daily gain >= threshold. */
export const EVELYNN_HIGH_BONUS = 7;
/** Evelynn: daily gain threshold for high bonus. */
export const EVELYNN_GAIN_THRESHOLD = 50;

/** Thresh: bonus per player in top pair. */
export const THRESH_PAIR_BONUS = 7;

/** Yasuo: bonus when daily gain >= high threshold. */
export const YASUO_HIGH_BONUS = 10;
/** Yasuo: daily gain threshold for bonus. */
export const YASUO_HIGH_THRESHOLD = 150;
/** Yasuo: penalty when daily gain <= low threshold. */
export const YASUO_LOW_PENALTY = -8;
/** Yasuo: daily gain threshold for penalty. */
export const YASUO_LOW_THRESHOLD = 100;

/** Soraka: max streak bonus per player per day. */
export const SORAKA_PLAYER_CAP = 4;

/** Kayle: end-of-tournament bonuses by placement range. */
export const KAYLE_BONUSES = {
  TOP_2: 30,
  TOP_3: 40,
  TOP_5: 50,
} as const;

/** Ahri: points per 1st-place match. */
export const AHRI_PER_FIRST = 3;
/** Ahri: max total points across tournament. */
export const AHRI_CAP = 80;
/** Ahri: max buff points per day. */
export const AHRI_DAILY_CAP = 21;

/** Aurelion Sol: point range for bonus awards. */
export const ASOL_BONUS_MIN = 5;
export const ASOL_BONUS_MAX = 10;
/** Aurelion Sol: min/max random players from top 2-10 to receive bonus. */
export const ASOL_RANDOM_PLAYERS_MIN = 1;
export const ASOL_RANDOM_PLAYERS_MAX = 3;

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

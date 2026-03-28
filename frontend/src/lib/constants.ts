export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

/** SWR polling interval for the leaderboard (ms). */
export const LEADERBOARD_REFRESH_INTERVAL = 30_000;

/** Number of skeleton rows shown while the leaderboard loads. */
export const LEADERBOARD_SKELETON_COUNT = 8;

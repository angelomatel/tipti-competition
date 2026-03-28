export const RIOT_API_KEY = process.env.RIOT_API_KEY ?? '';
export const BACKEND_PORT = parseInt(process.env.PORT ?? '5000', 10);
export const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
export const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME ?? 'tft-tournament';
export const TOURNAMENT_START_DATE = new Date(process.env.TOURNAMENT_START_DATE ?? '2025-01-01T00:00:00Z');
export const TOURNAMENT_END_DATE = new Date(process.env.TOURNAMENT_END_DATE ?? '2025-01-14T23:59:59Z');

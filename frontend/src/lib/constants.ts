const vercelDeploymentUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  process.env.BACKEND_URL ??
  (vercelDeploymentUrl ? `${vercelDeploymentUrl}/backend` : 'http://localhost:5000');

/** SWR polling interval for the leaderboard (ms). */
export const LEADERBOARD_REFRESH_INTERVAL = 30_000;

/** Number of skeleton rows shown while the leaderboard loads. */
export const LEADERBOARD_SKELETON_COUNT = 8;

/** Match link URL templates. */
export const MATCH_LINK_TACTICS_TOOLS = (gameName: string, tagLine: string, matchId: string) =>
  `https://tactics.tools/player/sg/${gameName}/${tagLine}/${matchId}`;

export const MATCH_LINK_METATFT = (gameName: string, tagLine: string, matchId: string) =>
  `https://www.metatft.com/player/SG2/${gameName}-${tagLine}?match=${matchId}`;

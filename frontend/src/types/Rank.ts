export enum Tier {
  UNRANKED = 'UNRANKED',
  IRON = 'IRON',
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  EMERALD = 'EMERALD',
  DIAMOND = 'DIAMOND',
  MASTER = 'MASTER',
  GRANDMASTER = 'GRANDMASTER',
  CHALLENGER = 'CHALLENGER',
}

export enum Division {
  I = 'I',
  II = 'II',
  III = 'III',
  IV = 'IV',
}

/** Tiers that have no division suffix (e.g. Master, Challenger). */
export const TIERS_WITHOUT_DIVISION = new Set<string>([
  Tier.UNRANKED,
  Tier.MASTER,
  Tier.GRANDMASTER,
  Tier.CHALLENGER,
]);

/** Returns a human-readable tier string, omitting division where not applicable. */
export function formatTier(tier: string, division: string): string {
  const t = tier.toUpperCase();
  const label = t.charAt(0) + t.slice(1).toLowerCase();
  return TIERS_WITHOUT_DIVISION.has(t) ? label : `${label} ${division}`;
}

export const TIER_ORDER: Record<string, number> = {
  UNRANKED: 0, IRON: 1, BRONZE: 2, SILVER: 3, GOLD: 4,
  PLATINUM: 5, EMERALD: 6, DIAMOND: 7, MASTER: 8, GRANDMASTER: 9, CHALLENGER: 10,
};

export const DIVISION_ORDER: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 };

export const TIERS_WITHOUT_DIVISION = new Set(['UNRANKED', 'MASTER', 'GRANDMASTER', 'CHALLENGER']);

export function normalizeLP(tier: string, rank: string, lp: number): number {
  const tierValue = TIER_ORDER[tier] ?? 0;
  const divisionValue = TIERS_WITHOUT_DIVISION.has(tier)
    ? 0
    : DIVISION_ORDER[rank] ?? 0;

  return tierValue * 400 + divisionValue * 100 + lp;
}

import { Tier, Division } from '@/types/Rank';

export const TIER_ORDER: Record<Tier, number> = {
  [Tier.UNRANKED]:    0,
  [Tier.IRON]:        1,
  [Tier.BRONZE]:      2,
  [Tier.SILVER]:      3,
  [Tier.GOLD]:        4,
  [Tier.PLATINUM]:    5,
  [Tier.EMERALD]:     6,
  [Tier.DIAMOND]:     7,
  [Tier.MASTER]:      8,
  [Tier.GRANDMASTER]: 9,
  [Tier.CHALLENGER]:  10,
};

export const DIVISION_ORDER: Record<Division, number> = {
  [Division.IV]:  0,
  [Division.III]: 1,
  [Division.II]:  2,
  [Division.I]:   3,
};

export const TIERS_WITHOUT_DIVISION = new Set<Tier>([
  Tier.UNRANKED, Tier.MASTER, Tier.GRANDMASTER, Tier.CHALLENGER,
]);

export function normalizeLP(tier: string, rank: string, lp: number): number {
  const tierValue = TIER_ORDER[tier as Tier] ?? 0;
  const divisionValue = TIERS_WITHOUT_DIVISION.has(tier as Tier)
    ? 0
    : DIVISION_ORDER[rank as Division] ?? 0;

  return tierValue * 400 + divisionValue * 100 + lp;
}

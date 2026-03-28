import { Tier } from '@/types/Rank';

/** Converts a tier string like "GOLD" to title case "Gold". */
export function formatTierName(tier: string): string {
  if (!tier) return '';
  const lower = tier.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Returns a human-readable rank string.
 * Examples: "Unranked", "Gold IV", "Gold IV — 75 LP"
 */
export function formatTierDisplay(tier: string, rank?: string, lp?: number): string {
  if (!tier || tier === Tier.UNRANKED) return 'Unranked';
  const tierLabel = formatTierName(tier);
  const rankStr = rank ? ` ${rank}` : '';
  const lpStr = lp !== undefined ? ` — ${lp} LP` : '';
  return `${tierLabel}${rankStr}${lpStr}`;
}

/** Formats an LP delta as "+42 LP" or "-45 LP". Returns empty string for null. */
export function formatLpDelta(delta: number | null): string {
  if (delta === null) return '';
  return delta >= 0 ? `+${delta} LP` : `${delta} LP`;
}

/** Formats an LP gain value with a leading sign, e.g. "+42" or "-15". */
export function formatLpGain(gain: number): string {
  return gain >= 0 ? `+${gain}` : `${gain}`;
}

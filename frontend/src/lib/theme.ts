export const COLORS = {
  cyan: '#67e8f9',
  purple: '#a78bfa',
  pink: '#f472b6',
  rose: '#e879f9',
  blue: '#60a5fa',
  peach: '#fb923c',
  surface0: 'rgba(15, 10, 30, 0.92)',
  surface1: 'rgba(22, 15, 45, 0.88)',
  grid: '#2a1a5e',
  mutedText: '#7c6fa0',
} as const;

export const PODIUM_COLORS: Readonly<Record<number, string>> = {
  1: 'text-[var(--gold)]',
  2: 'text-[var(--silver)]',
  3: 'text-[var(--bronze)]',
};

export const DEFAULT_RANK_COLOR = 'text-[var(--text-secondary)]';

export const TIER_COLORS: Record<string, string> = {
  CHALLENGER: '#fde68a',
  GRANDMASTER: '#fca5a5',
  MASTER: '#c4b5fd',
  DIAMOND: '#93c5fd',
  EMERALD: '#6ee7b7',
  PLATINUM: '#a5f3fc',
  GOLD: '#fcd34d',
  SILVER: '#cbd5e1',
  BRONZE: '#fb923c',
  IRON: '#9ca3af',
  UNRANKED: '#7c6fa0',
};

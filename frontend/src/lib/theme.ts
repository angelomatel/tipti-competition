/** Hex color values used across the app. */
export const COLORS = {
  cyan: '#00d4ff',
  purple: '#7b2fff',
  darkBg: '#0d0d2b',
  navBg: '#0a0a1a',
  grid: '#2a1a5e',
  mutedText: '#8b7baf',
} as const;

/** Tailwind classes for top-3 leaderboard positions. */
export const PODIUM_COLORS: Readonly<Record<number, string>> = {
  1: 'text-yellow-400',
  2: 'text-slate-300',
  3: 'text-amber-600',
};

export const DEFAULT_RANK_COLOR = 'text-violet-300';

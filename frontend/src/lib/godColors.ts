export const GOD_COLORS: Record<string, { primary: string; bgTint: string; border: string }> = {
  varus:        { primary: '#f472b6', bgTint: 'rgba(244,114,182,0.10)', border: 'rgba(244,114,182,0.30)' },
  ekko:         { primary: '#67e8f9', bgTint: 'rgba(103,232,249,0.10)', border: 'rgba(103,232,249,0.30)' },
  evelynn:      { primary: '#a78bfa', bgTint: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.30)' },
  thresh:       { primary: '#4ade80', bgTint: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.30)' },
  yasuo:        { primary: '#94a3b8', bgTint: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.30)' },
  soraka:       { primary: '#fbbf24', bgTint: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.30)' },
  kayle:        { primary: '#f97316', bgTint: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.30)' },
  ahri:         { primary: '#e879f9', bgTint: 'rgba(232,121,249,0.10)', border: 'rgba(232,121,249,0.30)' },
  aurelion_sol: { primary: '#60a5fa', bgTint: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.30)' },
};

export function getGodColor(slug: string | null) {
  if (!slug) return { primary: '#a78bfa', bgTint: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.30)' };
  return GOD_COLORS[slug] ?? { primary: '#a78bfa', bgTint: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.30)' };
}

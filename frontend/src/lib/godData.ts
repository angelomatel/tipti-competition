export const GOD_AVATAR_MAP: Record<string, string> = {
  varus: '/space_gods/avatars/0_Varus.png',
  ekko: '/space_gods/avatars/1_Ekko.png',
  evelynn: '/space_gods/avatars/2_Evelynn.png',
  thresh: '/space_gods/avatars/3_Thresh.png',
  yasuo: '/space_gods/avatars/4_Yasuo.png',
  soraka: '/space_gods/avatars/5_Soraka.png',
  kayle: '/space_gods/avatars/6_Kayle.png',
  ahri: '/space_gods/avatars/7_Ahri.png',
  aurelion_sol: '/space_gods/avatars/8_AurelionSol.png',
};

export const GOD_IMAGE_MAP: Record<string, string> = {
  varus: '/space_gods/0_Varus.png',
  ekko: '/space_gods/1_Ekko.png',
  evelynn: '/space_gods/2_Evelynn.png',
  thresh: '/space_gods/3_Thresh.png',
  yasuo: '/space_gods/4_Yasuo.png',
  soraka: '/space_gods/5_Soraka.png',
  kayle: '/space_gods/6_Kayle.png',
  ahri: '/space_gods/7_Ahri.png',
  aurelion_sol: '/space_gods/8_AurelionSol.png',
};

export const BUFF_DATA = [
  { slug: 'varus', name: 'Varus', title: 'Love', mechanic: 'Top 1 → +6, all players → +2' },
  { slug: 'ekko', name: 'Ekko', title: 'Time', mechanic: 'Flat +50 bonus at the end of each phase' },
  { slug: 'evelynn', name: 'Evelynn', title: 'Temptation', mechanic: 'Top player: +5, or +9 if ≥300 daily LP gain. All others → +2' },
  { slug: 'thresh', name: 'Thresh', title: 'Pacts', mechanic: 'Top 2 → +5 each, all players → +2' },
  { slug: 'yasuo', name: 'Yasuo', title: 'Abyss', mechanic: '≥150 gain → +10, ≤100 gain → −8' },
  { slug: 'soraka', name: 'Soraka', title: 'Stars', mechanic: '+1/−1 per latest streak, cap ±4/player' },
  { slug: 'kayle', name: 'Kayle', title: 'Order', mechanic: 'Daily: +2 for ≥5 matches. End of tournament: Top 1-2 → +20, Top 3 → +30, Top 4-5 → +40' },
  { slug: 'ahri', name: 'Ahri', title: 'Opulence', mechanic: '+3 per 1st place match, daily cap 21, overall cap 80' },
  { slug: 'aurelion_sol', name: 'Aurelion Sol', title: 'Wonders', mechanic: 'Top 1 → +5-8, all players → +1-3 (random)' },
];

/** Lookup buff mechanic by god slug */
export function getBuffMechanic(slug: string): string | null {
  return BUFF_DATA.find((b) => b.slug === slug)?.mechanic ?? null;
}

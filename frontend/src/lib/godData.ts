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
  { slug: 'varus', name: 'Varus', title: 'Love', mechanic: '+7/match. Top 10 in god leaderboard: +8/match' },
  { slug: 'ekko', name: 'Ekko', title: 'Time', mechanic: '+2/match. +20 if same placement as previous match' },
  { slug: 'evelynn', name: 'Evelynn', title: 'Temptation', mechanic: '+1/match, or +15/match if LP gain exceeds rank threshold (300/200/150/100)' },
  { slug: 'thresh', name: 'Thresh', title: 'Pacts', mechanic: '+2/match. +13 if matching Top 1\'s latest placement. Top 1: +8/match' },
  { slug: 'yasuo', name: 'Yasuo', title: 'Abyss', mechanic: 'Top 5-7 → +10/match. Top 8 → +35/match. Daily cap: 140' },
  { slug: 'soraka', name: 'Soraka', title: 'Stars', mechanic: '+5/−2 per streak match (cap 15). Daily cap: 100' },
  { slug: 'kayle', name: 'Kayle', title: 'Order', mechanic: '+3/match. +3 bonus if ≥3 matches played' },
  { slug: 'ahri', name: 'Ahri', title: 'Opulence', mechanic: '+13 per 1st place match' },
  { slug: 'aurelion_sol', name: 'Aurelion Sol', title: 'Wonders', mechanic: 'Random per match based on placement (1st: 0-12, 8th: −6 to 6). Daily cap: 90' },
];

/** Lookup buff mechanic by god slug */
export function getBuffMechanic(slug: string): string | null {
  return BUFF_DATA.find((b) => b.slug === slug)?.mechanic ?? null;
}

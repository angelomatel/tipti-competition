export const GOD_AVATAR_MAP: Record<string, string> = {
  varus: '/space_gods/avatars/god-varusicon.tft_set17.png',
  ekko: '/space_gods/avatars/god-ekkoicon.tft_set17.png',
  evelynn: '/space_gods/avatars/god_evelynicon.tft_set17.png',
  thresh: '/space_gods/avatars/god_threshicon.tft_set17.png',
  yasuo: '/space_gods/avatars/god_yasuoicon.tft_set17.png',
  soraka: '/space_gods/avatars/god_sorakaicon.tft_set17.png',
  kayle: '/space_gods/avatars/god_kayleicon.tft_set17.png',
  ahri: '/space_gods/avatars/god_ahriicon.tft_set17.png',
  aurelion_sol: '/space_gods/avatars/god_asolicon.tft_set17.png',
};

export const GOD_IMAGE_PATHS: Record<string, { neutral: string; happy: string; sad: string }> = {
  varus: {
    neutral: '/space_gods/tft17_god_varus_neutral_splash.png',
    happy: '/space_gods/tft17_god_varus_happy_splash.png',
    sad: '/space_gods/tft17_god_varus_sad_splash.png',
  },
  ekko: {
    neutral: '/space_gods/tft17_god_ekko_neutral_splash.png',
    happy: '/space_gods/tft17_god_ekko_happy_splash.png',
    sad: '/space_gods/tft17_god_ekko_sad_splash.png',
  },
  evelynn: {
    neutral: '/space_gods/tft17_god_evelynn_neutral_splash.png',
    happy: '/space_gods/tft17_god_evelynn_happy_splash.png',
    sad: '/space_gods/tft17_god_evelynn_sad_splash.png',
  },
  thresh: {
    neutral: '/space_gods/tft17_god_thresh_neutral_splash.png',
    happy: '/space_gods/tft17_god_thresh_happy_splash.png',
    sad: '/space_gods/tft17_god_thresh_sad_splash.png',
  },
  yasuo: {
    neutral: '/space_gods/tft17_god_yasuo_neutral_splash.png',
    happy: '/space_gods/tft17_god_yasuo_happy_splash.png',
    sad: '/space_gods/tft17_god_yasuo_sad_splash.png',
  },
  soraka: {
    neutral: '/space_gods/tft17_god_soraka_neutral_splash.png',
    happy: '/space_gods/tft17_god_soraka_happy_splash.png',
    sad: '/space_gods/tft17_god_soraka_sad_splash.png',
  },
  kayle: {
    neutral: '/space_gods/tft17_god_kayle_neutral_splash.png',
    happy: '/space_gods/tft17_god_kayle_happy_splash.png',
    sad: '/space_gods/tft17_god_kayle_sad_splash.png',
  },
  ahri: {
    neutral: '/space_gods/tft17_god_ahri_neutral_splash.png',
    happy: '/space_gods/tft17_god_ahri_happy_splash.png',
    sad: '/space_gods/tft17_god_ahri_sad_splash.png',
  },
  aurelion_sol: {
    neutral: '/space_gods/tft17_god_aurelionsol_neutral_splash.png',
    happy: '/space_gods/tft17_god_aurelionsol_happy_splash.png',
    sad: '/space_gods/tft17_god_aurelionsol_sad_splash.png',
  },
};

/** Compatibility map for existing implementations */
export const GOD_IMAGE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(GOD_IMAGE_PATHS).map(([slug, paths]) => [slug, paths.neutral])
);

export function getGodSplash(
  slug: string | null | undefined,
  emotion: 'neutral' | 'happy' | 'sad' = 'neutral',
  isDead: boolean = false
): string {
  const s = slug || 'varus';
  const paths = GOD_IMAGE_PATHS[s] || GOD_IMAGE_PATHS['varus'];
  if (isDead) return paths.sad;
  return paths[emotion];
}

export const GOD_BANNER_OFFSETS: Record<string, string> = {
  varus: '40%',
  ekko: '42%',
  evelynn: '45%',
  thresh: '45%',
  yasuo: '39%',
  soraka: '45%',
  kayle: '38%',
  ahri: '40%',
  aurelion_sol: '28%',
};

/** Gets the vertical offset for the god image in banners */
export function getGodBannerOffset(slug: string | null | undefined): string {
  return GOD_BANNER_OFFSETS[slug || 'varus'] ?? '50%';
}

export const BUFF_DATA = [
  { slug: 'varus', name: 'Varus', title: 'Love', mechanic: '+7/match. Top 10 in god leaderboard: +8/match' },
  { slug: 'ekko', name: 'Ekko', title: 'Time', mechanic: '+2/match. +20 if same placement as previous match' },
  { slug: 'evelynn', name: 'Evelynn', title: 'Temptation', mechanic: '+1/match, or +25/match if LP gain exceeds rank threshold (300/200/150/100)' },
  { slug: 'thresh', name: 'Thresh', title: 'Pacts', mechanic: '+2/match. +13 if matching Top 1\'s latest placement. Top 1: +13/match' },
  { slug: 'yasuo', name: 'Yasuo', title: 'Abyss', mechanic: '5th → +7, 6th → +15, 7th → +25, 8th → +33. Daily cap: 120' },
  { slug: 'soraka', name: 'Soraka', title: 'Stars', mechanic: '+5/−2 per streak match (cap 15). Daily cap: 100' },
  { slug: 'kayle', name: 'Kayle', title: 'Order', mechanic: '+2/match. +15 bonus if ≥4 matches played' },
  { slug: 'ahri', name: 'Ahri', title: 'Opulence', mechanic: '+17 per 1st place match' },
  { slug: 'aurelion_sol', name: 'Aurelion Sol', title: 'Wonders', mechanic: 'Random per match based on placement (1st: 0-10, 8th: −6 to 4). Daily cap: 90' },
];

/** Lookup buff mechanic by god slug */
export function getBuffMechanic(slug: string): string | null {
  return BUFF_DATA.find((b) => b.slug === slug)?.mechanic ?? null;
}

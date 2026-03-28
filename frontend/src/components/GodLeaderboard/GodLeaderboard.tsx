'use client';

import Image from 'next/image';
import { useGod } from '@/src/hooks/useGod';
import { GOD_IMAGE_MAP } from '@/src/components/GodBadge/GodBadge';
import { formatTier } from '@/src/types/Rank';
import RankImage from '@/src/components/images/RankImage/RankImage';
import Avatar from '@/src/components/Avatar/Avatar';
import { COLORS, PODIUM_COLORS, DEFAULT_RANK_COLOR } from '@/src/lib/theme';

const GOD_LORE: Record<string, string> = {
  varus: 'In the vast expanse between stars, Varus weaves the threads of devotion and longing. Those who pledge to Love find strength in both triumph and despair — for the heart that endures the deepest fall knows the truest rise. Under his gaze, the first and last are equal.',
  ekko: 'Time bends to Ekko\'s will, folding in on itself like the rings of a dying star. His followers learn that the past is never truly lost — each phase of battle carries the echo of their greatest moment, summoned forth when the cosmos demands it most.',
  evelynn: 'Evelynn\'s whisper cuts through the void like a blade through silk. She rewards those consumed by ambition, granting power to the one who burns brightest. But temptation is a double-edged star — only the truly exceptional feel her full embrace.',
  thresh: 'In the cold silence between galaxies, Thresh forges pacts that transcend mortality. His chosen fight not alone but as bound pairs, their fates intertwined like binary stars. Together they rise; apart they are nothing but dust.',
  yasuo: 'The Abyss speaks only in extremes. Yasuo\'s followers walk the razor\'s edge — those who soar beyond the threshold are lifted higher, while the complacent are dragged into the void. There is no middle ground in the domain of the Abyss.',
  soraka: 'Soraka reads the constellations of victory and defeat, her power flowing through the momentum of battle. Each consecutive triumph or failure compounds upon the last, building like the crescendo of a cosmic symphony that echoes across the stars.',
  kayle: 'Order is patient. Kayle watches from her throne of light as the tournament unfolds, reserving her greatest blessings for the final reckoning. When the last star falls, those who proved worthy receive her divine judgment — and the faithful are rewarded above all.',
  ahri: 'Opulence drips from every victory claimed in Ahri\'s name. She collects first-place finishes like gemstones, each one adding to a growing treasury of power. But even greed has its limits — her bounty is generous yet never infinite.',
  aurelion_sol: 'The Star Forger creates and destroys with equal indifference. His blessings fall like cosmic rain — the strongest always receive their due, but fortune smiles randomly upon others. In the realm of Wonders, fate and skill dance an eternal waltz.',
};

interface GodLeaderboardProps {
  slug: string;
  onBack: () => void;
}

const GodLeaderboard: React.FC<GodLeaderboardProps> = ({ slug, onBack }) => {
  const { data, error, isLoading } = useGod(slug);
  const fullImage = GOD_IMAGE_MAP[slug];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={onBack} className="self-start text-sm text-violet-400 hover:text-violet-300 transition-colors">
          &larr; Back to Gods
        </button>
        <div className="h-64 rounded-xl bg-violet-950/40 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-violet-950/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.god) {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={onBack} className="self-start text-sm text-violet-400 hover:text-violet-300 transition-colors">
          &larr; Back to Gods
        </button>
        <p className="text-center text-violet-400/70 py-12">Could not load god data.</p>
      </div>
    );
  }

  const { god, players } = data;
  const lore = GOD_LORE[slug] ?? '';

  return (
    <div className="flex flex-col gap-6">
      <button onClick={onBack} className="self-start text-sm text-violet-400 hover:text-violet-300 transition-colors">
        &larr; Back to Gods
      </button>

      {/* God hero section */}
      <div className="relative rounded-2xl overflow-hidden border border-violet-900/40 bg-[#0d0d2b]">
        {fullImage && (
          <div className="relative w-full h-64 sm:h-80">
            <Image
              src={fullImage}
              alt={god.name}
              fill
              className={`object-cover object-top ${god.isEliminated ? 'grayscale opacity-60' : ''}`}
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d2b] via-[#0d0d2b]/40 to-transparent" />
          </div>
        )}

        <div className={`relative px-6 ${fullImage ? '-mt-20' : 'pt-6'} pb-6`}>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            {god.name}
          </h1>
          <h2 className="text-lg sm:text-xl font-semibold text-violet-400 mt-1">
            {god.title}
          </h2>
          {god.isEliminated && (
            <span className="inline-block mt-2 px-3 py-1 text-xs font-bold text-red-400 bg-red-950/60 rounded-full">
              ELIMINATED — Phase {god.eliminatedInPhase}
            </span>
          )}
          {lore && (
            <p className="mt-4 text-sm text-violet-300/70 leading-relaxed max-w-2xl">
              {lore}
            </p>
          )}
        </div>
      </div>

      {/* Player list */}
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-bold text-white">
          Players ({players.length})
        </h3>

        {players.length === 0 ? (
          <p className="text-center text-violet-400/70 py-8">No players in this god yet.</p>
        ) : (
          players.map((player, index) => {
            const rank = index + 1;
            const rankColor = PODIUM_COLORS[rank] ?? DEFAULT_RANK_COLOR;
            const tierDisplay = formatTier(player.currentTier, player.currentRank);
            const initials = player.gameName.charAt(0).toUpperCase();

            return (
              <div
                key={player.discordId}
                className={`flex items-center gap-4 px-5 py-4 rounded-xl bg-[#0d0d2b] border border-violet-900/40 ${
                  player.isEliminatedFromGod ? 'opacity-60' : ''
                }`}
              >
                <span className={`w-8 text-center font-bold text-lg ${rankColor}`}>
                  {rank}
                </span>

                <Avatar
                  src={player.discordAvatarUrl}
                  alt={player.discordUsername || player.gameName}
                  initials={initials}
                  size="md"
                />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">
                    {player.gameName}
                    <span className="text-violet-400 font-normal">#{player.tagLine}</span>
                  </p>
                  <p className="text-xs text-violet-300/70 flex items-center gap-1">
                    <RankImage tier={player.currentTier} size={16} />
                    {tierDisplay} &bull; {player.currentLP} LP
                  </p>
                </div>

                <span
                  className="px-3 py-1 rounded-full text-sm font-bold bg-cyan-950/60"
                  style={{ color: COLORS.cyan }}
                >
                  {player.scorePoints} pts
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GodLeaderboard;

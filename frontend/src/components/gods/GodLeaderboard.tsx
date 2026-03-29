'use client';

import Image from 'next/image';
import { useGod } from '@/src/hooks/useGod';
import { useTournament } from '@/src/hooks/useTournament';
import { GOD_IMAGE_MAP } from '@/src/lib/godData';
import { getBuffMechanic } from '@/src/lib/godData';
import { isEventStarted } from '@/src/lib/tournament';
import { formatTier } from '@/src/types/Rank';
import RankImage from '@/src/components/images/RankImage/RankImage';
import Avatar from '@/src/components/shared/Avatar';
import { PODIUM_COLORS, DEFAULT_RANK_COLOR } from '@/src/lib/theme';
import { getGodColor } from '@/src/lib/godColors';

const GOD_LORE: Record<string, string> = {
  varus: 'In the vast expanse between stars, Varus weaves the threads of devotion and longing. His love is unconditional — every follower who takes the field feels the warmth of his embrace. Yet the one who burns brightest earns the title of Beloved, lifted highest by a love that knows no equal.',
  ekko: 'Time bends to Ekko\'s will, folding in on itself like the rings of a dying star. His followers learn that the past is never truly lost — each phase of battle carries the echo of their greatest moment, summoned forth when the cosmos demands it most.',
  evelynn: 'Evelynn\'s whisper echoes through the void, reaching every soul who dares to compete. All who fight hear her call, but the one consumed by ambition — the one who climbs beyond reason — earns her full seduction. Temptation spares no one; it simply rewards the bold beyond measure.',
  thresh: 'In the cold silence between galaxies, Thresh forges a covenant that binds all who follow him. Every soul in his domain shares in the pact\'s power. But the two who rise highest forge a soul bond deeper than the void itself — their fates intertwined like binary stars, burning brighter than any alone.',
  yasuo: 'The Abyss speaks only in extremes. Yasuo\'s followers walk the razor\'s edge — those who soar beyond the threshold are lifted higher, while the complacent are dragged into the void. There is no middle ground in the domain of the Abyss.',
  soraka: 'Soraka reads the constellations of victory and defeat, her power flowing through the momentum of battle. Each consecutive triumph or failure compounds upon the last, building like the crescendo of a cosmic symphony that echoes across the stars.',
  kayle: 'Order demands discipline, not merely victory. Kayle watches each day from her throne of light, blessing those who maintain the structure she demands. When the final star falls, her greatest judgment descends — but only those who proved their daily devotion will stand ready to receive it.',
  ahri: 'Opulence drips from every victory claimed in Ahri\'s name. She collects first-place finishes like gemstones, each one adding to a growing treasury of power. But even greed has its limits — her bounty is generous yet never infinite.',
  aurelion_sol: 'The Star Forger scatters stardust across all who walk beneath his cosmos — every follower feels the touch of wonder. Yet the brightest star earns the supernova, a surge of cosmic power reserved for the one who shines above all. In the realm of Wonders, no soul is forgotten.',
};

interface GodLeaderboardProps {
  slug: string;
  onBack: () => void;
}

const GodLeaderboard: React.FC<GodLeaderboardProps> = ({ slug, onBack }) => {
  const { data, error, isLoading } = useGod(slug);
  const { data: tournamentData } = useTournament();
  const started = isEventStarted(tournamentData?.settings);
  const fullImage = GOD_IMAGE_MAP[slug];
  const godColors = getGodColor(slug);
  const buffMechanic = getBuffMechanic(slug);

  const backButton = (
    <button
      onClick={onBack}
      className="self-start text-sm transition-all duration-200 text-text-muted hover:text-text-secondary hover:-translate-x-[3px]"
    >
      &larr; Back to Gods
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {backButton}
        <div className="h-72 sm:h-96 rounded-[var(--radius-lg)] animate-pulse bg-surface-1" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-[var(--radius-md)] animate-pulse bg-surface-1" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.god) {
    return (
      <div className="flex flex-col gap-4">
        {backButton}
        <p className="text-center py-12 text-text-muted">
          Could not load god data.
        </p>
      </div>
    );
  }

  const { god, players } = data;
  const lore = GOD_LORE[slug] ?? '';

  return (
    <div className="flex flex-col gap-6">
      {backButton}

      {/* God hero section */}
      <div className="relative overflow-hidden bg-surface-1 border border-border-default rounded-[var(--radius-lg)]">
        {fullImage && (
          <div className="relative w-full h-72 sm:h-96">
            <Image
              src={fullImage}
              alt={god.name}
              fill
              sizes="(max-width: 640px) 100vw, 896px"
              className="object-contain object-bottom-right hidden sm:block"
              style={{ filter: god.isEliminated ? 'grayscale(1) opacity(0.6)' : 'none' }}
              priority
            />
            {/* Left-to-right gradient overlay (desktop) */}
            <div
              className="absolute inset-0 hidden sm:block"
              style={{
                background: 'linear-gradient(to right, rgba(15,10,30,0.97) 0%, rgba(15,10,30,0.88) 45%, rgba(15,10,30,0.30) 75%, transparent 100%)',
              }}
              aria-hidden
            />
            {/* Bottom fade (desktop) */}
            <div
              className="absolute inset-0 hidden sm:block"
              style={{
                background: 'linear-gradient(to top, rgba(15,10,30,0.95) 0%, transparent 40%, rgba(15,10,30,0.15) 100%)',
              }}
              aria-hidden
            />
            {/* Mobile: full overlay so text is readable */}
            <div className="absolute inset-0 sm:hidden bg-surface-0/80" aria-hidden />
          </div>
        )}

        <div
          className={
            fullImage
              ? 'absolute inset-x-0 top-0 z-10 px-6 sm:px-8 pt-6 sm:pt-8'
              : 'relative px-6 pt-6 pb-6'
          }
        >
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight text-text-primary" style={{ textShadow: '0 2px 24px rgba(0,0,0,0.55)' }}>
            {god.name}
          </h1>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mt-2 text-text-secondary" style={{ textShadow: '0 1px 16px rgba(0,0,0,0.5)' }}>
            God of {god.title}
          </h2>
          {god.isEliminated && (
            <span className="inline-block mt-3 px-3 py-1 text-xs font-bold text-red-400 rounded-full bg-surface-0 border border-red-500/25">
              ELIMINATED &mdash; Phase {god.eliminatedInPhase}
            </span>
          )}
          {lore && (
            <p
              className="mt-4 text-sm leading-relaxed italic sm:max-w-[50%]"
              style={{
                fontFamily: 'var(--font-lore)',
                color: 'var(--text-secondary)',
                textShadow: '0 1px 12px rgba(0,0,0,0.55)',
              }}
            >
              {lore}
            </p>
          )}
          {buffMechanic && (
            <p className="mt-3 text-sm font-medium" style={{ color: godColors.primary, textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>
              Buff: {buffMechanic}
            </p>
          )}
        </div>
      </div>

      {/* Player list */}
      {started ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-bold text-text-primary">
            Players ({players.length})
          </h3>

          {players.length === 0 ? (
            <p className="text-center py-8 text-text-muted">
              No players in this god yet.
            </p>
          ) : (
            players.map((player, index) => {
              const rank = index + 1;
              const rankColor = PODIUM_COLORS[rank] ?? DEFAULT_RANK_COLOR;
              const tierDisplay = formatTier(player.currentTier, player.currentRank);
              const initials = player.gameName.charAt(0).toUpperCase();

              return (
                <div
                  key={player.discordId}
                  className={`flex items-center gap-4 px-5 py-4 rounded-[var(--radius-md)] transition-colors bg-surface-1 border border-border-default ${
                    player.isEliminatedFromGod ? 'opacity-55' : ''
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
                    <p className="font-semibold truncate text-text-primary">
                      {player.gameName}
                      <span className="text-text-muted font-normal">#{player.tagLine}</span>
                    </p>
                    <p className="text-xs flex items-center gap-1 text-text-secondary">
                      <RankImage tier={player.currentTier} size={16} />
                      {tierDisplay} &bull; {player.currentLP} LP
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-full text-sm font-bold text-accent-cyan bg-accent-cyan/8 border border-accent-cyan/20">
                    {player.scorePoints} pts
                  </span>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <p className="text-center py-8 text-text-muted">
          Players will be revealed when the event starts.
        </p>
      )}
    </div>
  );
};

export default GodLeaderboard;

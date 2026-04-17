'use client';

import Image from 'next/image';
import { useGod } from '@/src/hooks/useGod';
import { useTournament } from '@/src/hooks/useTournament';
import { getBuffMechanic, getGodSplash, BUFF_DATA, GOD_LORE } from '@/src/lib/godData';
import { isEventStarted } from '@/src/lib/tournament';
import { formatTier } from '@/src/types/Rank';
import RankImage from '@/src/components/Images/RankImage/RankImage';
import Avatar from '@/src/components/Shared/Avatar';
import { PODIUM_COLORS, DEFAULT_RANK_COLOR, TIER_COLORS } from '@/src/lib/theme';
import { getGodColor } from '@/src/lib/godColors';

interface GodLeaderboardProps {
  slug: string;
  onBack: () => void;
  onSelectPlayer?: (discordId: string) => void;
}

const GodLeaderboard: React.FC<GodLeaderboardProps> = ({ slug, onBack, onSelectPlayer }) => {
  const { data: tournamentData, isLoading: isTournamentLoading } = useTournament();
  const started = isEventStarted(tournamentData?.settings);
  const { data, error, isLoading: isGodLoading } = useGod(started ? slug : null);

  const isLoading = isTournamentLoading || (started && isGodLoading);

  const staticGod = BUFF_DATA.find((g) => g.slug === slug);
  const fallbackGod = {
    slug,
    name: staticGod?.name ?? slug,
    title: staticGod?.title ?? 'Unknown',
    isEliminated: false,
    eliminatedInPhase: null,
  };
  const god = data?.god ?? fallbackGod;

  const fullImage = getGodSplash(slug, 'neutral', god.isEliminated);
  const godColors = getGodColor(slug);
  const buffMechanic = getBuffMechanic(slug);
  const hasLiveData = Boolean(data?.god && !error);

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
        <div className="h-64 sm:h-96 rounded-[var(--radius-lg)] animate-pulse bg-surface-1" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-[var(--radius-md)] animate-pulse bg-surface-1" />
          ))}
        </div>
      </div>
    );
  }

  const players = hasLiveData ? (data?.players ?? []) : [];
  const lore = GOD_LORE[slug] ?? '';

  return (
    <div className="flex flex-col gap-6">
      {backButton}

      {/* God hero section */}
      <div className="relative overflow-hidden bg-surface-1 border border-border-default rounded-[var(--radius-lg)] min-h-64 sm:min-h-96">
        {fullImage && (
          <>
            <div className="absolute inset-0" aria-hidden>
              <Image
                src={fullImage}
                alt={god.name}
                fill
                sizes="(max-width: 640px) 100vw, 896px"
                className="object-cover object-top sm:object-contain sm:object-bottom-right"
                style={{ filter: god.isEliminated ? 'grayscale(1) opacity(0.6)' : 'none' }}
                priority
              />
            </div>
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
            {/* Mobile overlay for readability while keeping artwork in the background */}
            <div
              className="absolute inset-0 sm:hidden"
              style={{
                background: 'linear-gradient(to top, rgba(15,10,30,0.95) 0%, rgba(15,10,30,0.65) 45%, rgba(15,10,30,0.2) 100%)',
              }}
              aria-hidden
            />
          </>
        )}

        <div className={fullImage ? 'relative z-10 px-4 py-4 sm:px-10 sm:py-14' : 'relative px-4 py-4 sm:px-6 sm:pt-6 sm:pb-6'}>
          <h1
            className="text-2xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-text-primary"
            style={{
              textShadow: '0 0 1px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.5), 0 6px 24px rgba(0,0,0,0.5)',
              WebkitTextStroke: '0.5px rgba(0,0,0,0.25)',
            }}
          >
            {god.name}
          </h1>
          <h2
            className="mt-1.5 text-sm font-semibold text-text-secondary sm:mt-2 sm:text-xl lg:text-2xl"
            style={{
              textShadow: '0 0 1px rgba(0,0,0,0.45), 0 1px 16px rgba(0,0,0,0.5)',
            }}
          >
            God of {god.title}
          </h2>
          {god.isEliminated && (
            <span className="mt-2.5 inline-block rounded-full border border-red-500/25 bg-surface-0 px-3 py-1 text-xs font-bold text-red-400 sm:mt-3">
              ELIMINATED &mdash; Phase {god.eliminatedInPhase}
            </span>
          )}
          {lore && (
            <p
              className="mt-3 max-w-[17rem] overflow-hidden text-xs leading-snug italic [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] sm:mt-4 sm:max-w-[50%] sm:text-sm sm:[display:block] lg:text-base"
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
            <p className="mt-2 text-xs font-medium sm:mt-3 sm:text-sm" style={{ color: godColors.primary, textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>
              Buff: {buffMechanic}
            </p>
          )}
        </div>
      </div>

      {/* Player list */}
      {!started && (
        <p className="text-center py-12 text-text-muted">
          Players will be revealed when the event starts.
        </p>
      )}

      {started && !hasLiveData && !isLoading && (
        <p className="text-center text-xs text-text-muted pb-8">
          Live player list is currently unavailable.
        </p>
      )}
      {hasLiveData && started && (
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
              const chipClass = 'inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-2/70 px-2.5 py-1 text-[11px] text-text-secondary';

              return (
                <div
                  key={player.discordId}
                  className={`rounded-[var(--radius-md)] border border-border-default bg-surface-1 px-3 py-3 transition-colors sm:px-5 sm:py-4 ${
                    player.isEliminatedFromGod ? 'opacity-55' : ''
                  } ${onSelectPlayer ? 'cursor-pointer hover:bg-surface-hover hover:border-border-bright' : ''}`}
                  onClick={onSelectPlayer ? () => onSelectPlayer(player.discordId) : undefined}
                >
                  <div className="sm:hidden">
                    <div className="flex items-start gap-3">
                      <span className={`w-7 pt-1 text-center font-bold text-base ${rankColor}`}>
                        {rank}
                      </span>

                      <Avatar
                        src={player.discordAvatarUrl}
                        alt={player.discordUsername || player.gameName}
                        initials={initials}
                        size="md"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-text-primary">
                              {player.gameName}
                            </p>
                            <p className="truncate text-xs text-text-muted">
                              #{player.tagLine}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full border border-accent-cyan/20 bg-accent-cyan/8 px-2.5 py-1 text-xs font-bold text-accent-cyan">
                            {player.scorePoints} pts
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={chipClass}>
                            <RankImage tier={player.currentTier} size={16} />
                            <span style={{ color: TIER_COLORS[player.currentTier] || TIER_COLORS.UNRANKED }}>{tierDisplay}</span>
                            <span className="opacity-50">&middot;</span>
                            <span className="text-text-secondary">{player.currentLP} LP</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="hidden items-center gap-4 sm:flex">
                    <span className={`w-8 text-center font-bold text-lg ${rankColor}`}>
                      {rank}
                    </span>

                    <Avatar
                      src={player.discordAvatarUrl}
                      alt={player.discordUsername || player.gameName}
                      initials={initials}
                      size="md"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-text-primary">
                        {player.gameName}
                        <span className="font-normal text-text-muted">#{player.tagLine}</span>
                      </p>
                      <p className="flex items-center gap-1 text-xs text-text-secondary">
                        <RankImage tier={player.currentTier} size={16} />
                        <span style={{ color: TIER_COLORS[player.currentTier] || TIER_COLORS.UNRANKED }}>{tierDisplay}</span>
                        <span className="text-[11px] text-text-muted">{player.currentLP} LP</span>
                      </p>
                    </div>

                    <span className="rounded-full border border-accent-cyan/20 bg-accent-cyan/8 px-3 py-1 text-sm font-bold text-accent-cyan">
                      {player.scorePoints} pts
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default GodLeaderboard;

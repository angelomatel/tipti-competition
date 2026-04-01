'use client';

import Image from 'next/image';
import { useGods } from '@/src/hooks/useGods';
import { useTournament } from '@/src/hooks/useTournament';
import { BUFF_DATA, getGodSplash, getGodBannerOffset } from '@/src/lib/godData';
import { getGodColor } from '@/src/lib/godColors';
import { isEventStarted } from '@/src/lib/tournament';
import type { GodInfo } from '@/src/types/God';

interface GodStandingsProps {
  onSelectGod?: (slug: string) => void;
}

const GodStandings: React.FC<GodStandingsProps> = ({ onSelectGod }) => {
  const { data, error, isLoading } = useGods();
  const { data: tournamentData } = useTournament();
  const started = isEventStarted(tournamentData?.settings);
  const fallbackStandings: GodInfo[] = BUFF_DATA.map((god) => ({
    ...god,
    score: 0,
    playerCount: 0,
    isEliminated: false,
  }));
  const standings = data?.standings ?? fallbackStandings;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-48 rounded-[var(--radius-md)] animate-pulse bg-surface-1" />
        ))}
      </div>
    );
  }

  const active = standings.filter((g) => !g.isEliminated);
  const eliminated = standings.filter((g) => g.isEliminated);

  const renderCard = (god: GodInfo, rankIndex: number, isEliminated: boolean) => {
    const imageSrc = getGodSplash(god.slug, 'neutral', isEliminated);
    const godColors = getGodColor(god.slug);

    return (
      <div
        key={god.slug}
        className={`group relative rounded-[var(--radius-md)] overflow-hidden cursor-pointer transition-all duration-300 h-48 ${
          isEliminated ? 'opacity-55 grayscale-[0.6] hover:grayscale-0 hover:opacity-100' : 'hover:-translate-y-0.5'
        }`}
        style={{ border: '1px solid var(--border)' }}
        onClick={() => onSelectGod?.(god.slug)}
        onMouseEnter={(e) => {
          if (!isEliminated) {
            e.currentTarget.style.borderColor = godColors.border;
            e.currentTarget.style.boxShadow = `0 0 18px ${godColors.primary}22`;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Full art background */}
        {imageSrc && (
          <>
            <Image
              src={imageSrc}
              alt={god.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-all duration-300 group-hover:opacity-0"
              style={{ 
                filter: isEliminated ? 'grayscale(1)' : 'none',
                objectPosition: `center ${getGodBannerOffset(god.slug)}`
              }}
            />
            <Image
              src={getGodSplash(god.slug, 'happy')}
              alt={`${god.name} happy`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ 
                filter: 'none',
                objectPosition: `center ${getGodBannerOffset(god.slug)}`
              }}
            />
          </>
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(10,6,24,0.95) 0%, rgba(10,6,24,0.6) 50%, rgba(10,6,24,0.2) 100%)' }}
        />

        {/* Rank badge / Eliminated badge */}
        {!isEliminated && (
          <span 
            className="absolute top-3 right-3 text-xs font-bold text-text-primary z-10"
            style={{ textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,1)' }}
          >
            #{rankIndex + 1}
          </span>
        )}
        {isEliminated && (
          <span className="absolute top-3 right-3 text-[10px] font-bold tracking-wider text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded-full z-10">
            ELIMINATED
          </span>
        )}

        {/* Content overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 z-10">
          <h3 className="font-bold text-lg text-text-primary">{god.name}</h3>
          <p className="text-xs text-text-muted">God of {god.title}</p>

          {started && (
            <div className="flex justify-between items-end mt-2">
              <span className="flex items-baseline gap-1">
                <p
                  className="text-2xl font-bold"
                  style={{ color: isEliminated ? 'var(--text-muted)' : godColors.primary }}
                >
                  {Math.round(god.score)}
                </p>
                <p className="text-xs text-text-muted mb-0.5">
                  points
                </p>
              </span>
              <p className="text-sm font-semibold text-text-secondary">
                {god.playerCount} <span className="text-xs text-text-muted">players</span>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="text-center text-xs text-text-muted">
          Live standings are currently unavailable. Showing default gods.
        </p>
      )}

      {/* Active gods grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {active.map((god, index) => renderCard(god, index, false))}
      </div>

      {/* Eliminated gods */}
      {eliminated.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Eliminated
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {eliminated.map((god, index) => renderCard(god, active.length + index, true))}
          </div>
        </div>
      )}

      {data?.updatedAt && (
        <p className="text-center text-xs pt-1 text-text-muted">
          Last updated: {new Date(data?.updatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};

export default GodStandings;

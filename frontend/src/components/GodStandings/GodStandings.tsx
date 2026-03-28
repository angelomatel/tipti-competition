'use client';

import Image from 'next/image';
import { useGods } from '@/src/hooks/useGods';
import { GOD_AVATAR_MAP } from '@/src/components/GodBadge/GodBadge';
import { COLORS } from '@/src/lib/theme';

interface GodStandingsProps {
  onSelectGod?: (slug: string) => void;
}

const GodStandings: React.FC<GodStandingsProps> = ({ onSelectGod }) => {
  const { data, error, isLoading } = useGods();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-violet-950/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-center text-violet-400/70 py-12">
        Could not load god standings.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.standings.map((god, index) => {
          const imageSrc = GOD_AVATAR_MAP[god.slug];
          const isEliminated = god.isEliminated;

          return (
            <div
              key={god.slug}
              className={`relative rounded-xl border p-4 transition-colors cursor-pointer ${
                isEliminated
                  ? 'bg-[#0d0d2b]/50 border-red-900/30 opacity-60'
                  : 'bg-[#0d0d2b] border-violet-900/40 hover:border-violet-600/60'
              }`}
              onClick={() => onSelectGod?.(god.slug)}
            >
              {/* Rank badge */}
              {!isEliminated && (
                <span className="absolute top-3 right-3 text-xs font-bold text-violet-400/60">
                  #{index + 1}
                </span>
              )}
              {isEliminated && (
                <span className="absolute top-3 right-3 text-xs font-bold text-red-500/70">
                  ELIMINATED
                </span>
              )}

              <div className="flex items-center gap-3 mb-3">
                {imageSrc && (
                  <Image
                    src={imageSrc}
                    alt={god.name}
                    width={40}
                    height={40}
                    className={`rounded-full ${isEliminated ? 'grayscale' : ''}`}
                  />
                )}
                <div>
                  <h3 className="font-bold text-white">{god.name}</h3>
                  <p className="text-xs text-violet-400/60">{god.title}</p>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-bold" style={{ color: isEliminated ? '#666' : COLORS.cyan }}>
                    {Math.round(god.score)}
                  </p>
                  <p className="text-xs text-violet-400/60">Score</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-violet-300">
                    {god.playerCount}
                  </p>
                  <p className="text-xs text-violet-400/60">Players</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {data.updatedAt && (
        <p className="text-center text-xs text-violet-500/50 pt-2">
          Last updated: {new Date(data.updatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};

export default GodStandings;

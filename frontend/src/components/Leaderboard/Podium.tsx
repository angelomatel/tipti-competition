'use client';

import type { LeaderboardEntry } from '@/src/types/LeaderboardEntry';
import { formatTier } from '@/src/types/Rank';
import Avatar from '@/src/components/Shared/Avatar';
import GodBadge from '@/src/components/Shared/GodBadge';
import { TIER_COLORS } from '@/src/lib/theme';
import RankImage from '@/src/components/Images/RankImage/RankImage';

interface PodiumProps {
  entries: LeaderboardEntry[];
  onSelectPlayer: (discordId: string) => void;
  hideGod?: boolean;
}

const PODIUM_CONFIG = [
  { index: 1, borderColor: 'var(--silver)', glow: 'none', label: '2nd' },
  { index: 0, borderColor: 'var(--gold)', glow: '0 0 30px rgba(251,191,36,0.15)', label: '1st' },
  { index: 2, borderColor: 'var(--bronze)', glow: 'none', label: '3rd' },
];

const Podium: React.FC<PodiumProps> = ({ entries, onSelectPlayer, hideGod }) => {
  if (entries.length < 3) return null;

  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '1fr 1.1fr 1fr' }}>
      {PODIUM_CONFIG.map(({ index, borderColor, glow, label }) => {
        const entry = entries[index];
        const pointGainStr = entry.dailyPointGain >= 0 ? `+${entry.dailyPointGain}` : `${entry.dailyPointGain}`;
        const isCenter = index === 0;
        const tierDisplay = formatTier(entry.currentTier, entry.currentRank);
        return (
          <div
            key={entry.discordId}
            className={`flex flex-col items-center text-center p-5 rounded-[var(--radius-lg)] cursor-pointer transition-all duration-200 hover:-translate-y-1 bg-surface-1 ${isCenter ? 'pt-6 pb-6' : 'mt-4'}`}
            style={{
              border: `1px solid ${borderColor}`,
              boxShadow: glow,
            }}
            onClick={() => onSelectPlayer(entry.discordId)}
          >
            <span className="text-lg mb-2" style={{ color: borderColor }}>
              {label}
            </span>
            <Avatar
              src={entry.discordAvatarUrl}
              alt={entry.gameName}
              initials={entry.gameName.charAt(0).toUpperCase()}
              size="lg"
            />
            {!hideGod && entry.godSlug && (
              <div className="mt-2">
                <GodBadge slug={entry.godSlug} name={entry.godName} />
              </div>
            )}
            <p className="font-semibold text-text-primary mt-2 truncate max-w-full">
              {entry.gameName}
              <span className="text-text-muted font-normal">#{entry.tagLine}</span>
            </p>
            <div className="flex items-center gap-1 mt-1">
              <RankImage tier={entry.currentTier} size={20} />
              <span className="text-xs font-semibold" style={{ color: TIER_COLORS[entry.currentTier] || TIER_COLORS.UNRANKED }}>
                {tierDisplay}
              </span>
            </div>
            <p className="text-2xl font-bold mt-1 text-accent-cyan">
              {entry.scorePoints}
            </p>
            <span className={`text-xs mt-1 ${entry.dailyPointGain >= 0 ? 'text-phase-active' : 'text-[#f87171]'}`}>
              {pointGainStr} today
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default Podium;

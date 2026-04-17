import type { LeaderboardEntry } from '@/src/types/LeaderboardEntry';
import { formatTier } from '@/src/types/Rank';
import { PODIUM_COLORS, DEFAULT_RANK_COLOR, TIER_COLORS } from '@/src/lib/theme';
import Avatar from '@/src/components/Shared/Avatar';
import GodBadge from '@/src/components/Shared/GodBadge';
import RankImage from '@/src/components/Images/RankImage/RankImage';

interface UserBannerProps {
  entry: LeaderboardEntry;
  onClick?: () => void;
  style?: React.CSSProperties;
  hideGod?: boolean;
}

const UserBanner: React.FC<UserBannerProps> = ({ entry, onClick, style, hideGod }) => {
  const rankColor = PODIUM_COLORS[entry.rank] ?? DEFAULT_RANK_COLOR;
  const tierDisplay = formatTier(entry.currentTier, entry.currentRank);
  const pointGainStr = entry.dailyPointGain >= 0 ? `+${entry.dailyPointGain}` : `${entry.dailyPointGain}`;
  const initials = entry.gameName.charAt(0).toUpperCase();
  const chipClass = 'inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-2/70 px-2.5 py-1 text-[11px] text-text-secondary';
  const pointGainClass = entry.dailyPointGain >= 0 ? 'text-phase-active bg-phase-active/10' : 'text-[#f87171] bg-[#f87171]/10';

  return (
    <div
      className={`group relative rounded-[var(--radius-md)] border border-border-default bg-surface-1 px-3 py-3 transition-all duration-200 hover:translate-x-[3px] hover:border-border-bright hover:bg-surface-hover sm:px-4 sm:py-3 ${
        entry.isEliminatedFromGod ? 'opacity-60' : ''
      } ${onClick ? 'cursor-pointer' : ''}`}
      style={style}
      onClick={onClick}
    >
      <div className="absolute left-0 top-1/2 h-3/5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-nebula-purple to-nebula-pink opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="sm:hidden">
        <div className="flex items-start gap-3">
          <span className={`w-7 pt-1 text-center font-bold text-base ${rankColor}`}>
            {entry.rank}
          </span>

          <Avatar src={entry.discordAvatarUrl} alt={entry.discordUsername || entry.gameName} initials={initials} size="md" />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {entry.gameName}
                </p>
                <p className="truncate text-xs text-text-muted">
                  #{entry.tagLine}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-right text-base font-bold leading-none text-accent-cyan">
                  {entry.scorePoints}
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    pts
                  </span>
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${pointGainClass}`}>
                  {pointGainStr}
                </span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={chipClass}>
                <RankImage tier={entry.currentTier} size={16} />
                <span style={{ color: TIER_COLORS[entry.currentTier] || TIER_COLORS.UNRANKED }}>{tierDisplay}</span>
                <span className="opacity-50">&middot;</span>
                <span className="text-text-secondary">{entry.currentLP} LP</span>
              </span>
              {!hideGod && entry.godSlug && (
                <span className={chipClass}>
                  <GodBadge slug={entry.godSlug} name={entry.godName} size={16} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="hidden items-center gap-3 sm:grid"
        style={{ gridTemplateColumns: '32px 40px 1fr auto auto' }}
      >
        <span className={`text-center font-bold text-lg ${rankColor}`}>
          {entry.rank}
        </span>

        <Avatar src={entry.discordAvatarUrl} alt={entry.discordUsername || entry.gameName} initials={initials} size="md" />

        <div className="min-w-0 flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-text-primary">
              {entry.gameName}
              <span className="font-normal text-text-muted">#{entry.tagLine}</span>
            </p>
            {!hideGod && entry.godSlug && (
              <div className="flex items-center">
                <GodBadge slug={entry.godSlug} name={entry.godName} />
              </div>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <RankImage tier={entry.currentTier} size={20} />
              <span style={{ color: TIER_COLORS[entry.currentTier] || TIER_COLORS.UNRANKED }}>{tierDisplay}</span>
            </span>
            <span className="inline-block px-0.5 opacity-50">&middot;</span>
            <span>{entry.currentLP} LP</span>
          </p>
        </div>

        <span className="flex items-center gap-1 text-lg font-bold text-accent-cyan">
          {entry.scorePoints}
          <span className="text-xs font-semibold tracking-wide text-text-muted">
            pts
          </span>
        </span>

        <span className={`rounded-full px-3 py-1 text-sm font-bold ${pointGainClass}`}>
          {pointGainStr}
        </span>
      </div>
    </div>
  );
};

export default UserBanner;

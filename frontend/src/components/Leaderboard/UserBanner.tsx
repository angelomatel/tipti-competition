import type { LeaderboardEntry } from '@/src/types/LeaderboardEntry';
import { formatTier } from '@/src/types/Rank';
import { PODIUM_COLORS, DEFAULT_RANK_COLOR, TIER_COLORS } from '@/src/lib/theme';
import Avatar from '@/src/components/shared/Avatar';
import GodBadge from '@/src/components/shared/GodBadge';

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

  return (
    <div
      className={`group relative grid items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer transition-all duration-200 hover:translate-x-[3px] bg-surface-1 border border-border-default hover:bg-surface-hover hover:border-border-bright ${
        entry.isEliminatedFromGod ? 'opacity-60' : ''
      }`}
      style={{
        gridTemplateColumns: '32px 40px 1fr auto auto',
        ...style,
      }}
      onClick={onClick}
    >
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-nebula-purple to-nebula-pink" />

      <span className={`text-center font-bold text-lg ${rankColor}`}>
        {entry.rank}
      </span>

      <Avatar src={entry.discordAvatarUrl} alt={entry.discordUsername || entry.gameName} initials={initials} size="md" />

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-text-primary truncate">
            {entry.gameName}
            <span className="text-text-muted font-normal">#{entry.tagLine}</span>
          </p>
          {!hideGod && entry.godSlug && <GodBadge slug={entry.godSlug} name={entry.godName} />}
        </div>
        <p className="text-xs flex items-center gap-1 text-text-muted">
          <span style={{ color: TIER_COLORS[entry.currentTier] || TIER_COLORS.UNRANKED }}>{tierDisplay}</span>
          <span>&bull;</span>
          <span>{entry.currentLP} LP</span>
          <span>&bull;</span>
          <span>{entry.scorePoints} pts</span>
        </p>
      </div>

      <span className="text-xs font-medium hidden sm:block" style={{ color: TIER_COLORS[entry.currentTier] || TIER_COLORS.UNRANKED }}>
        {tierDisplay}
      </span>

      <span
        className={`px-3 py-1 rounded-full text-sm font-bold ${
          entry.dailyPointGain >= 0 ? 'text-phase-active bg-phase-active/10' : 'text-[#f87171] bg-[#f87171]/10'
        }`}
      >
        {pointGainStr}
      </span>
    </div>
  );
};

export default UserBanner;

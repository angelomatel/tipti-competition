import type { LeaderboardEntry } from '@/src/types/LeaderboardEntry';
import { formatTier } from '@/src/types/Rank';
import { PODIUM_COLORS, DEFAULT_RANK_COLOR, COLORS } from '@/src/lib/theme';
import RankImage from '@/src/components/images/RankImage/RankImage';
import Avatar from '@/src/components/Avatar/Avatar';
import GodBadge from '@/src/components/GodBadge/GodBadge';

interface UserBannerProps {
  entry: LeaderboardEntry;
  onClick?: () => void;
}

const UserBanner: React.FC<UserBannerProps> = ({ entry, onClick }) => {
  const rankColor = PODIUM_COLORS[entry.rank] ?? DEFAULT_RANK_COLOR;
  const tierDisplay = formatTier(entry.currentTier, entry.currentRank);
  const pointGainStr = entry.dailyPointGain >= 0 ? `+${entry.dailyPointGain}` : `${entry.dailyPointGain}`;
  const initials = entry.gameName.charAt(0).toUpperCase();

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 rounded-xl bg-[#0d0d2b] border border-violet-900/40 hover:border-violet-600/60 transition-colors cursor-pointer ${
        entry.isEliminatedFromGod ? 'opacity-60' : ''
      }`}
      onClick={onClick}
    >
      {/* Rank number */}
      <span className={`w-8 text-center font-bold text-lg ${rankColor}`}>
        {entry.rank}
      </span>

      {/* Discord avatar */}
      <Avatar
        src={entry.discordAvatarUrl}
        alt={entry.discordUsername || entry.gameName}
        initials={initials}
        size="md"
      />

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-white truncate">
            {entry.gameName}
            <span className="text-violet-400 font-normal">#{entry.tagLine}</span>
          </p>
          {entry.godSlug && (
            <GodBadge slug={entry.godSlug} name={entry.godName} size={16} showName={false} />
          )}
        </div>
        <p className="text-xs text-violet-300/70 flex items-center gap-1">
          <RankImage tier={entry.currentTier} size={16} />
          {tierDisplay} &bull; {entry.currentLP} LP &bull; {entry.scorePoints} pts
        </p>
      </div>

      {/* Point gain badge */}
      <span
        className={`px-3 py-1 rounded-full text-sm font-bold ${entry.dailyPointGain >= 0 ? 'bg-cyan-950/60' : 'bg-red-950/60 text-red-400'}`}
        style={entry.dailyPointGain >= 0 ? { color: COLORS.cyan } : undefined}
      >
        {pointGainStr} pts
      </span>
    </div>
  );
};

export default UserBanner;

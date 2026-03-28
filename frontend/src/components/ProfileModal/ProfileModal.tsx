'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/src/hooks/usePlayer';
import { formatTier } from '@/src/types/Rank';
import { COLORS } from '@/src/lib/theme';
import { MATCH_LINK_TACTICS_TOOLS, MATCH_LINK_METATFT } from '@/src/lib/constants';
import RankImage from '@/src/components/images/RankImage/RankImage';
import LPGraph from '@/src/components/LPGraph/LPGraph';
import Avatar from '@/src/components/Avatar/Avatar';
import GodBadge from '@/src/components/GodBadge/GodBadge';
import PointBreakdown from '@/src/components/PointBreakdown/PointBreakdown';

interface ProfileModalProps {
  discordId: string | null;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ discordId, onClose }) => {
  const { data, error, isLoading } = usePlayer(discordId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!discordId) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-lg mx-4 bg-[#0d0d2b] border border-violet-900/40 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-violet-400 hover:text-white transition-colors text-xl leading-none z-10"
        >
          &times;
        </button>

        {isLoading && (
          <div className="p-8">
            <div className="h-16 rounded-xl bg-violet-950/40 animate-pulse mb-4" />
            <div className="h-48 rounded-xl bg-violet-950/40 animate-pulse" />
          </div>
        )}

        {error && (
          <div className="p-8 text-center text-violet-400/70">
            Failed to load player data.
          </div>
        )}

        {data?.player && (
          <>
            {/* Header */}
            <div className="flex items-center gap-4 p-6 pb-4">
              <Avatar
                src={data.player.discordAvatarUrl}
                alt={data.player.discordUsername || data.player.gameName}
                initials={data.player.gameName.charAt(0).toUpperCase()}
                size="lg"
              />
              <div>
                <h2 className="text-lg font-bold text-white">
                  {data.player.gameName}
                  <span className="text-violet-400 font-normal">#{data.player.tagLine}</span>
                </h2>
                {data.player.discordUsername && (
                  <p className="text-xs text-violet-400/60">@{data.player.discordUsername}</p>
                )}
                {data.godSlug && (
                  <div className="mt-1">
                    <GodBadge slug={data.godSlug} name={data.godName} size={18} />
                    {data.godTitle && (
                      <span className="text-xs text-violet-400/50 ml-1">- {data.godTitle}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 px-6 pb-4">
              <div className="bg-violet-950/30 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <RankImage tier={data.player.currentTier} size={20} />
                  <span className="text-sm font-semibold text-white">
                    {formatTier(data.player.currentTier, data.player.currentRank)}
                  </span>
                </div>
                <p className="text-xs text-violet-400/60">Rank</p>
              </div>
              <div className="bg-violet-950/30 rounded-lg p-3 text-center">
                <p className="text-sm font-semibold" style={{ color: COLORS.cyan }}>{data.player.currentLP} LP</p>
                <p className="text-xs text-violet-400/60">League Points</p>
              </div>
              <div className="bg-violet-950/30 rounded-lg p-3 text-center">
                <p className="text-sm font-semibold text-white">
                  {data.player.currentWins}W {data.player.currentLosses}L
                </p>
                <p className="text-xs text-violet-400/60">Record</p>
              </div>
              <div className="bg-violet-950/30 rounded-lg p-3 text-center">
                <p className="text-sm font-semibold" style={{ color: COLORS.cyan }}>
                  {data.scorePoints ?? 0}
                </p>
                <p className="text-xs text-violet-400/60">Score Pts</p>
              </div>
            </div>

            {/* Score breakdown summary */}
            {data.pointBreakdown && (
              <div className="px-6 pb-3">
                <div className="flex gap-3 text-xs">
                  <span className="text-cyan-400/80">+{data.pointBreakdown.match} match</span>
                  {data.pointBreakdown.buff > 0 && (
                    <span className="text-green-400/80">+{data.pointBreakdown.buff} buff</span>
                  )}
                  {data.pointBreakdown.penalty < 0 && (
                    <span className="text-red-400/80">{data.pointBreakdown.penalty} penalty</span>
                  )}
                  {data.pointBreakdown.godPlacementBonus > 0 && (
                    <span className="text-yellow-400/80">+{data.pointBreakdown.godPlacementBonus} god bonus</span>
                  )}
                </div>
              </div>
            )}

            {/* LP Graph */}
            <div className="px-6 pb-4">
              <h3 className="text-sm font-semibold text-violet-300 mb-2">LP History</h3>
              <LPGraph matchPoints={data.matchPoints ?? []} />
            </div>

            {/* Point Breakdown */}
            {data.dailyPoints && data.dailyPoints.length > 0 && (
              <div className="px-6 pb-4">
                <h3 className="text-sm font-semibold text-violet-300 mb-2">Point History</h3>
                <PointBreakdown dailyPoints={data.dailyPoints} />
              </div>
            )}

            {/* Recent Matches with external links */}
            {data.matches && data.matches.length > 0 && (
              <div className="px-6 pb-6">
                <h3 className="text-sm font-semibold text-violet-300 mb-2">Recent Matches</h3>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {[...data.matches].reverse().slice(0, 10).map((match) => (
                    <div key={match.matchId} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-violet-950/20">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${match.placement <= 4 ? 'text-cyan-400' : 'text-red-400'}`}>
                          #{match.placement}
                        </span>
                        <span className="text-xs text-violet-400/60">
                          {new Date(match.playedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={MATCH_LINK_TACTICS_TOOLS(data.player.gameName, data.player.tagLine, match.matchId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
                        >
                          tactics.tools
                        </a>
                        <a
                          href={MATCH_LINK_METATFT(data.player.gameName, data.player.tagLine, match.matchId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
                        >
                          metatft
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;

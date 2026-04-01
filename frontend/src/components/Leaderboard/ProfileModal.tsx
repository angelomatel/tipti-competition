'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/src/hooks/usePlayer';
import { formatTier } from '@/src/types/Rank';
import { TIER_COLORS } from '@/src/lib/theme';
import { getGodColor } from '@/src/lib/godColors';
import RankImage from '@/src/components/Images/RankImage/RankImage';
import LPGraph from '@/src/components/Leaderboard/LPGraph';
import Avatar from '@/src/components/Shared/Avatar';
import PointBreakdown from '@/src/components/Leaderboard/PointBreakdown';
import { getGodSplash, getGodBannerOffset } from '@/src/lib/godData';

interface ProfileModalProps {
  discordId: string | null;
  onClose: () => void;
  hideGod?: boolean;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ discordId, onClose, hideGod }) => {
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

  const godColors = !hideGod && data ? getGodColor(data.godSlug) : getGodColor(null);

  return (
    <div
      className="fixed inset-0 z-[200]! flex items-end justify-center pb-0 sm:pb-4"
      style={{ backgroundColor: 'rgba(5,3,15,0.8)', backdropFilter: 'blur(12px)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full sm:max-w-[580px] overflow-hidden max-h-[90vh] overflow-y-auto rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] bg-surface-1 border border-border-bright"
        style={{ animation: 'modal-enter 0.3s ease' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-xl leading-none transition-colors text-text-muted hover:text-text-primary"
        >
          &times;
        </button>

        {isLoading && (
          <div className="p-8">
            <div
              className="h-[120px] animate-pulse rounded-t-[var(--radius-xl)]"
              style={{
                backgroundImage: `linear-gradient(135deg, ${godColors.primary}40, ${godColors.primary}10, var(--surface-1))`,
              }}
            />
            <div className="h-48 mt-4 animate-pulse bg-surface-0 rounded-[var(--radius-md)]" />
          </div>
        )}

        {error && (
          <div className="p-8 text-center text-text-muted">
            Failed to load player data.
          </div>
        )}

        {data?.player && (
          <>
            {/* God-colored art strip (hidden when pre-event) */}
            {!hideGod && (
              <div
                className="h-[120px]"
                style={{
                  backgroundImage: `
                    linear-gradient(135deg, ${godColors.primary}40, ${godColors.primary}10, var(--surface-1)),
                    url(${getGodSplash(data.godSlug, 'happy')})
                  `,
                  backgroundSize: 'cover, cover',
                  backgroundPosition: `center, right ${getGodBannerOffset(data.godSlug)}`,
                  backgroundRepeat: 'no-repeat, no-repeat',
                }}
              />
            )}

            {/* Avatar + name section */}
            <div className={`px-6 ${!hideGod ? '-mt-9' : 'pt-6'}`}>
              <div
                className="inline-block rounded-full p-[3px]"
                style={{ background: `linear-gradient(135deg, ${godColors.primary}, ${godColors.primary}60)` }}
              >
                <div className="rounded-full overflow-hidden bg-[#0a0618]">
                  <Avatar
                    src={data.player.discordAvatarUrl}
                    alt={data.player.discordUsername || data.player.gameName}
                    initials={data.player.gameName.charAt(0).toUpperCase()}
                    size="lg"
                  />
                </div>
              </div>

              <div className="mt-3">
                <h2 className="text-lg font-bold text-text-primary">
                  {data.player.gameName}
                  <span className="font-normal text-text-muted">#{data.player.tagLine}</span>
                </h2>
                {data.player.discordUsername && (
                  <p className="text-xs text-text-muted">@{data.player.discordUsername}</p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 px-6 py-4">
              {[
                {
                  label: 'Rank',
                  content: (
                    <div className="flex items-center justify-center gap-1">
                      <RankImage tier={data.player.currentTier} size={20} />
                      <span
                        className="text-sm font-semibold"
                        style={{ color: TIER_COLORS[data.player.currentTier] || TIER_COLORS.UNRANKED }}
                      >
                        {formatTier(data.player.currentTier, data.player.currentRank)}
                      </span>
                    </div>
                  ),
                },
                {
                  label: 'LP',
                  content: <span className="text-accent-cyan">{data.player.currentLP}</span>,
                },
                {
                  label: 'Record',
                  content: (
                    <span className="text-text-primary">
                      {data.player.currentWins}W {data.player.currentLosses}L
                    </span>
                  ),
                },
                {
                  label: 'Score',
                  content: <span className="text-accent-cyan">{data.scorePoints ?? 0}</span>,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[var(--radius-sm)] p-3 text-center bg-surface-0"
                >
                  <div className="text-sm font-semibold mb-1">{stat.content}</div>
                  <p className="text-[0.6rem] uppercase tracking-wider text-text-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Score breakdown */}
            {data.pointBreakdown && (
              <div className="px-6 pb-3">
                <div className="p-3 rounded-[var(--radius-sm)] flex flex-wrap gap-3 text-xs bg-surface-0">
                  <span className="text-accent-cyan">+{data.pointBreakdown.match} match</span>
                  {data.pointBreakdown.buff > 0 && (
                    <span className="text-phase-active">+{data.pointBreakdown.buff} buff</span>
                  )}
                  {data.pointBreakdown.penalty < 0 && (
                    <span className="text-[#f87171]">{data.pointBreakdown.penalty} penalty</span>
                  )}
                  {data.pointBreakdown.godPlacementBonus > 0 && (
                    <span className="text-gold">+{data.pointBreakdown.godPlacementBonus} god bonus</span>
                  )}
                </div>
              </div>
            )}

            {/* LP Graph */}
            <div className="px-6 pb-4">
              <h3 className="text-sm font-semibold mb-2 text-text-secondary">
                LP History
              </h3>
              <LPGraph matchPoints={data.matchPoints ?? []} />
            </div>

            {/* Point Breakdown */}
            {data.dailyPoints && data.dailyPoints.length > 0 && (
              <div className="px-6 pb-4">
                <h3 className="text-sm font-semibold mb-2 text-text-secondary">
                  Point History
                </h3>
                <PointBreakdown
                  dailyPoints={data.dailyPoints}
                  gameName={data.player.gameName}
                  tagLine={data.player.tagLine}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;

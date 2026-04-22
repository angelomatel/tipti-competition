'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlayer } from '@/src/hooks/usePlayer';
import { formatTier } from '@/src/types/Rank';
import { TIER_COLORS } from '@/src/lib/theme';
import { getGodColor } from '@/src/lib/godColors';
import Image from 'next/image';
import RankImage from '@/src/components/Images/RankImage/RankImage';
import LPGraph from '@/src/components/Leaderboard/LPGraph';
import Avatar from '@/src/components/Shared/Avatar';
import PointBreakdown from '@/src/components/Leaderboard/PointBreakdown';
import PollStateInfo, { formatRelativeTime } from '@/src/components/Leaderboard/PollStateInfo';
import { getGodSplash, getGodBannerOffset } from '@/src/lib/godData';

interface ProfileModalProps {
  discordId: string | null;
  onClose: () => void;
  hideGod?: boolean;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ discordId, onClose, hideGod }) => {
  const [matchLimit, setMatchLimit] = useState(20);
  const [lastDiscordId, setLastDiscordId] = useState(discordId);
  if (discordId !== lastDiscordId) {
    setLastDiscordId(discordId);
    setMatchLimit(20);
  }
  const { data: freshData, error, isLoading } = usePlayer(discordId, matchLimit);

  // Keep previous data only while the same player's limit is changing — not across player switches.
  const [staleData, setStaleData] = useState<{ discordId: string | null; data: typeof freshData }>(
    { discordId: null, data: undefined },
  );
  if (freshData && staleData.data !== freshData) {
    setStaleData({ discordId, data: freshData });
  }
  const data = freshData ?? (staleData.discordId === discordId ? staleData.data : undefined);

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

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(5,3,15,0.8)', backdropFilter: 'blur(12px)', animation: 'fade-in 0.3s ease' }}
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full sm:max-w-[580px] overflow-hidden max-h-[90vh] overflow-y-auto rounded-[var(--radius-xl)] bg-surface-1 border border-border-bright"
        style={{ animation: 'modal-enter 0.3s ease' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close profile"
          className="absolute top-4 right-4 z-[20] flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-text-muted transition-colors backdrop-blur-sm hover:text-text-primary"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M5 5L15 15" />
            <path d="M15 5L5 15" />
          </svg>
        </button>

        {!data && isLoading && (
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
              <div className="relative h-[120px] overflow-hidden">
                <Image
                  src={getGodSplash(data.godSlug, 'happy')}
                  alt={data.godSlug || 'god'}
                  fill
                  priority
                  sizes="580px"
                  className="object-cover opacity-90"
                  style={{
                    objectPosition: `center ${getGodBannerOffset(data.godSlug)}`,
                  }}
                />
                <div
                  className="absolute inset-0 z-10"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${godColors.primary}60, ${godColors.primary}20, var(--surface-1))`,
                  }}
                />
              </div>
            )}

            {/* Avatar + name section */}
            <div className={`relative z-[20] px-6 ${!hideGod ? '-mt-9' : 'pt-6'}`}>
              <div
                className="relative z-[20] inline-block rounded-full p-[3px]"
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
                <div className="flex items-center justify-between">
                  {data.player.discordUsername ? (
                    <p className="text-xs text-text-muted">@{data.player.discordUsername}</p>
                  ) : (
                    <span />
                  )}
                  {data.snapshots && data.snapshots.length > 0 && (() => {
                    const latest = data.snapshots.reduce((a, b) =>
                      new Date(a.capturedAt) > new Date(b.capturedAt) ? a : b
                    );
                    const date = new Date(latest.capturedAt);
                    return (
                      <div className="flex items-center gap-1">
                        <p className="text-[0.65rem] text-text-muted" title={date.toLocaleString()}>
                          Updated {formatRelativeTime(date)}
                        </p>
                        <PollStateInfo pollState={data.pollState ?? null} />
                      </div>
                    );
                  })()}
                </div>
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
              <LPGraph matchPoints={data.matchPoints ?? []} matchLimit={matchLimit} onRangeChange={setMatchLimit} />
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

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
};

export default ProfileModal;

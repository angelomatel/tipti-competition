'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/src/hooks/usePlayer';
import { formatTier } from '@/src/types/Rank';
import { COLORS } from '@/src/lib/theme';
import RankImage from '@/src/components/images/RankImage/RankImage';
import LPGraph from '@/src/components/LPGraph/LPGraph';
import Avatar from '@/src/components/Avatar/Avatar';

interface ProfileModalProps {
  discordId: string | null;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ discordId, onClose }) => {
  const { data, error, isLoading } = usePlayer(discordId);

  // Close on Escape key
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
      <div className="relative w-full max-w-lg mx-4 bg-[#0d0d2b] border border-violet-900/40 rounded-2xl overflow-hidden">
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
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 px-6 pb-4">
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
            </div>

            {/* LP Graph */}
            <div className="px-6 pb-6">
              <h3 className="text-sm font-semibold text-violet-300 mb-2">LP History</h3>
              <LPGraph matchPoints={data.matchPoints ?? []} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;

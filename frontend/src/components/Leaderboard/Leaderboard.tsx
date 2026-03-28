'use client';

import { useState } from 'react';
import { useLeaderboard } from '@/src/hooks/useLeaderboard';
import UserBanner from '@/src/components/UserBanner/UserBanner';
import ProfileModal from '@/src/components/ProfileModal/ProfileModal';
import LeaderboardSkeleton from '@/src/components/LeaderboardSkeleton/LeaderboardSkeleton';

const Leaderboard = () => {
  const { data, error, isLoading } = useLeaderboard();
  const [selectedDiscordId, setSelectedDiscordId] = useState<string | null>(null);

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (error || !data) {
    return (
      <p className="text-center text-violet-400/70 py-12">
        Could not load leaderboard. Make sure the backend is running.
      </p>
    );
  }

  if (!data.entries || data.entries.length === 0) {
    return (
      <p className="text-center text-violet-400/70 py-12">
        No players registered yet. Use <code className="text-cyan-400">/link</code> in Discord to join.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {data.entries.map((entry) => (
          <UserBanner
            key={entry.discordId}
            entry={entry}
            onClick={() => setSelectedDiscordId(entry.discordId)}
          />
        ))}

        {/* Footer with last updated */}
        <p className="text-center text-xs text-violet-500/50 pt-2">
          Last updated: {new Date(data.updatedAt).toLocaleTimeString()}
        </p>
      </div>

      <ProfileModal
        discordId={selectedDiscordId}
        onClose={() => setSelectedDiscordId(null)}
      />
    </>
  );
};

export default Leaderboard;

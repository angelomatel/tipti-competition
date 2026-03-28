'use client';

import { useState } from 'react';
import { useLeaderboard } from '@/src/hooks/useLeaderboard';
import UserBanner from '@/src/components/UserBanner/UserBanner';
import ProfileModal from '@/src/components/ProfileModal/ProfileModal';
import GodStandings from '@/src/components/GodStandings/GodStandings';
import GodLeaderboard from '@/src/components/GodLeaderboard/GodLeaderboard';
import LeaderboardSkeleton from '@/src/components/LeaderboardSkeleton/LeaderboardSkeleton';

type Tab = 'players' | 'gods';

const Leaderboard = () => {
  const { data, error, isLoading } = useLeaderboard();
  const [selectedDiscordId, setSelectedDiscordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('players');
  const [selectedGodSlug, setSelectedGodSlug] = useState<string | null>(null);

  return (
    <>
      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'players'
              ? 'bg-violet-700 text-white'
              : 'bg-violet-950/40 text-violet-400 hover:bg-violet-950/60'
          }`}
          onClick={() => { setActiveTab('players'); setSelectedGodSlug(null); }}
        >
          Players
        </button>
        <button
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'gods'
              ? 'bg-violet-700 text-white'
              : 'bg-violet-950/40 text-violet-400 hover:bg-violet-950/60'
          }`}
          onClick={() => { setActiveTab('gods'); setSelectedGodSlug(null); }}
        >
          Gods
        </button>
      </div>

      {activeTab === 'gods' ? (
        selectedGodSlug ? (
          <GodLeaderboard slug={selectedGodSlug} onBack={() => setSelectedGodSlug(null)} />
        ) : (
          <GodStandings onSelectGod={setSelectedGodSlug} />
        )
      ) : (
        <>
          {isLoading && <LeaderboardSkeleton />}

          {!isLoading && (error || !data) && (
            <p className="text-center text-violet-400/70 py-12">
              Could not load leaderboard. Make sure the backend is running.
            </p>
          )}

          {!isLoading && data && (!data.entries || data.entries.length === 0) && (
            <p className="text-center text-violet-400/70 py-12">
              No players registered yet. Use <code className="text-cyan-400">/register</code> in Discord to join.
            </p>
          )}

          {!isLoading && data?.entries && data.entries.length > 0 && (
            <div className="flex flex-col gap-3">
              {data.entries.map((entry) => (
                <UserBanner
                  key={entry.discordId}
                  entry={entry}
                  onClick={() => setSelectedDiscordId(entry.discordId)}
                />
              ))}

              <p className="text-center text-xs text-violet-500/50 pt-2">
                Last updated: {new Date(data.updatedAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </>
      )}

      <ProfileModal
        discordId={selectedDiscordId}
        onClose={() => setSelectedDiscordId(null)}
      />
    </>
  );
};

export default Leaderboard;

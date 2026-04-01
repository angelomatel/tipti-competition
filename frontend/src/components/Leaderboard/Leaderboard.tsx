'use client';

import { useState } from 'react';
import { useLeaderboard } from '@/src/hooks/useLeaderboard';
import { useTournament } from '@/src/hooks/useTournament';
import { isEventStarted } from '@/src/lib/tournament';
import UserBanner from '@/src/components/Leaderboard/UserBanner';
import ProfileModal from '@/src/components/Leaderboard/ProfileModal';
import GodStandings from '@/src/components/Gods/GodStandings';
import GodLeaderboard from '@/src/components/Gods/GodLeaderboard';
import LeaderboardSkeleton from '@/src/components/Leaderboard/LeaderboardSkeleton';
import Podium from '@/src/components/Leaderboard/Podium';

type Tab = 'players' | 'gods';

const PLAYERS_PER_PAGE = 10;

interface LeaderboardProps {
  tab?: Tab;
}

const Leaderboard = ({ tab = 'players' }: LeaderboardProps) => {
  const { data: tournamentData } = useTournament();
  const started = isEventStarted(tournamentData?.settings);

  const [selectedDiscordId, setSelectedDiscordId] = useState<string | null>(null);
  const [selectedGodSlug, setSelectedGodSlug] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { data, error, isLoading } = useLeaderboard({ page: currentPage, pageSize: PLAYERS_PER_PAGE });

  const entries = data?.entries ?? [];
  const podiumEntries = data?.podiumEntries ?? [];
  const totalEntries = data?.totalEntries ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const effectivePage = data?.page ?? currentPage;

  // Backend only returns podium entries on page 1 when event has started.
  const showPodium = started && podiumEntries.length >= 3;

  return (
    <>
      {tab === 'gods' ? (
        selectedGodSlug ? (
          <GodLeaderboard
            slug={selectedGodSlug}
            onBack={() => setSelectedGodSlug(null)}
            onSelectPlayer={setSelectedDiscordId}
          />
        ) : (
          <GodStandings onSelectGod={setSelectedGodSlug} />
        )
      ) : (
        <>
          {isLoading && <LeaderboardSkeleton />}

          {!isLoading && (error || !data) && (
            <p className="text-center py-12 text-text-muted">
              Could not load leaderboard. Make sure the backend is running.
            </p>
          )}

          {!isLoading && data && totalEntries === 0 && (
            <p className="text-center py-12 text-text-muted">
              No players registered yet. Use <code className="text-accent-cyan">/register</code> in Discord to join.
            </p>
          )}

          {!isLoading && totalEntries > 0 && (
            <div className="flex flex-col gap-1.5 sm:gap-3">
              {/* Podium: only when event started, page 1, desktop */}
              {showPodium && (
                <div className="hidden sm:block">
                  <Podium entries={podiumEntries} onSelectPlayer={setSelectedDiscordId} hideGod={!started} />
                </div>
              )}

              {/* On mobile when podium would show, render top 3 as regular rows */}
              {showPodium && podiumEntries.map((entry, i) => (
                <div key={entry.discordId} className="sm:hidden">
                  <UserBanner
                    entry={entry}
                    onClick={() => setSelectedDiscordId(entry.discordId)}
                    hideGod={!started}
                    style={{ animation: `fade-up 0.3s ease both`, animationDelay: `${i * 50}ms` }}
                  />
                </div>
              ))}

              {entries.map((entry, i) => (
                <UserBanner
                  key={entry.discordId}
                  entry={entry}
                  onClick={() => setSelectedDiscordId(entry.discordId)}
                  hideGod={!started}
                  style={{ animation: `fade-up 0.3s ease both`, animationDelay: `${i * 50}ms` }}
                />
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, effectivePage - 1))}
                    disabled={effectivePage === 1}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-30 bg-surface-1 border border-border-default text-text-secondary"
                  >
                    &larr; Prev
                  </button>
                  <span className="text-sm text-text-muted">
                    Page {effectivePage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, effectivePage + 1))}
                    disabled={effectivePage === totalPages}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-30 bg-surface-1 border border-border-default text-text-secondary"
                  >
                    Next &rarr;
                  </button>
                </div>
              )}

              <p className="text-center text-xs pt-2 text-text-muted opacity-50">
                Last updated: {new Date(data!.updatedAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </>
      )}

      <ProfileModal
        discordId={selectedDiscordId}
        onClose={() => setSelectedDiscordId(null)}
        hideGod={!started}
      />
    </>
  );
};

export default Leaderboard;

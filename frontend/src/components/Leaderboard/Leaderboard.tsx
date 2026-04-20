'use client';

import { useEffect, useState } from 'react';
import { useLeaderboard } from '@/src/hooks/useLeaderboard';
import { useTournament } from '@/src/hooks/useTournament';
import { isEventStarted } from '@/src/lib/tournament';
import UserBanner from '@/src/components/Leaderboard/UserBanner';
import ProfileModal from '@/src/components/Leaderboard/ProfileModal';
import LeaderboardSkeleton from '@/src/components/Leaderboard/LeaderboardSkeleton';
import Podium from '@/src/components/Leaderboard/Podium';
import LeaderboardSearch from '@/src/components/Leaderboard/LeaderboardSearch';

const PLAYERS_PER_PAGE = 10;

const Leaderboard = () => {
  const { data: tournamentData, isLoading: isTournamentLoading } = useTournament();
  const started = isEventStarted(tournamentData?.settings);

  const [selectedDiscordId, setSelectedDiscordId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [openEllipsis, setOpenEllipsis] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const isSearchActive = debouncedSearch.length > 0;
  const hasSearchQuery = searchTerm.trim().length > 0 || isSearchActive;

  const {
    data,
    error,
    isLoading: isLeaderboardLoading,
  } = useLeaderboard({
    page: currentPage, 
    pageSize: PLAYERS_PER_PAGE,
    search: debouncedSearch,
    shouldFetch: true
  });

  const isInitialLoading = isTournamentLoading || (!data && isLeaderboardLoading);

  const entries = data?.entries ?? [];
  const podiumEntries = data?.podiumEntries ?? [];
  const totalEntries = data?.totalEntries ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const effectivePage = data?.page ?? currentPage;
  const showLeaderboardContent = totalEntries > 0 || hasSearchQuery;
  const showPagination = totalPages > 1 && !hasSearchQuery;

  // Backend only returns podium entries on page 1 when event has started.
  const showPodium = started && !hasSearchQuery && podiumEntries.length >= 3;

  type PageItem = { kind: 'page'; value: number } | { kind: 'ellipsis'; side: 'left' | 'right'; range: number[] };

  const getPageItems = (): PageItem[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => ({ kind: 'page', value: i + 1 }));
    }
    const items: PageItem[] = [{ kind: 'page', value: 1 }];
    if (effectivePage > 3) {
      items.push({ kind: 'ellipsis', side: 'left', range: Array.from({ length: effectivePage - 3 }, (_, i) => i + 2) });
    }
    for (let p = Math.max(2, effectivePage - 1); p <= Math.min(totalPages - 1, effectivePage + 1); p++) {
      items.push({ kind: 'page', value: p });
    }
    if (effectivePage < totalPages - 2) {
      items.push({ kind: 'ellipsis', side: 'right', range: Array.from({ length: totalPages - effectivePage - 2 }, (_, i) => effectivePage + 2 + i) });
    }
    items.push({ kind: 'page', value: totalPages });
    return items;
  };

  const renderPaginationControls = (showPageNumbers = false) => {
    if (!showPagination) {
      return null;
    }

    const pageItems = showPageNumbers ? getPageItems() : [];

    return (
      <>
        {!isMobileSearchOpen && (
          <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
            <button
              onClick={() => setCurrentPage(Math.max(1, effectivePage - 1))}
              disabled={effectivePage === 1}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-surface-1 text-sm text-text-secondary transition-all disabled:opacity-30"
              aria-label="Previous page"
            >
              &larr;
            </button>
            {showPageNumbers ? (
              <select
                value={effectivePage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                className="h-9 rounded-full border border-border-default bg-surface-1 px-2 text-[11px] text-text-muted focus:outline-none cursor-pointer"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>Page {p}</option>
                ))}
              </select>
            ) : (
              <span className="min-w-[52px] text-center text-[11px] text-text-muted">
                {effectivePage}/{totalPages}
              </span>
            )}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, effectivePage + 1))}
              disabled={effectivePage === totalPages}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-surface-1 text-sm text-text-secondary transition-all disabled:opacity-30"
              aria-label="Next page"
            >
              &rarr;
            </button>
          </div>
        )}

        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <button
            onClick={() => setCurrentPage(Math.max(1, effectivePage - 1))}
            disabled={effectivePage === 1}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-surface-1 border border-border-default text-text-secondary hover:border-border-bright hover:text-text-primary"
          >
            &larr; Prev
          </button>
          {showPageNumbers ? (
            pageItems.map((item, i) => {
              if (item.kind === 'page') {
                const isActive = item.value === effectivePage;
                return (
                  <button
                    key={item.value}
                    onClick={() => setCurrentPage(item.value)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all border bg-surface-1 text-text-secondary cursor-pointer hover:text-text-primary hover:border-border-bright"
                    style={isActive ? {
                      borderColor: 'rgba(167, 139, 250, 0.6)',
                      color: '#c4b5fd',
                      boxShadow: '0 0 8px rgba(167, 139, 250, 0.35)',
                    } : {
                      borderColor: 'var(--border)',
                    }}
                  >
                    {item.value}
                  </button>
                );
              }
              return (
                <div key={`ellipsis-${i}`} className="relative">
                  <button
                    onClick={() => setOpenEllipsis(openEllipsis === item.side ? null : item.side)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm text-text-muted border border-border-default bg-surface-1 hover:border-border-bright transition-all"
                  >
                    …
                  </button>
                  {openEllipsis === item.side && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenEllipsis(null)} />
                      <div
                        className="absolute z-20 bottom-full mb-2 left-1/2 -translate-x-1/2 rounded-xl border border-border-default bg-surface-0 py-1 shadow-xl"
                        style={{ minWidth: '80px', maxHeight: '200px', overflowY: 'auto' }}
                      >
                        {item.range.map((p) => (
                          <button
                            key={p}
                            onClick={() => { setCurrentPage(p); setOpenEllipsis(null); }}
                            className="block w-full px-4 py-1.5 text-center text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          ) : (
            <span className="min-w-[96px] text-center text-sm text-text-muted">
              Page {effectivePage} of {totalPages}
            </span>
          )}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, effectivePage + 1))}
            disabled={effectivePage === totalPages}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-surface-1 border border-border-default text-text-secondary hover:border-border-bright hover:text-text-primary"
          >
            Next &rarr;
          </button>
        </div>
      </>
    );
  };

  return (
    <>
      {isInitialLoading && <LeaderboardSkeleton />}

      {!isInitialLoading && (error || !data) && (
        <p className="text-center py-12 text-text-muted">
          Could not load leaderboard. Make sure the backend is running.
        </p>
      )}

      {!isInitialLoading && data && totalEntries === 0 && !hasSearchQuery && (
        <p className="text-center py-12 text-text-muted">
          No players registered yet. Use <code className="text-accent-cyan">/register</code> in Discord to join.
        </p>
      )}

      {!isInitialLoading && data && showLeaderboardContent && (
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

          <div className="mb-1.5 flex items-start justify-between gap-2 sm:mb-2 sm:gap-3">
            <LeaderboardSearch
              className="min-w-0 flex-1"
              value={searchTerm}
              debouncedValue={debouncedSearch}
              onChange={setSearchTerm}
              isMobileExpanded={isMobileSearchOpen}
              onMobileExpandedChange={setIsMobileSearchOpen}
            />

            {renderPaginationControls()}
          </div>
          {totalEntries === 0 && isSearchActive ? (
            <p className="text-center py-12 text-text-muted">
              No players found for <span className="text-text-primary">{debouncedSearch}</span>.
            </p>
          ) : (
            <>
              {entries.map((entry, i) => (
                <UserBanner
                  key={entry.discordId}
                  entry={entry}
                  onClick={() => setSelectedDiscordId(entry.discordId)}
                  hideGod={!started}
                  style={{ animation: `fade-up 0.3s ease both`, animationDelay: `${i * 50}ms` }}
                />
              ))}

              <p className="pt-2 text-center text-xs text-text-muted opacity-50">
                Last updated: {new Date(data.updatedAt).toLocaleTimeString()}
              </p>

              {showPagination && (
                <div className="flex items-center justify-center pt-2 sm:pt-3">
                  {renderPaginationControls(true)}
                </div>
              )}
            </>
          )}
        </div>
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

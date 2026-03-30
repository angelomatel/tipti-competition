'use client';

import { useLeaderboard } from '@/src/hooks/useLeaderboard';
import { useGods } from '@/src/hooks/useGods';
import { useTournament } from '@/src/hooks/useTournament';
import { isEventStarted, getDayNumber, getDaysUntilStart } from '@/src/lib/tournament';

const StatsBar = () => {
  const { data: leaderboardData } = useLeaderboard({ page: 1, pageSize: 1 });
  const { data: godsData } = useGods();
  const { data: tournamentData } = useTournament();

  const settings = tournamentData?.settings;
  const started = isEventStarted(settings);
  const playerCount = leaderboardData?.totalEntries ?? null;

  type Stat = { label: string; value: string; highlight: boolean };
  let stats: Stat[];

  if (started && settings) {
    const livingGods = godsData?.standings?.filter((g) => !g.isEliminated).length ?? null;
    const dayNumber = settings.startDate ? getDayNumber(settings.startDate) : null;

    stats = [
      { label: 'Players', value: playerCount !== null ? String(playerCount) : '—', highlight: false },
      { label: 'Living Gods', value: livingGods !== null ? String(livingGods) : '—', highlight: false },
      { label: `Day ${dayNumber ?? '—'} of 14`, value: '', highlight: true },
      { label: `Phase ${settings.currentPhase} of 3`, value: '', highlight: false },
    ];
  } else {
    const daysUntil = settings?.startDate ? getDaysUntilStart(settings.startDate) : null;

    stats = [
      { label: 'Players', value: playerCount !== null ? String(playerCount) : '—', highlight: false },
      { label: 'Days until Start', value: daysUntil !== null ? String(daysUntil) : '—', highlight: true },
    ];
  }

  return (
    <div className="flex justify-center mb-10">
      <div
        className="inline-flex items-center divide-x divide-border-default rounded-full px-2 bg-surface-1 border border-border-default"
      >
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col items-center px-5 py-2">
            <span className="uppercase tracking-wider text-text-muted text-[0.6rem]">
              {stat.label}
            </span>
            {stat.value && (
              <span
                className={`font-semibold text-base leading-tight ${stat.highlight ? 'text-gold' : 'text-text-primary'}`}
              >
                {stat.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsBar;

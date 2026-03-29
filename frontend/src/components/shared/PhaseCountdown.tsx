'use client';

import type { TournamentSettings } from '@/src/types/Tournament';
import LiveDot from '@/src/components/shared/LiveDot';

interface PhaseCountdownProps {
  settings: TournamentSettings;
}

function getTimeBreakdown(targetDate: string) {
  const diff = new Date(targetDate).getTime() - Date.now();
  const absDiff = Math.abs(diff);
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes, isPast: diff < 0 };
}

const PhaseCountdown: React.FC<PhaseCountdownProps> = ({ settings }) => {
  const { days: daysLeft, hours, minutes } = getTimeBreakdown(settings.endDate);
  const startTs = new Date(settings.startDate).getTime();

  const formatStatus = (label: string, targetDate: string) => {
    const { days, hours, isPast } = getTimeBreakdown(targetDate);
    const timeStr = days === 0 && hours === 0 ? 'just now' : `${days}d ${hours}h ${isPast ? 'ago' : ''}`;
    return isPast ? `${label}ed ${timeStr}` : `${label}s in ${timeStr}`;
  };

  const phaseDates = [
    { p: 1, s: settings.startDate, e: new Date(startTs + 5 * 86400000).toISOString() },
    { p: 2, s: new Date(startTs + 5 * 86400000).toISOString(), e: new Date(startTs + 10 * 86400000).toISOString() },
    { p: 3, s: new Date(startTs + 10 * 86400000).toISOString(), e: settings.endDate },
  ];

  return (
    <div className="group relative flex items-center gap-3">
      <span className="flex items-center gap-1.5 font-medium text-text-secondary">
        <LiveDot /> Phase {settings.currentPhase}
      </span>
      <span className="font-medium text-text-muted">{daysLeft}d left</span>

      <div className="pointer-events-none absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
        <div className="rounded-lg px-3 py-2 text-xs whitespace-nowrap bg-surface-0 border border-border-bright shadow-lg min-w-[180px]">
          <div className="mb-2 border-b border-border-bright pb-1">
            <p className="font-semibold text-text-primary mb-1">Tournament End</p>
            <p className="text-text-secondary">{daysLeft}d {hours}h {minutes}m left</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-text-primary border-b border-border-bright pb-1">Phases</p>
            {phaseDates.map(({ p, s, e }) => (
              <div key={p} className="flex flex-col gap-0.5">
                <p className={`font-medium ${p === settings.currentPhase ? 'text-primary' : 'text-text-secondary'}`}>
                  Phase {p} {p === settings.currentPhase && '(Current)'}
                </p>
                <div className="pl-2 border-l border-border-bright text-[10px] text-text-muted">
                  <p>{formatStatus('Start', s)}</p>
                  <p>{formatStatus('End', e)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhaseCountdown;

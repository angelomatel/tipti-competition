'use client';

import type { TournamentSettings } from '@/src/types/Tournament';
import LiveDot from '@/src/components/shared/LiveDot';

interface PhaseCountdownProps {
  settings: TournamentSettings;
}

function getTimeBreakdown(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0 };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes };
}

const PhaseCountdown: React.FC<PhaseCountdownProps> = ({ settings }) => {
  const { days, hours, minutes } = getTimeBreakdown(settings.endDate);

  return (
    <div className="group relative flex items-center gap-3">
      <span className="flex items-center gap-1.5 font-medium text-text-secondary">
        <LiveDot />
        Phase {settings.currentPhase}
      </span>
      <span className="font-medium text-text-muted">
        {days}d left
      </span>

      {/* Tooltip */}
      <div className="pointer-events-none absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
        <div className="rounded-lg px-3 py-2 text-xs whitespace-nowrap bg-surface-0 border border-border-bright shadow-lg">
          <p className="font-semibold text-text-primary mb-1">Time Remaining</p>
          <p className="text-text-secondary">
            {days}d {hours}h {minutes}m
          </p>
        </div>
      </div>
    </div>
  );
};

export default PhaseCountdown;

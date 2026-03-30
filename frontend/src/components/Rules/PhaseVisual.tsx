'use client';

import { useTournament } from '@/src/hooks/useTournament';

const PHASE_INFO = [
  { phase: 1, title: 'Phase 1', subtitle: 'Day 1–5', detail: 'Bottom 3 gods eliminated. Buffs inactive.' },
  { phase: 2, title: 'Phase 2', subtitle: 'Day 6–10', detail: 'Bottom 3 gods eliminated. Buffs activate.' },
  { phase: 3, title: 'Phase 3', subtitle: 'Day 11–14', detail: 'Finals. Top 3 gods compete for placement bonus.' },
];

const PhaseVisual = () => {
  const { data } = useTournament();
  const settings = data?.settings;
  const currentPhase = settings?.currentPhase ?? 1;
  const isStarted = settings ? new Date(settings.startDate) <= new Date() : false;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PHASE_INFO.map(({ phase, title, subtitle, detail }) => {
          const isDone = isStarted && phase < currentPhase;
          const isActive = isStarted && phase === currentPhase;

          return (
            <div
              key={phase}
              className="p-4 rounded-[var(--radius-md)] relative"
              style={{
                background: isActive ? 'var(--surface-0)' : 'var(--surface-1)',
                border: `1px solid ${isActive ? 'var(--gold)' : isDone ? 'var(--nebula-purple)' : 'var(--border)'}`,
                opacity: isStarted && !isDone && !isActive ? 0.5 : 1,
              }}
            >
              {isActive && (
                <span
                  className="absolute top-3 right-3 inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--gold)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--phase-active)', animation: 'live-dot-pulse 2s ease-in-out infinite' }} />
                  Active
                </span>
              )}
              {isDone && (
                <span
                  className="absolute top-3 right-3 text-[0.6rem] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--nebula-purple)' }}
                >
                  Complete
                </span>
              )}
              <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h4>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {detail}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
        God score = average of top N players&apos; scores, where N = clamp(floor(playerCount/3), 2, 5)
      </p>
    </div>
  );
};

export default PhaseVisual;

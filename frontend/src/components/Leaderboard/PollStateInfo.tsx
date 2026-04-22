'use client';

import { useEffect, useRef, useState } from 'react';

export function formatRelativeTime(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / 1440)}d ago`;
}

interface PollStateInfoProps {
  pollState: { lastRankPollAt: string | null; lastMatchPollAt: string | null } | null;
}

const Row: React.FC<{ label: string; value: string | null }> = ({ label, value }) => {
  const date = value ? new Date(value) : null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span
        className="text-text-primary tabular-nums"
        title={date ? date.toLocaleString() : undefined}
      >
        {date ? formatRelativeTime(date) : '—'}
      </span>
    </div>
  );
};

const PollStateInfo: React.FC<PollStateInfoProps> = ({ pollState }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointer);
    return () => document.removeEventListener('pointerdown', handlePointer);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative group inline-flex">
      <button
        type="button"
        aria-label="Show poll details"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border-bright text-[0.55rem] text-text-muted transition-colors hover:border-text-muted hover:text-text-primary"
      >
        i
      </button>
      <div
        role="tooltip"
        className={`absolute right-0 bottom-full z-[30] mb-1 w-[180px] rounded-[var(--radius-md)] border border-border-bright bg-surface-2 p-2 text-[0.65rem] shadow-lg transition-opacity ${
          open
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
        }`}
      >
        {pollState ? (
          <div className="flex flex-col gap-1">
            <Row label="Last rank poll" value={pollState.lastRankPollAt} />
            <Row label="Last match poll" value={pollState.lastMatchPollAt} />
          </div>
        ) : (
          <span className="text-text-muted">No poll data yet.</span>
        )}
      </div>
    </div>
  );
};

export default PollStateInfo;

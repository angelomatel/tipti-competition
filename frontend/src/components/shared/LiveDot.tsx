'use client';

const LiveDot = () => (
  <span
    className="inline-block w-2 h-2 rounded-full"
    style={{
      backgroundColor: 'var(--phase-active)',
      animation: 'live-dot-pulse 2s ease-in-out infinite',
    }}
  />
);

export default LiveDot;

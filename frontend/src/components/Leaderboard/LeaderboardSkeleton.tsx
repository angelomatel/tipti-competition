import { LEADERBOARD_SKELETON_COUNT } from '@/src/lib/constants';

const LeaderboardSkeleton = () => (
  <div className="flex flex-col gap-3">
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '1fr 1.1fr 1fr' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`rounded-[var(--radius-lg)] animate-pulse ${i === 1 ? 'h-56' : 'h-48 mt-4'}`}
          style={{ background: 'var(--surface-1)' }}
        />
      ))}
    </div>
    {Array.from({ length: LEADERBOARD_SKELETON_COUNT }).map((_, i) => (
      <div key={i} className="h-16 rounded-[var(--radius-md)] animate-pulse" style={{ background: 'var(--surface-1)' }} />
    ))}
  </div>
);

export default LeaderboardSkeleton;

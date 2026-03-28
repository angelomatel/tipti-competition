import { LEADERBOARD_SKELETON_COUNT } from '@/src/lib/constants';

const LeaderboardSkeleton = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: LEADERBOARD_SKELETON_COUNT }).map((_, i) => (
      <div key={i} className="h-20 rounded-xl bg-[#0d0d2b] border border-violet-900/40 animate-pulse" />
    ))}
  </div>
);

export default LeaderboardSkeleton;

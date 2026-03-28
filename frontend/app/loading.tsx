import LeaderboardSkeleton from '@/src/components/LeaderboardSkeleton/LeaderboardSkeleton';

export default function Loading() {
  return (
    <div className="relative z-10 max-w-4xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-12">
        <div className="h-12 w-64 mx-auto rounded-lg bg-violet-900/30 animate-pulse mb-3" />
        <div className="h-4 w-48 mx-auto rounded bg-violet-900/20 animate-pulse" />
      </div>
      <LeaderboardSkeleton />
    </div>
  );
}

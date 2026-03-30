'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Leaderboard from '@/src/components/Leaderboard/Leaderboard';

function LeaderboardPageInner() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as 'players' | 'gods') || 'players';
  return <Leaderboard tab={tab} />;
}

export default function LeaderboardPage() {
  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pt-24 pb-16">
      <Suspense>
        <LeaderboardPageInner />
      </Suspense>
    </main>
  );
}

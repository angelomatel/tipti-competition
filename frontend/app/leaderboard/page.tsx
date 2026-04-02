import type { Metadata } from 'next';
import { Suspense } from 'react';
import Leaderboard from '@/src/components/Leaderboard/Leaderboard';

export const metadata: Metadata = {
  title: 'Leaderboard',
};

export default function LeaderboardPage() {
  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pt-12 pb-8">
      <Suspense>
        <Leaderboard />
      </Suspense>
    </main>
  );
}

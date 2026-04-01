'use client';

import { useRouter } from 'next/navigation';
import GodStandings from '@/src/components/Gods/GodStandings';

export default function GodsLeaderboardPage() {
  const router = useRouter();

  const handleSelectGod = (slug: string) => {
    router.push(`/leaderboard/gods/${slug}`);
  };

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pt-12 pb-8">
      <GodStandings onSelectGod={handleSelectGod} />
    </main>
  );
}

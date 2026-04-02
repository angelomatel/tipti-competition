'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GodLeaderboard from '@/src/components/Gods/GodLeaderboard';
import ProfileModal from '@/src/components/Leaderboard/ProfileModal';
import { useTournament } from '@/src/hooks/useTournament';
import { isEventStarted } from '@/src/lib/tournament';

export default function GodSlugPageClient({ slug }: { slug: string }) {
  const router = useRouter();
  const { data: tournamentData } = useTournament();
  const started = isEventStarted(tournamentData?.settings);

  const [selectedDiscordId, setSelectedDiscordId] = useState<string | null>(null);

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pt-12 pb-8">
      <GodLeaderboard
        slug={slug}
        onBack={() => router.push('/leaderboard/gods')}
        onSelectPlayer={setSelectedDiscordId}
      />

      <ProfileModal
        discordId={selectedDiscordId}
        onClose={() => setSelectedDiscordId(null)}
        hideGod={!started}
      />
    </main>
  );
}

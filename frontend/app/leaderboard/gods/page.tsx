import type { Metadata } from 'next';
import GodsLeaderboardPageClient from './GodsLeaderboardPageClient';

export const metadata: Metadata = {
  title: 'Gods',
};

export default function GodsLeaderboardPage() {
  return <GodsLeaderboardPageClient />;
}

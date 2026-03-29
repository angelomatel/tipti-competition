import HeroSection from '@/src/components/home/HeroSection';
import StatsBar from '@/src/components/home/StatsBar';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pt-32 pb-16">
      <HeroSection />
      <StatsBar />
      <div className="text-center mt-10">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, var(--nebula-purple), var(--nebula-pink))', boxShadow: '0 4px 20px rgba(167,139,250,0.3)' }}
        >
          View Leaderboard →
        </Link>
      </div>
    </main>
  );
}

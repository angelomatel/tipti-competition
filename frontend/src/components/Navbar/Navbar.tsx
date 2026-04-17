'use client';

import { Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTournament } from '@/src/hooks/useTournament';
import PillToggle from '@/src/components/Shared/PillToggle';
import PhaseCountdown from '@/src/components/Shared/PhaseCountdown';
import { isEventStarted, getDaysUntilStart } from '@/src/lib/tournament';

const TAB_OPTIONS = [
  { label: 'Players', value: 'players' },
  { label: 'Gods', value: 'gods' },
];

function NavbarInner() {
  const pathname = usePathname();
  const isGodsTab = pathname.startsWith('/leaderboard/gods');
  const activeTab = isGodsTab ? 'gods' : 'players';

  const router = useRouter();
  const { data } = useTournament();

  const handleTabChange = (value: string) => {
    if (value === 'gods') {
      router.push('/leaderboard/gods', { scroll: false });
    } else {
      router.push('/leaderboard', { scroll: false });
    }
  };

  const settings = data?.settings;
  const started = isEventStarted(settings);

  const navLinkClass = (href: string) =>
    `text-sm font-medium tracking-wide uppercase transition-colors ${
      pathname === href
        ? 'text-text-primary'
        : 'text-text-muted hover:text-text-secondary'
    }`;

  return (
    <nav
      className="sticky top-0 z-50 h-16 backdrop-blur-xl border-b border-border-default"
      style={{ background: 'rgba(10, 6, 24, 0.82)' }}
    >
      <div className="max-w-5xl mx-auto px-6 h-full grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
        {/* Left: nav links */}
        <div className="min-w-0 flex items-center gap-4 sm:gap-6">
          <Link href="/" className={navLinkClass('/')}>
            Home
          </Link>
          <Link href="/rules" className={`${navLinkClass('/rules')} whitespace-nowrap`}>
            How It Works
          </Link>
        </div>

        {/* Center: tab toggle (leaderboard only) */}
        {(pathname === '/leaderboard' || pathname.startsWith('/leaderboard/gods')) && (
          <div className="justify-self-end sm:justify-self-center">
            <PillToggle
              options={TAB_OPTIONS}
              activeValue={activeTab}
              onChange={handleTabChange}
            />
          </div>
        )}

        {/* Right: phase badge + countdown or pre-event status */}
        <div className="hidden sm:flex items-center justify-self-end gap-3 text-sm">
          {settings && started ? (
            <PhaseCountdown settings={settings} />
          ) : settings?.startDate ? (
            <span className="font-medium text-text-muted">
              Starts in {getDaysUntilStart(settings.startDate)}d
            </span>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

const Navbar: React.FC = () => (
  <Suspense>
    <NavbarInner />
  </Suspense>
);

export default Navbar;

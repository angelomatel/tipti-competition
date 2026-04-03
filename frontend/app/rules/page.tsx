import Link from 'next/link';
import RulesPage from '@/src/components/Rules/RulesPage';
import { TIPTI_DISCORD_URL } from '@/src/lib/constants';

export default function Rules() {
  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pt-24 pb-16">
      <RulesPage />
      <div className="mt-10 text-center text-sm text-slate-300/80">
        Questions about the rules? Join the{' '}
        <Link
          href={TIPTI_DISCORD_URL}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
        >
          tipti Discord server
        </Link>{' '}
        to stay updated and ask the community.
      </div>
    </main>
  );
}

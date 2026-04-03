import Link from 'next/link';
import { TIPTI_DISCORD_URL } from '@/src/lib/constants';

export default function Footer() {
  return (
    <footer className="text-center py-5 px-4 text-[11px] leading-tight z-10 relative border-t border-white/5 w-full flex flex-col gap-0.5">
      <p className="text-slate-500/80">
        This bootcamp event/tournament is not affiliated with or sponsored by Riot Games, Inc. or League of Legends Esports.
      </p>
      <div className="flex justify-center gap-1">
        <p className="text-blue-400/50">Made by eulb</p>
        <p className="text-slate-500/80">
          for the{' '}
          <Link
            href={TIPTI_DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300/80 transition-colors hover:text-cyan-200"
          >
            tipti community on Discord
          </Link>
          .
        </p>
      </div>
    </footer>
  );
}

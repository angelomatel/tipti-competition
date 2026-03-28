import Navbar from '@/src/components/Navbar/Navbar';
import Leaderboard from '@/src/components/Leaderboard/Leaderboard';

export default function Home() {
  return (
    <>
      <div className="stars" aria-hidden="true" />
      <Navbar />

      <main className="relative z-10 max-w-4xl mx-auto px-4 pt-24 pb-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold tracking-tight mb-3 bg-gradient-to-r from-[#7b2fff] via-white to-[#00d4ff] bg-clip-text text-transparent">
            SPACE GODS BOOTCAMP
          </h1>
          <p className="text-violet-300/70 text-sm tracking-widest uppercase">
            a tipti Tournament
          </p>
        </div>

        <Leaderboard />
      </main>
    </>
  );
}

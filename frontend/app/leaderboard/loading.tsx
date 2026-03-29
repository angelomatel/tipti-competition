export default function LeaderboardLoading() {
  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pt-24 pb-16">
      <div className="flex flex-col gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-16 rounded-[var(--radius-md)] animate-pulse" style={{ background: 'var(--surface-1)' }} />
        ))}
      </div>
    </main>
  );
}

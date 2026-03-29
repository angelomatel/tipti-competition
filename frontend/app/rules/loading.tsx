export default function RulesLoading() {
  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pt-24 pb-16">
      <div className="max-w-[860px] mx-auto">
        <div className="text-center mb-12">
          <div className="h-12 w-64 mx-auto rounded-lg animate-pulse mb-3" style={{ background: 'var(--surface-1)' }} />
          <div className="h-4 w-48 mx-auto rounded animate-pulse" style={{ background: 'var(--surface-1)' }} />
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-32 rounded-[var(--radius-lg)] animate-pulse mb-4" style={{ background: 'var(--surface-1)' }} />
        ))}
      </div>
    </main>
  );
}

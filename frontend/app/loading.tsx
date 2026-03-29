export default function Loading() {
  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pt-32 pb-16">
      <div className="text-center mb-16">
        <div className="h-4 w-48 mx-auto rounded animate-pulse mb-4" style={{ background: 'var(--surface-1)' }} />
        <div className="h-16 w-80 mx-auto rounded-lg animate-pulse mb-4" style={{ background: 'var(--surface-1)' }} />
        <div className="h-5 w-56 mx-auto rounded animate-pulse mb-8" style={{ background: 'var(--surface-1)' }} />
        <div className="h-12 w-44 mx-auto rounded-full animate-pulse" style={{ background: 'var(--surface-1)' }} />
      </div>
    </main>
  );
}

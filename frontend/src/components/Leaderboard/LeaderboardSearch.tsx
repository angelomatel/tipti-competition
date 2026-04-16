'use client';

interface LeaderboardSearchProps {
  value: string;
  debouncedValue: string;
  onChange: (value: string) => void;
  className?: string;
}

const LeaderboardSearch: React.FC<LeaderboardSearchProps> = ({
  value,
  debouncedValue,
  onChange,
  className = '',
}) => {
  const hasQuery = value.trim().length > 0 || debouncedValue.length > 0;

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M12.5 12.5L17 17" strokeLinecap="round" />
          </svg>

          <input
            id="leaderboard-search-input"
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Search by Riot ID, game name, tag, or Discord username"
            className="w-full rounded-full border border-border-default bg-surface-1 px-10 py-2.5 pr-16 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-border-bright"
            aria-label="Search leaderboard players"
          />

          {(value || hasQuery) && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-primary"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {debouncedValue && (
        <p className="mt-2 text-xs text-text-muted">
          Searching for <span className="text-text-primary italic">{debouncedValue}</span>
        </p>
      )}
    </div>
  );
};

export default LeaderboardSearch;

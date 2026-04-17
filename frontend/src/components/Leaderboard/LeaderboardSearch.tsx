'use client';

import { useEffect, useId, useRef } from 'react';

interface LeaderboardSearchProps {
  value: string;
  debouncedValue: string;
  onChange: (value: string) => void;
  className?: string;
  isMobileExpanded?: boolean;
  onMobileExpandedChange?: (expanded: boolean) => void;
}

const SearchIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="M12.5 12.5L17 17" strokeLinecap="round" />
  </svg>
);

const LeaderboardSearch: React.FC<LeaderboardSearchProps> = ({
  value,
  debouncedValue,
  onChange,
  className = '',
  isMobileExpanded = false,
  onMobileExpandedChange,
}) => {
  const hasQuery = value.trim().length > 0 || debouncedValue.length > 0;
  const activeLabel = debouncedValue || value.trim();
  const searchInputId = useId();
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
  };

  useEffect(() => {
    if (isMobileExpanded) {
      mobileInputRef.current?.focus();
    }
  }, [isMobileExpanded]);

  return (
    <div className={className}>
      <div className="sm:hidden">
        {isMobileExpanded ? (
          <>
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />

                <input
                  id={`${searchInputId}-mobile`}
                  ref={mobileInputRef}
                  type="search"
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                  placeholder="Search players"
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

              <button
                type="button"
                onClick={() => onMobileExpandedChange?.(false)}
                className="shrink-0 rounded-full border border-border-default bg-surface-1 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-border-bright hover:text-text-primary"
                aria-label="Collapse search"
              >
                Done
              </button>
            </div>

            {debouncedValue && (
              <p className="mt-2 text-xs text-text-muted">
                Searching for <span className="text-text-primary italic">{debouncedValue}</span>
              </p>
            )}
          </>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onMobileExpandedChange?.(true)}
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                hasQuery
                  ? 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan'
                  : 'border-border-default bg-surface-1 text-text-secondary'
              }`}
              aria-label="Open search"
              aria-expanded={isMobileExpanded}
              aria-controls={`${searchInputId}-mobile`}
            >
              <SearchIcon className="h-4 w-4" />
            </button>

            {hasQuery && (
              <button
                type="button"
                onClick={() => onMobileExpandedChange?.(true)}
                className="min-w-0 flex-1 rounded-full border border-accent-cyan/20 bg-accent-cyan/10 px-3 py-2 text-left text-xs text-accent-cyan transition-colors hover:border-accent-cyan/35"
                aria-label={`Edit search for ${activeLabel}`}
              >
                <span className="block truncate">{activeLabel}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="hidden sm:block">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />

          <input
            id={`${searchInputId}-desktop`}
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

        {debouncedValue && (
          <p className="mt-2 text-xs text-text-muted">
            Searching for <span className="text-text-primary italic">{debouncedValue}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default LeaderboardSearch;

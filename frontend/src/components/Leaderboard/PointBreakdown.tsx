'use client';

import { useState } from 'react';
import type { DailyPointEntry, DailyPointTransaction } from '@/src/types/PlayerProfile';
import { MATCH_LINK_TACTICS_TOOLS, MATCH_LINK_METATFT } from '@/src/lib/constants';

interface PointBreakdownProps {
  dailyPoints: DailyPointEntry[];
  gameName: string;
  tagLine: string;
}

const SOURCE_LABELS: Record<string, string> = {
  daily_lp_gain: 'Matches',
  lp_data: 'LP Delta',
  lp_delta: 'LP Delta',
  varus_flat: 'Varus (Flat)',
  varus_top10: 'Varus (Top 10)',
  ekko_flat: 'Ekko (Flat)',
  ekko_repeat: 'Ekko (Repeat)',
  evelynn_flat: 'Evelynn (Flat)',
  evelynn_high: 'Evelynn (High LP)',
  thresh_flat: 'Thresh (Flat)',
  thresh_match: 'Thresh (Match)',
  thresh_top1: 'Thresh (Top 1)',
  yasuo_5th: 'Yasuo (5th)',
  yasuo_6th: 'Yasuo (6th)',
  yasuo_7th: 'Yasuo (7th)',
  yasuo_8th: 'Yasuo (8th)',
  soraka_streak: 'Soraka Win Streak',
  soraka_loss_streak: 'Soraka Loss Streak',
  kayle_flat: 'Kayle (Flat)',
  kayle_activity: 'Kayle (Activity)',
  ahri_first_place: 'Ahri (1st Place)',
  asol_cosmic: 'Aurelion Sol (Random)',
  god_1st_place: 'God 1st Place Bonus',
  god_2nd_place: 'God 2nd Place Bonus',
  god_3rd_place: 'God 3rd Place Bonus',
};

const isLpSource = (source: string) => source === 'lp_data' || source === 'lp_delta';

const resolveSourceLabel = (source: string): string => {
  if (source.startsWith('dead_')) {
    const base = source.slice(5);
    const baseLabel = SOURCE_LABELS[base] ?? base;
    return `(Chance) ${baseLabel}`;
  }
  return SOURCE_LABELS[source] ?? source;
};

const labelFor = (tx: DailyPointTransaction) => {
  if (isLpSource(tx.source)) {
    return tx.value >= 0 ? 'LP Gain' : 'LP Loss';
  }
  return resolveSourceLabel(tx.source);
};

const formatTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

interface MatchGroup {
  matchId: string;
  primary: DailyPointTransaction | null;
  extras: DailyPointTransaction[];
}

const groupTransactions = (transactions: DailyPointTransaction[]) => {
  const matchGroups: MatchGroup[] = [];
  const matchIndex = new Map<string, MatchGroup>();
  const standalone: DailyPointTransaction[] = [];

  for (const tx of transactions) {
    if (!tx.matchId) {
      standalone.push(tx);
      continue;
    }
    let g = matchIndex.get(tx.matchId);
    if (!g) {
      g = { matchId: tx.matchId, primary: null, extras: [] };
      matchIndex.set(tx.matchId, g);
      matchGroups.push(g);
    }
    if (isLpSource(tx.source)) {
      g.primary = tx;
    } else {
      g.extras.push(tx);
    }
  }

  // If a group has no LP primary, promote the first extra so the group still has a header.
  for (const g of matchGroups) {
    if (!g.primary && g.extras.length > 0) {
      g.primary = g.extras.shift() ?? null;
    }
  }

  // Latest match first within the day.
  const playedAtMs = (tx: DailyPointTransaction | null) => {
    const t = tx?.playedAt ? new Date(tx.playedAt).getTime() : NaN;
    return Number.isNaN(t) ? 0 : t;
  };
  matchGroups.sort((a, b) => playedAtMs(b.primary) - playedAtMs(a.primary));

  return { matchGroups, standalone };
};

interface TxRowProps {
  tx: DailyPointTransaction;
  gameName: string;
  tagLine: string;
  showLinks?: boolean;
  showTime?: boolean;
  nested?: boolean;
}

const TxRow: React.FC<TxRowProps> = ({ tx, gameName, tagLine, showLinks = false, showTime = false, nested = false }) => (
  <div className={`flex justify-between gap-2 text-xs ${nested ? 'pl-10' : ''}`}>
    <div className="min-w-0 flex items-center gap-2 flex-wrap">
      {showTime && tx.playedAt && (
        <span
          className="text-[10px] w-8 shrink-0 tabular-nums"
          style={{ color: 'var(--text-muted)', opacity: 0.7 }}
        >
          {formatTime(tx.playedAt)}
        </span>
      )}
      <span style={{ color: 'var(--text-muted)' }}>
        {labelFor(tx)}
        {typeof tx.placement === 'number' ? ` (Place #${tx.placement})` : ''}
      </span>
      {showLinks && tx.matchId && (
        <>
          <a
            href={MATCH_LINK_TACTICS_TOOLS(gameName, tagLine, tx.matchId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] transition-colors text-indigo-300 hover:text-indigo-200"
          >
            tactics.tools
          </a>
          <a
            href={MATCH_LINK_METATFT(gameName, tagLine, tx.matchId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] transition-colors text-indigo-300 hover:text-indigo-200"
          >
            metatft
          </a>
        </>
      )}
    </div>
    <span className="shrink-0" style={{ color: tx.value >= 0 ? 'var(--accent-cyan)' : '#f87171' }}>
      {tx.lpStatus === 'unknown'
        ? 'LP unknown'
        : tx.lpStatus === 'resolving'
          ? 'LP resolving'
        : (
          <>
            {tx.value >= 0 ? '+' : ''}{tx.value}
            {isLpSource(tx.source) ? ' LP' : ''}
          </>
        )}
    </span>
  </div>
);

const PointBreakdown: React.FC<PointBreakdownProps> = ({ dailyPoints, gameName, tagLine }) => {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  if (!dailyPoints || dailyPoints.length === 0) {
    return (
      <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
        No point transactions yet.
      </p>
    );
  }

  const sorted = [...dailyPoints].sort((a, b) => b.day.localeCompare(a.day));

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
      {sorted.map((day) => {
        const total = day.transactions.reduce((s, t) => s + t.value, 0);
        const isExpanded = expandedDay === day.day;
        const { matchGroups, standalone } = groupTransactions(day.transactions);

        return (
          <div key={day.day}>
            <button
              className="w-full flex justify-between items-center px-3 py-2 rounded-[var(--radius-sm)] transition-colors text-left cursor-pointer"
              style={{ background: 'var(--surface-0)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-0)'; }}
              onClick={() => setExpandedDay(isExpanded ? null : day.day)}
            >
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{day.day}</span>
              <span
                className="text-xs font-bold"
                style={{ color: total >= 0 ? 'var(--accent-cyan)' : '#f87171' }}
              >
                {total >= 0 ? '+' : ''}{total} pts
              </span>
            </button>

            {isExpanded && (
              <div className="pl-4 py-1 space-y-2">
                {matchGroups.map((group) => (
                  <div key={group.matchId} className="space-y-0.5">
                    {group.primary && (
                      <TxRow
                        tx={group.primary}
                        gameName={gameName}
                        tagLine={tagLine}
                        showLinks
                        showTime
                      />
                    )}
                    {group.extras.map((tx, i) => (
                      <TxRow
                        key={`${group.matchId}-${tx.source}-${i}`}
                        tx={tx}
                        gameName={gameName}
                        tagLine={tagLine}
                        nested
                      />
                    ))}
                  </div>
                ))}
                {standalone.length > 0 && (
                  <div className="space-y-0.5">
                    {standalone.map((tx, i) => (
                      <TxRow
                        key={`standalone-${tx.source}-${i}`}
                        tx={tx}
                        gameName={gameName}
                        tagLine={tagLine}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PointBreakdown;

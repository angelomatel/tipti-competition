'use client';

import { useState } from 'react';
import type { DailyPointEntry } from '@/src/types/PlayerProfile';
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

const PointBreakdown: React.FC<PointBreakdownProps> = ({ dailyPoints, gameName, tagLine }) => {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  if (!dailyPoints || dailyPoints.length === 0) {
    return (
      <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
        No point transactions yet.
      </p>
    );
  }

  // Show most recent first
  const sorted = [...dailyPoints].reverse();

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
      {sorted.map((day) => {
        const total = day.transactions.reduce((s, t) => s + t.value, 0);
        const isExpanded = expandedDay === day.day;

        return (
          <div key={day.day}>
            <button
              className="w-full flex justify-between items-center px-3 py-2 rounded-[var(--radius-sm)] transition-colors text-left"
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
              <div className="pl-4 py-1 space-y-0.5">
                {day.transactions.map((tx, i) => (
                  <div key={`${tx.source}-${tx.matchId ?? 'none'}-${i}`} className="flex justify-between gap-2 text-xs">
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <span style={{ color: 'var(--text-muted)' }}>
                        {(tx.source === 'lp_data' || tx.source === 'lp_delta')
                          ? 'LP Gain'
                          : (SOURCE_LABELS[tx.source] ?? tx.source)}
                        {typeof tx.placement === 'number' ? ` (Place #${tx.placement})` : ''}
                      </span>
                      {tx.matchId && (
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
                      {tx.value >= 0 ? '+' : ''}{tx.value}
                      {(tx.source === 'lp_data' || tx.source === 'lp_delta') ? ' LP' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PointBreakdown;

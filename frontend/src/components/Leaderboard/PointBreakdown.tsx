'use client';

import { useState } from 'react';
import type { DailyPointEntry } from '@/src/types/PlayerProfile';

interface PointBreakdownProps {
  dailyPoints: DailyPointEntry[];
}

const SOURCE_LABELS: Record<string, string> = {
  daily_lp_gain: 'Matches',
  varus_top: 'Varus Buff (Top)',
  varus_bottom: 'Varus Buff (Bottom)',
  ekko_rewind: 'Ekko Rewind',
  evelynn_base: 'Evelynn Buff',
  evelynn_high: 'Evelynn Buff (High)',
  thresh_pair: 'Thresh Pact',
  yasuo_high: 'Yasuo Buff',
  yasuo_penalty: 'Yasuo Penalty',
  soraka_streak: 'Soraka Streak',
  soraka_loss_streak: 'Soraka Loss Streak',
  kayle_final: 'Kayle Final Bonus',
  ahri_first_place: 'Ahri First Place',
  ahri_cap_adjustment: 'Ahri Cap Adjustment',
  asol_top: 'Aurelion Sol (Top)',
  asol_random: 'Aurelion Sol (Random)',
  god_1st_place: 'God 1st Place Bonus',
  god_2nd_place: 'God 2nd Place Bonus',
  god_3rd_place: 'God 3rd Place Bonus',
};

const PointBreakdown: React.FC<PointBreakdownProps> = ({ dailyPoints }) => {
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
                  <div key={i} className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>
                      {SOURCE_LABELS[tx.source] ?? tx.source}
                    </span>
                    <span style={{ color: tx.value >= 0 ? 'var(--accent-cyan)' : '#f87171' }}>
                      {tx.value >= 0 ? '+' : ''}{tx.value}
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

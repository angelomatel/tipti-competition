'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { MatchPoint } from '@/src/types/PlayerProfile';
import { formatTier } from '@/src/types/Rank';
import { COLORS } from '@/src/lib/theme';

interface LPGraphProps {
  matchPoints: MatchPoint[];
}

const RANGE_OPTIONS = [
  { label: 'Last 20', value: 20 },
  { label: 'Last 50', value: 50 },
  { label: 'All', value: 0 },
] as const;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const CustomTooltip = ({ active, payload }: TooltipContentProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as MatchPoint | undefined;
  if (!point) return null;
  return (
    <div
      style={{ backgroundColor: COLORS.surface0 }}
      className="border border-[var(--border)] rounded-lg px-3 py-2 text-xs"
    >
      <p style={{ color: 'var(--text-secondary)' }}>{new Date(point.playedAt).toLocaleString()}</p>
      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
        {formatTier(point.tier, point.rank)} — {point.leaguePoints} LP
      </p>
      <p style={{ color: 'var(--text-muted)' }}>Placement: #{point.placement}</p>
    </div>
  );
};

const LPGraph: React.FC<LPGraphProps> = ({ matchPoints }) => {
  const [range, setRange] = useState<number>(20);

  if (matchPoints.length < 2) {
    return (
      <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
        Not enough match data for a graph yet.
      </p>
    );
  }

  const visible = range === 0 ? matchPoints : matchPoints.slice(-range);

  const lpValues = visible.map((p) => p.normalizedLP);
  const minLP = Math.min(...lpValues);
  const maxLP = Math.max(...lpValues);
  const padding = Math.max(50, Math.round((maxLP - minLP) * 0.1));
  const yMin = Math.max(0, minLP - padding);
  const yMax = maxLP + padding;

  const uniqueDateTicks = visible
    .map((p) => p.playedAt)
    .filter((val, idx, arr) => {
      const date = formatDate(val);
      return arr.findIndex((v) => formatDate(v) === date) === idx;
    });

  return (
    <div>
      <div className="flex justify-end mb-2">
        <select
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
          className="text-xs rounded px-2 py-1 focus:outline-none cursor-pointer"
          style={{
            background: 'var(--surface-0)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={visible} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis
            dataKey="playedAt"
            ticks={uniqueDateTicks}
            tickFormatter={formatDate}
            stroke={COLORS.mutedText}
            tick={{ fontSize: 10, fill: COLORS.mutedText }}
          />
          <YAxis
            dataKey="normalizedLP"
            domain={[yMin, yMax]}
            stroke={COLORS.mutedText}
            tick={{ fontSize: 10, fill: COLORS.mutedText }}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="normalizedLP"
            stroke={COLORS.purple}
            strokeWidth={2}
            dot={{ r: 2, fill: COLORS.purple }}
            activeDot={{ r: 4, fill: COLORS.purple }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LPGraph;

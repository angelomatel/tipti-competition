'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { MatchPoint } from '@/src/types/PlayerProfile';
import { Tier, Division, formatTier } from '@/src/types/Rank';
import { COLORS, TIER_COLORS } from '@/src/lib/theme';

const TIER_SEQUENCE: Tier[] = [
  Tier.IRON,
  Tier.BRONZE,
  Tier.SILVER,
  Tier.GOLD,
  Tier.PLATINUM,
  Tier.EMERALD,
  Tier.DIAMOND,
  Tier.MASTER,
  Tier.GRANDMASTER,
  Tier.CHALLENGER,
];
const DIVISIONS_IV_TO_I: Division[] = [Division.IV, Division.III, Division.II, Division.I];
const TIER_WITHOUT_DIV = new Set<Tier>([Tier.MASTER, Tier.GRANDMASTER, Tier.CHALLENGER]);

/** Each tier occupies a 400-wide band (4 divisions × 100 LP). IRON starts at 400. */
function tierStart(tier: Tier): number {
  return (TIER_SEQUENCE.indexOf(tier) + 1) * 400;
}

/** Convert a normalized LP value (at a division boundary) back to its rank label. */
function formatNormalizedTick(value: number): string {
  const tierIdx = Math.floor(value / 400) - 1;
  const tier = TIER_SEQUENCE[tierIdx];
  if (!tier) return '';
  if (TIER_WITHOUT_DIV.has(tier)) {
    if (value % 400 !== 0) return '';
    return tier.charAt(0) + tier.slice(1).toLowerCase();
  }
  const divIdx = Math.floor((value % 400) / 100);
  const division = DIVISIONS_IV_TO_I[divIdx];
  return formatTier(tier, division);
}

interface LPGraphProps {
  matchPoints: MatchPoint[];
  matchLimit: number;
  onRangeChange: (limit: number) => void;
}

const RANGE_OPTIONS = [
  { label: 'Last 20', value: 20 },
  { label: 'Last 50', value: 50 },
  { label: 'Last 80', value: 80 },
  { label: 'Last 120', value: 120 },
  { label: 'All', value: 0 },
] as const;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const CustomTooltip = ({ active, payload }: TooltipContentProps) => {
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

const LPGraph: React.FC<LPGraphProps> = ({ matchPoints, matchLimit, onRangeChange }) => {
  if (matchPoints.length < 2) {
    return (
      <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
        Not enough match data for a graph yet.
      </p>
    );
  }

  const visible = matchPoints;

  const lpValues = visible.map((p) => p.normalizedLP);
  const minLP = Math.min(...lpValues);
  const maxLP = Math.max(...lpValues);
  const padding = Math.max(50, Math.round((maxLP - minLP) * 0.1));
  const yMin = Math.max(0, minLP - padding);
  const yMax = maxLP + padding;

  // Tier bands that overlap the visible y range.
  const tierBands = TIER_SEQUENCE
    .map((tier) => {
      const start = tierStart(tier);
      const end = start + 400;
      return { tier, start, end };
    })
    .filter((b) => b.end > yMin && b.start < yMax)
    .map((b) => ({
      tier: b.tier,
      start: Math.max(b.start, yMin),
      end: Math.min(b.end, yMax),
    }));

  // Y-axis ticks: every 100 (division boundary) for tiered ranks, every 400 for Master+.
  const yTicks: number[] = [];
  const firstTick = Math.ceil(yMin / 100) * 100;
  for (let v = firstTick; v <= yMax; v += 100) {
    const tierIdx = Math.floor(v / 400) - 1;
    const tier = TIER_SEQUENCE[tierIdx];
    if (!tier) continue;
    if (TIER_WITHOUT_DIV.has(tier) && v % 400 !== 0) continue;
    yTicks.push(v);
  }

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
          value={matchLimit}
          onChange={(e) => onRangeChange(Number(e.target.value))}
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
          {tierBands.map((band) => (
            <ReferenceArea
              key={band.tier}
              y1={band.start}
              y2={band.end}
              fill={TIER_COLORS[band.tier]}
              fillOpacity={0.12}
              stroke="none"
              ifOverflow="hidden"
            />
          ))}
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
            ticks={yTicks}
            tickFormatter={formatNormalizedTick}
            stroke={COLORS.mutedText}
            tick={{ fontSize: 10, fill: COLORS.mutedText }}
            width={80}
          />
          <Tooltip content={CustomTooltip} />
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

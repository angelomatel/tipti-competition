'use client';

import { getGodColor } from '@/src/lib/godColors';
import { BUFF_DATA } from '@/src/lib/godData';

const BuffReferenceTable = () => (
  <div
    className="rounded-[var(--radius-lg)] overflow-hidden"
    style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
  >
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>God</th>
          <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Domain</th>
          <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Buff Mechanic</th>
        </tr>
      </thead>
      <tbody>
        {BUFF_DATA.map((god) => {
          const colors = getGodColor(god.slug);
          return (
            <tr
              key={god.slug}
              className="transition-colors"
              style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <td className="px-4 py-3">
                <span className="font-semibold" style={{ color: colors.primary }}>{god.name}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>{god.title}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{god.mechanic}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    <p className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
      All match buffs capped at +75/day per god. Exceptions apply.
    </p>
  </div>
);

export default BuffReferenceTable;

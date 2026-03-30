const ScoringFormula = () => (
  <div>
    {/* Main formula card */}
    <div
      className="p-6 rounded-[var(--radius-lg)] text-center mb-6"
      style={{ background: 'var(--surface-0)', border: '1px solid var(--border-bright)' }}
    >
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
        The Formula
      </p>
      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
        Score = <span style={{ color: 'var(--accent-cyan)' }}>Match</span> +{' '}
        <span style={{ color: 'var(--phase-active)' }}>Buff</span> −{' '}
        <span style={{ color: '#f87171' }}>Penalty</span> +{' '}
        <span style={{ color: 'var(--gold)' }}>God Bonus</span>
      </p>
    </div>

    {/* 4 rule cards in 2-column grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[
        {
          title: 'Match Points',
          color: 'var(--accent-cyan)',
          description: 'LP gained each day is converted 1:1 into match points. Every point of LP climbed counts toward your score.',
        },
        {
          title: 'Buff Points',
          color: 'var(--phase-active)',
          description: 'Each god grants unique daily buffs starting Day 6 (after Phase 1). All god buffs are capped at +50 points per day.',
        },
        {
          title: 'God Placement Bonus',
          color: 'var(--gold)',
          description: 'At tournament end, gods are ranked by average score. 1st place god: +100, 2nd: +75, 3rd: +50 to all their players.',
        },
        {
          title: 'Tiebreaker',
          color: 'var(--nebula-purple)',
          description: 'If players tie on score points, normalized LP (accounting for tier boundaries) is used as the tiebreaker.',
        },
      ].map((card) => (
        <div
          key={card.title}
          className="p-4 rounded-[var(--radius-md)]"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          <h4 className="text-sm font-bold mb-2" style={{ color: card.color }}>
            {card.title}
          </h4>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {card.description}
          </p>
        </div>
      ))}
    </div>
  </div>
);

export default ScoringFormula;

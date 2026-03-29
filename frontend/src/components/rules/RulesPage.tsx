'use client';

import SectionLabel from '@/src/components/shared/SectionLabel';
import ScoringFormula from './ScoringFormula';
import PhaseVisual from './PhaseVisual';
import BuffReferenceTable from './BuffReferenceTable';
import RegistrationInfo from './RegistrationInfo';

const RulesPage = () => (
  <div className="max-w-[860px] mx-auto">
    {/* Hero title */}
    <div className="text-center mb-4">
      <h1
        className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3 bg-clip-text text-transparent"
        style={{ backgroundImage: 'linear-gradient(135deg, var(--nebula-purple), var(--nebula-pink), var(--nebula-rose))' }}
      >
        How It Works
      </h1>
      <p className="text-sm italic" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-lore)' }}>
        Everything you need to know about the tournament
      </p>
    </div>

    <SectionLabel>The Formula</SectionLabel>
    <ScoringFormula />

    <SectionLabel>Tournament Phases</SectionLabel>
    <PhaseVisual />

    <SectionLabel>God Buff Reference</SectionLabel>
    <BuffReferenceTable />

    <SectionLabel>Getting Started</SectionLabel>
    <RegistrationInfo />
  </div>
);

export default RulesPage;

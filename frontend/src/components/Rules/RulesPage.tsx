'use client';

import SectionLabel from '@/src/components/Shared/SectionLabel';
import ScoringFormula from '@/src/components/Rules/ScoringFormula';
import PhaseVisual from '@/src/components/Rules/PhaseVisual';
import BuffReferenceTable from '@/src/components/Rules/BuffReferenceTable';
import RegistrationInfo from '@/src/components/Rules/RegistrationInfo';

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

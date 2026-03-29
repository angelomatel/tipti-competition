import React from 'react';

interface SectionLabelProps {
  children: React.ReactNode;
}

const SectionLabel: React.FC<SectionLabelProps> = ({ children }) => (
  <div className="flex items-center gap-4 my-8">
    <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
    <span
      className="text-xs font-semibold tracking-[0.25em] uppercase"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </span>
    <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
  </div>
);

export default SectionLabel;

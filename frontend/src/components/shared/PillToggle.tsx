'use client';

interface PillToggleProps {
  options: { label: string; value: string }[];
  activeValue: string;
  onChange: (value: string) => void;
}

const PillToggle = ({ options, activeValue, onChange }: PillToggleProps) => (
  <div className="flex rounded-full p-1" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}>
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
          activeValue === opt.value
            ? 'text-white'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
        }`}
        style={activeValue === opt.value ? {
          background: 'linear-gradient(135deg, var(--nebula-purple), var(--nebula-pink))',
          boxShadow: '0 2px 8px rgba(167,139,250,0.3)',
        } : undefined}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

export default PillToggle;

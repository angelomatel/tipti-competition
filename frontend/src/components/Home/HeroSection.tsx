'use client';

const HeroSection = () => {
  return (
    <div className="text-center mb-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="h-px w-12 bg-text-muted/30" />
        <p className="text-xs font-medium tracking-[0.25em] uppercase text-text-muted" style={{ fontVariant: 'small-caps' }}>
          Tipti Bootcamp by eulb &mdash; Set 17
        </p>
        <div className="h-px w-12 bg-text-muted/30" />
      </div>

      <h1
        className="font-extrabold tracking-tight mb-4 text-white"
        style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)' }}
      >
        Space Gods
      </h1>

      <p className="text-sm italic mb-8 text-text-secondary" style={{ fontFamily: 'var(--font-lore)' }}>
        Choose your deity. Claim the cosmos.
      </p>
    </div>
  );
};

export default HeroSection;

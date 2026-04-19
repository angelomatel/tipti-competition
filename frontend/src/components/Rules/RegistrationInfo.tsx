const RegistrationInfo = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div
      className="p-4 rounded-[var(--radius-md)]"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--nebula-purple)' }}>
        Registration
      </h4>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Use <code className="text-accent-cyan">/register</code> in Discord during Phase 1. Enter your Riot ID, then choose your god from the dropdown. Your god choice is permanent for the tournament.
      </p>
    </div>
    <div
      className="p-4 rounded-[var(--radius-md)]"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--nebula-purple)' }}>
        Live Notifications
      </h4>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        The bot posts real-time alerts for 1st and 8th place finishes, daily climb/slide summaries, and end-of-phase eliminations in your tournament channels.
      </p>
    </div>
  </div>
);

export default RegistrationInfo;

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 text-center">
      {/* Animated icon */}
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-surface">
          <svg
            className="text-muted"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        {/* Decorative dots */}
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse-slow rounded-full bg-accent/60" />
      </div>

      <div className="space-y-1.5">
        <p className="font-display text-base font-semibold text-text-primary">
          No downloads yet
        </p>
        <p className="max-w-xs font-body text-sm text-text-secondary">
          Paste or drag a video link from YouTube, Twitter/X, or Instagram above
          and it will download straight to your computer.
        </p>
      </div>

      {/* Platform pills */}
      <div className="flex items-center gap-2">
        {(
          [
            { label: 'YouTube', color: '#ff0000', bg: 'rgba(255,0,0,0.08)' },
            { label: 'Twitter / X', color: '#1d9bf0', bg: 'rgba(29,155,240,0.08)' },
            { label: 'Instagram', color: '#e1306c', bg: 'rgba(225,48,108,0.08)' },
          ] as const
        ).map(({ label, color, bg }) => (
          <span
            key={label}
            className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider"
            style={{ color, backgroundColor: bg }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

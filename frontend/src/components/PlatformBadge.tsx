import type { Platform } from "@/types";

const PLATFORM_CONFIG: Record<
  Platform,
  { label: string; shortLabel: string; dotClassName: string }
> = {
  youtube: {
    label: "YouTube",
    shortLabel: "YT",
    dotClassName: "bg-[#ff6b6b]",
  },
  twitter: {
    label: "X",
    shortLabel: "X",
    dotClassName: "bg-[#8fb4c9]",
  },
  instagram: {
    label: "Instagram",
    shortLabel: "IG",
    dotClassName: "bg-[#d98fb7]",
  },
  unknown: {
    label: "Unknown",
    shortLabel: "??",
    dotClassName: "bg-[var(--text-dim)]",
  },
};

type PlatformBadgeProps = {
  platform: Platform;
  className?: string;
};

export function PlatformBadge({
  platform,
  className = "",
}: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform];

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[rgba(255,255,255,0.035)] px-2 py-1 font-mono-system text-[11px] text-[var(--text-soft)] ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`}
      />
      <span className="text-[var(--text-muted)]">{config.shortLabel}</span>
      <span className="hidden md:inline">{config.label}</span>
    </span>
  );
}

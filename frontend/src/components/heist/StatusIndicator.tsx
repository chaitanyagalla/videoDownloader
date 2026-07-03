type HeistStatus =
  | "IDLE"
  | "LOCKING TARGET"
  | "DOWNLOADING"
  | "MISSION COMPLETED"
  | "MISSION FAILED";

type StatusIndicatorProps = {
  status: HeistStatus;
  error?: string | null;
};

const STATUS_STYLES: Record<
  HeistStatus,
  {
    dotClassName: string;
    textClassName: string;
    description: string;
  }
> = {
  IDLE: {
    dotClassName: "bg-[var(--text-dim)] shadow-none",
    textClassName: "text-[var(--text-dim)]",
    description: "Awaiting target URL input.",
  },
  "LOCKING TARGET": {
    dotClassName:
      "bg-[var(--warning)] shadow-[0_0_14px_rgba(255,204,0,0.65)]",
    textClassName: "text-[var(--warning)]",
    description: "Validating target and opening extraction channel.",
  },
  DOWNLOADING: {
    dotClassName:
      "bg-[var(--neon)] shadow-[0_0_14px_rgba(0,255,159,0.8)]",
    textClassName: "text-[var(--neon)]",
    description: "Packets are being extracted in real time.",
  },
  "MISSION COMPLETED": {
    dotClassName:
      "bg-[var(--neon-soft)] shadow-[0_0_14px_rgba(122,255,193,0.8)]",
    textClassName: "text-[var(--neon-soft)]",
    description: "Target payload secured successfully.",
  },
  "MISSION FAILED": {
    dotClassName:
      "bg-[var(--danger)] shadow-[0_0_14px_rgba(255,77,109,0.7)]",
    textClassName: "text-[var(--danger)]",
    description: "The extraction failed. Review system output.",
  },
};

export type { HeistStatus };

export default function StatusIndicator({
  status,
  error,
}: StatusIndicatorProps) {
  const config = STATUS_STYLES[status];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[rgba(0,255,159,0.04)] p-4">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${config.dotClassName}`} />
        <div>
          <p className={`status-text ${config.textClassName}`}>{status}</p>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            {error ? error : config.description}
          </p>
        </div>
      </div>
    </div>
  );
}
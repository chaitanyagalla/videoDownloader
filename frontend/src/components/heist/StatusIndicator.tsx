type OpsStatus =
  | "IDLE"
  | "CAPTURE"
  | "PROCESSING"
  | "READY"
  | "REVIEW";

type StatusIndicatorProps = {
  status: OpsStatus;
  error?: string | null;
};

const STATUS_STYLES: Record<
  OpsStatus,
  {
    dotClassName: string;
    textClassName: string;
    description: string;
  }
> = {
  IDLE: {
    dotClassName: "bg-[var(--text-dim)] shadow-none",
    textClassName: "text-[var(--text-dim)]",
    description: "Ready for a source link.",
  },
  CAPTURE: {
    dotClassName: "bg-[var(--amber)]",
    textClassName: "text-[var(--amber)]",
    description: "Checking the submitted source.",
  },
  PROCESSING: {
    dotClassName: "bg-[var(--mint)]",
    textClassName: "text-[var(--mint)]",
    description: "Saving the media locally.",
  },
  READY: {
    dotClassName: "bg-[var(--mint-strong)]",
    textClassName: "text-[var(--mint-strong)]",
    description: "The file is ready in the archive.",
  },
  REVIEW: {
    dotClassName: "bg-[var(--danger)]",
    textClassName: "text-[var(--danger)]",
    description: "The last item needs attention.",
  },
};

export type { OpsStatus };
export type HeistStatus = OpsStatus;

export default function StatusIndicator({
  status,
  error,
}: StatusIndicatorProps) {
  const config = STATUS_STYLES[status];

  return (
    <div className="surface p-4">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${config.dotClassName}`} />
        <div>
          <p className={`font-mono-system text-xs ${config.textClassName}`}>
            {status}
          </p>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            {error ? error : config.description}
          </p>
        </div>
      </div>
    </div>
  );
}

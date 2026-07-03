"use client";

import type { DownloadStatus } from "@/types";

interface ProgressBarProps {
  progress: number;
  status: DownloadStatus;
}

const STATUS_FILL_CLASS: Record<DownloadStatus, string> = {
  pending: "bg-[rgba(122,255,193,0.32)]",
  downloading: "bg-[var(--neon)]",
  completed: "bg-[rgba(122,255,193,0.86)]",
  failed: "bg-[var(--danger)]",
};

export function ProgressBar({ progress, status }: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const isActive = status === "pending" || status === "downloading";

  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-label={`Download ${clampedProgress.toFixed(0)} percent complete`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedProgress}
        className="relative h-2.5 w-full overflow-hidden rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.045)]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 10px, transparent 10px 18px)",
          }}
        />

        <div
          className={`relative h-full rounded-full transition-[width] duration-500 ease-out ${STATUS_FILL_CLASS[status]}`}
          style={{ width: `${clampedProgress}%` }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(1,2,2,0.12) 0 8px, transparent 8px 16px)",
            }}
          />

          {isActive ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_linear_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent"
              style={{ backgroundSize: "200% 100%" }}
            />
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="font-mono-system text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
          Transfer Progress
        </span>
        <span className="font-mono-system text-xs uppercase tracking-[0.14em] text-[var(--text-neutral)]">
          {clampedProgress.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

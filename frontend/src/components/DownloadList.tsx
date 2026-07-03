"use client";

import type { DownloadRecord } from "@/types";
import { DownloadCard } from "./DownloadCard";

interface DownloadListProps {
  downloads: DownloadRecord[];
  isLoading: boolean;
  onRemove: (id: string) => Promise<void>;
  isHistoryEnabled: boolean;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="animate-pulse">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="h-3 w-28 rounded bg-[rgba(255,255,255,0.08)]" />
            <div className="mt-4 h-4 w-4/5 rounded bg-[rgba(255,255,255,0.08)]" />
            <div className="mt-3 flex gap-2">
              <div className="h-6 w-20 rounded-full bg-[rgba(255,255,255,0.08)]" />
              <div className="h-4 w-28 rounded bg-[rgba(255,255,255,0.08)]" />
            </div>
          </div>

          <div className="h-8 w-8 rounded-xl bg-[rgba(255,255,255,0.08)]" />
        </div>

        <div className="mt-4 rounded-xl border border-[var(--border-soft)] p-3">
          <div className="h-3 w-16 rounded bg-[rgba(255,255,255,0.08)]" />
          <div className="mt-3 h-3 w-full rounded bg-[rgba(255,255,255,0.06)]" />
          <div className="mt-4 h-3 w-1/2 rounded bg-[rgba(255,255,255,0.08)]" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ isHistoryEnabled }: { isHistoryEnabled: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] text-[var(--text-neutral)]">
        <svg
          className="h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.6}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-5-4 4m0 0-4-4m4 4V4"
          />
        </svg>
      </div>

      <p className="mt-4 text-sm font-medium text-[var(--text-neutral)]">
        {isHistoryEnabled ? "No Downloads Yet" : "No Guest Downloads"}
      </p>

      <h3 className="mt-2 text-base font-medium text-[var(--text-main)]">
        {isHistoryEnabled
          ? "Nothing has been downloaded yet"
          : "History is off in guest mode"}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
        {isHistoryEnabled
          ? "Paste a supported video URL above to start a download. Active and completed items will appear here."
          : "Paste a video URL to download without saving a history record. Sign in before downloading when you want links saved."}
      </p>
    </div>
  );
}

export function DownloadList({
  downloads,
  isLoading,
  onRemove,
  isHistoryEnabled,
}: DownloadListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (downloads.length === 0) {
    return <EmptyState isHistoryEnabled={isHistoryEnabled} />;
  }

  return (
    <section aria-label="Downloads">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-main)]">
            Recent downloads
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {isHistoryEnabled
              ? "Active, completed, and failed downloads are listed below."
              : "These guest downloads are temporary and are not saved to your account."}
          </p>
        </div>

        <span className="self-start font-mono-system text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)] sm:self-auto">
          {downloads.length} {downloads.length === 1 ? "Record" : "Records"}
        </span>
      </div>

      <div className="grid gap-3 pb-2 2xl:grid-cols-2">
        {downloads.map((download) => (
          <DownloadCard
            key={download.id}
            download={download}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
}

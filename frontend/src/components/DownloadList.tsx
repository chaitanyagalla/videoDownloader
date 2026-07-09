"use client";

import type { DownloadRecord } from "@/types";
import { DownloadCard } from "./DownloadCard";

interface DownloadListProps {
  downloads: DownloadRecord[];
  isLoading: boolean;
  onRemove: (id: string) => Promise<void>;
  onDownload: (id: string) => Promise<void>;
  isHistoryEnabled: boolean;
}

function SkeletonCard() {
  return (
    <div className="surface p-4">
      <div className="animate-pulse">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="h-5 w-28 rounded bg-[rgba(255,255,255,0.08)]" />
            <div className="mt-3 h-4 w-4/5 rounded bg-[rgba(255,255,255,0.07)]" />
            <div className="mt-3 h-7 w-48 rounded bg-[rgba(255,255,255,0.05)]" />
          </div>
          <div className="h-8 w-8 rounded-lg bg-[rgba(255,255,255,0.08)]" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ isHistoryEnabled }: { isHistoryEnabled: boolean }) {
  return (
    <div className="surface flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.04)] text-[var(--text-muted)]">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-5-4 4m0 0-4-4m4 4V4" />
        </svg>
      </div>

      <h3 className="mt-4 text-base font-semibold text-[var(--text-main)]">
        {isHistoryEnabled ? "Archive is empty" : "Guest workspace is empty"}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
        {isHistoryEnabled
          ? "Captured downloads will appear here with source links and saved files."
          : "Guest downloads stay here only until the page is refreshed."}
      </p>
    </div>
  );
}

export function DownloadList({
  downloads,
  isLoading,
  onRemove,
  onDownload,
  isHistoryEnabled,
}: DownloadListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
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
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Archive</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-main)]">
            Saved sources
          </h2>
        </div>

        <span className="self-start rounded-md border border-[var(--border-soft)] px-2.5 py-1 font-mono-system text-[11px] text-[var(--text-muted)] sm:self-auto">
          {downloads.length} {downloads.length === 1 ? "record" : "records"}
        </span>
      </div>

      <div className="grid gap-3">
        {downloads.map((download) => (
          <DownloadCard
            key={download.id}
            download={download}
            onRemove={onRemove}
            onDownload={onDownload}
          />
        ))}
      </div>
    </section>
  );
}

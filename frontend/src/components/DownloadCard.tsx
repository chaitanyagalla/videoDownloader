"use client";

import { useCallback, useMemo, useState } from "react";
import type { DownloadRecord } from "@/types";
import { PlatformBadge } from "./PlatformBadge";
import { ProgressBar } from "./ProgressBar";

interface DownloadCardProps {
  download: DownloadRecord;
  onRemove: (id: string) => Promise<void>;
  onDownload: (id: string) => Promise<void>;
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v10m0 0l4-4m-4 4l-4-4M5 20h14" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5M6 8.25V18h9.75" />
    </svg>
  );
}

function truncateSource(url: string, maxLength = 58): string {
  try {
    const parsedUrl = new URL(url);
    const compact = `${parsedUrl.hostname}${parsedUrl.pathname}`;
    return compact.length > maxLength
      ? `${compact.slice(0, maxLength)}...`
      : compact;
  } catch {
    return url.length > maxLength ? `${url.slice(0, maxLength)}...` : url;
  }
}

function formatTimestamp(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export function DownloadCard({
  download,
  onRemove,
  onDownload,
}: DownloadCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleRemove = useCallback(async () => {
    setIsRemoving(true);

    try {
      await onRemove(download.id);
    } finally {
      setIsRemoving(false);
    }
  }, [download.id, onRemove]);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);

    try {
      await onDownload(download.id);
    } finally {
      setIsDownloading(false);
    }
  }, [download.id, onDownload]);

  const displayTitle = useMemo(() => {
    return download.title?.trim() || "Preparing title...";
  }, [download.title]);

  const statusLabel = useMemo(() => {
    if (download.status === "completed") {
      return "download completed";
    }

    if (download.status === "downloading") {
      return "processing";
    }

    if (download.status === "pending") {
      return "queued";
    }

    return "failed";
  }, [download.status]);

  const canDownload = download.status === "completed" && Boolean(download.filePath);

  return (
    <article className="group surface min-w-0 overflow-hidden p-3.5 transition-colors hover:border-[var(--border-strong)] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PlatformBadge platform={download.platform} />
            <span className="font-mono-system text-[11px] text-[var(--text-dim)]">
              {formatTimestamp(download.createdAt)}
            </span>
            <span className="rounded-md border border-[var(--border-soft)] px-2 py-0.5 font-mono-system text-[10px] uppercase text-[var(--text-muted)]">
              {statusLabel}
            </span>
          </div>

          <h3 className="mt-3 text-base font-semibold leading-6 text-[var(--text-main)]">
            <span className="line-clamp-2 min-w-0 break-words" title={download.title ?? undefined}>
              {displayTitle}
            </span>
          </h3>

          <a
            href={download.url}
            target="_blank"
            rel="noopener noreferrer"
            title={download.url}
            className="mt-2 inline-flex max-w-full items-center gap-2 rounded-md border border-[var(--border-soft)] bg-[rgba(255,255,255,0.025)] px-2.5 py-1 font-mono-system text-[11px] text-[var(--text-muted)] transition-colors hover:border-[rgba(101,230,173,0.36)] hover:text-[var(--mint-strong)]"
          >
            <ExternalLinkIcon />
            <span className="truncate">{truncateSource(download.url)}</span>
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canDownload ? (
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={isDownloading}
              aria-label="Save completed file"
              className="rounded-lg border border-transparent p-2 text-[var(--mint-strong)] transition-colors hover:border-[rgba(101,230,173,0.36)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDownloading ? <SpinnerIcon /> : <DownloadIcon />}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={isRemoving}
            aria-label="Remove download"
            className="rounded-lg border border-transparent p-2 text-[var(--text-dim)] transition-colors hover:border-[var(--border)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRemoving ? <SpinnerIcon /> : <TrashIcon />}
          </button>
        </div>
      </div>

      {download.status === "pending" || download.status === "downloading" ? (
        <div className="mt-4">
          <ProgressBar progress={download.progress} status={download.status} />
          <div className="mt-2 flex flex-wrap gap-2 font-mono-system text-[11px] text-[var(--text-dim)]">
            {download.speed ? <span>{download.speed}</span> : null}
            {download.eta ? <span>ETA {download.eta}</span> : null}
          </div>
        </div>
      ) : null}

      {download.status === "completed" ? (
        <p className="mt-3 rounded-lg border border-[rgba(140,243,198,0.28)] bg-[rgba(101,230,173,0.08)] px-3 py-2 text-sm leading-6 text-[var(--mint-strong)]">
          Download completed
          {download.fileSize ? ` - ${download.fileSize}` : ""}
        </p>
      ) : null}

      {download.status === "failed" && download.errorMsg ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--danger)]">
          {download.errorMsg}
        </p>
      ) : null}
    </article>
  );
}

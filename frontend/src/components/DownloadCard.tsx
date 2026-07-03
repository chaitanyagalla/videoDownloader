"use client";

import { useCallback, useMemo, useState } from "react";
import type { DownloadRecord, DownloadStatus } from "@/types";
import { PlatformBadge } from "./PlatformBadge";
import { ProgressBar } from "./ProgressBar";

interface DownloadCardProps {
  download: DownloadRecord;
  onRemove: (id: string) => Promise<void>;
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

function FileIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2Z" />
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

type StatusPresentation = {
  label: string;
  summary: string;
  toneClassName: string;
  badgeClassName: string;
  dotClassName: string;
};

const STATUS_PRESENTATION: Record<DownloadStatus, StatusPresentation> = {
  pending: {
    label: "Queued",
    summary: "Waiting to process",
    toneClassName: "text-[var(--amber)]",
    badgeClassName: "border-[rgba(229,181,103,0.34)] bg-[rgba(229,181,103,0.09)]",
    dotClassName: "bg-[var(--amber)]",
  },
  downloading: {
    label: "Processing",
    summary: "Saving media",
    toneClassName: "text-[var(--mint)]",
    badgeClassName: "border-[rgba(101,230,173,0.36)] bg-[rgba(101,230,173,0.1)]",
    dotClassName: "bg-[var(--mint)]",
  },
  completed: {
    label: "Ready",
    summary: "Saved locally",
    toneClassName: "text-[var(--mint-strong)]",
    badgeClassName: "border-[rgba(140,243,198,0.34)] bg-[rgba(140,243,198,0.1)]",
    dotClassName: "bg-[var(--mint-strong)]",
  },
  failed: {
    label: "Review",
    summary: "Needs attention",
    toneClassName: "text-[var(--danger)]",
    badgeClassName: "border-[rgba(255,107,127,0.36)] bg-[rgba(255,107,127,0.1)]",
    dotClassName: "bg-[var(--danger)]",
  },
};

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

function getFileName(filePath: string | null | undefined): string | null {
  if (!filePath) {
    return null;
  }

  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export function DownloadCard({ download, onRemove }: DownloadCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = useCallback(async () => {
    setIsRemoving(true);

    try {
      await onRemove(download.id);
    } finally {
      setIsRemoving(false);
    }
  }, [download.id, onRemove]);

  const status = STATUS_PRESENTATION[download.status];
  const fileName = useMemo(() => getFileName(download.filePath), [download.filePath]);
  const displayTitle = useMemo(() => {
    return download.title?.trim() || truncateSource(download.url);
  }, [download.title, download.url]);
  const showTransfer = download.status === "pending" || download.status === "downloading";
  const progressValue = Math.max(0, Math.min(100, download.progress));

  return (
    <article className="group surface min-w-0 overflow-hidden p-3.5 transition-colors hover:border-[var(--border-strong)] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono-system text-[11px] ${status.badgeClassName} ${status.toneClassName}`}>
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.dotClassName}`} />
              {status.label}
            </span>
            <PlatformBadge platform={download.platform} />
            <span className="font-mono-system text-[11px] text-[var(--text-dim)]">
              {formatTimestamp(download.createdAt)}
            </span>
          </div>

          <h3 className="mt-3 text-base font-semibold leading-6 text-[var(--text-main)]">
            <a
              href={download.url}
              target="_blank"
              rel="noopener noreferrer"
              title={download.url}
              className="inline-flex max-w-full items-start gap-2 transition-colors hover:text-[var(--mint-strong)]"
            >
              <span className="line-clamp-2 min-w-0 break-words">{displayTitle}</span>
              <span className="mt-1 shrink-0 text-[var(--mint)]">
                <ExternalLinkIcon />
              </span>
            </a>
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

        <button
          type="button"
          onClick={() => void handleRemove()}
          disabled={isRemoving}
          aria-label="Remove download"
          className="shrink-0 rounded-lg border border-transparent p-2 text-[var(--text-dim)] transition-colors hover:border-[var(--border)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRemoving ? <SpinnerIcon /> : <TrashIcon />}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem] lg:items-start">
        <div className="surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono-system text-[11px] text-[var(--text-dim)]">
                Status
              </p>
              <p className={`mt-1 text-sm font-medium ${status.toneClassName}`}>
                {status.summary}
              </p>
            </div>
            <div className="text-left lg:text-right">
              <p className="font-mono-system text-[11px] text-[var(--text-dim)]">
                Progress
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--text-soft)]">
                {progressValue.toFixed(1)}%
              </p>
            </div>
          </div>

          {showTransfer ? (
            <div className="mt-3">
              <ProgressBar progress={download.progress} status={download.status} />
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--text-muted)]">
                {download.speed ? <span>{download.speed}</span> : null}
                {download.eta ? <span>ETA {download.eta}</span> : null}
              </div>
            </div>
          ) : null}

          {download.status === "failed" && download.errorMsg ? (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--danger)]">
              {download.errorMsg}
            </p>
          ) : null}
        </div>

        <div className="surface p-3">
          <p className="font-mono-system text-[11px] text-[var(--text-dim)]">
            Output
          </p>
          {fileName ? (
            <div className="mt-2 flex min-w-0 items-start gap-2">
              <span className="mt-0.5 shrink-0 text-[var(--mint)]">
                <FileIcon />
              </span>
              <div className="min-w-0">
                <p className="line-clamp-2 break-words text-sm font-medium leading-5 text-[var(--text-main)]" title={download.filePath ?? ""}>
                  {fileName}
                </p>
                {download.fileSize ? (
                  <p className="mt-1 font-mono-system text-[11px] text-[var(--text-muted)]">
                    {download.fileSize}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--text-muted)]">Not saved yet</p>
          )}
        </div>
      </div>
    </article>
  );
}

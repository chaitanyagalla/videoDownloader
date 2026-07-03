"use client";

import { useCallback, useMemo, useState, type ReactElement } from "react";
import type { DownloadRecord, DownloadStatus } from "@/types";
import { PlatformBadge } from "./PlatformBadge";
import { ProgressBar } from "./ProgressBar";

interface DownloadCardProps {
  download: DownloadRecord;
  onRemove: (id: string) => Promise<void>;
}

function SpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4Z"
      />
    </svg>
  );
}

function DownloadingIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-5-4 4m0 0-4-4m4 4V4"
      />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="m9 12 2 2 4-4m6 2A9 9 0 111 12a9 9 0 0118 0Z"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="m10 14 2-2m0 0 2-2m-2 2-2-2m2 2 2 2m7-2A9 9 0 111 12a9 9 0 0118 0Z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2Z"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5M6 8.25V18h9.75"
      />
    </svg>
  );
}

type StatusPresentation = {
  label: string;
  shortLabel: string;
  summary: string;
  toneClassName: string;
  badgeClassName: string;
  panelClassName: string;
  icon: ReactElement;
};

const STATUS_PRESENTATION: Record<DownloadStatus, StatusPresentation> = {
  pending: {
    label: "Preparing",
    shortLabel: "Queued",
    summary: "Checking the link and preparing the download.",
    toneClassName: "text-[var(--text-main)]",
    badgeClassName:
      "border-[rgba(122,255,193,0.22)] bg-[rgba(122,255,193,0.12)] text-[var(--text-main)]",
    panelClassName:
      "border-[rgba(122,255,193,0.18)] bg-[rgba(122,255,193,0.05)]",
    icon: <SpinnerIcon />,
  },
  downloading: {
    label: "Downloading",
    shortLabel: "In Progress",
    summary: "The video is being downloaded right now.",
    toneClassName: "text-[var(--text-main)]",
    badgeClassName:
      "border-[rgba(0,255,159,0.26)] bg-[rgba(0,255,159,0.12)] text-[var(--text-main)]",
    panelClassName:
      "border-[rgba(0,255,159,0.22)] bg-[rgba(0,255,159,0.055)]",
    icon: <DownloadingIcon />,
  },
  completed: {
    label: "Completed",
    shortLabel: "Completed",
    summary: "The file was saved successfully to your device.",
    toneClassName: "text-[var(--text-main)]",
    badgeClassName:
      "border-[rgba(122,255,193,0.3)] bg-[rgba(0,201,122,0.72)] text-white",
    panelClassName:
      "border-[rgba(122,255,193,0.24)] bg-[rgba(122,255,193,0.07)]",
    icon: <SuccessIcon />,
  },
  failed: {
    label: "Failed",
    shortLabel: "Failed",
    summary: "The download stopped before finishing. Review the error below.",
    toneClassName: "text-[var(--danger)]",
    badgeClassName:
      "border-[rgba(255,77,109,0.26)] bg-[rgba(255,77,109,0.08)] text-[var(--danger)]",
    panelClassName:
      "border-[rgba(255,77,109,0.24)] bg-[rgba(255,77,109,0.06)]",
    icon: <ErrorIcon />,
  },
};

function truncateSource(url: string, maxLength = 64): string {
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
  }).format(new Date(isoDate));
}

function getFileName(filePath: string | null | undefined): string | null {
  if (!filePath) {
    return null;
  }

  const extracted = filePath.split(/[\\/]/).pop();
  return extracted ?? filePath;
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

  const statusPresentation = STATUS_PRESENTATION[download.status];
  const fileName = useMemo(() => getFileName(download.filePath), [download.filePath]);

  const displayTitle = useMemo(() => {
    return download.title?.trim() || truncateSource(download.url);
  }, [download.title, download.url]);

  const showProgress =
    download.status === "pending" || download.status === "downloading";
  const progressValue = Math.max(0, Math.min(100, download.progress));

  return (
    <article
      className={`group min-w-0 overflow-hidden rounded-[1.35rem] border p-3.5 transition-all duration-200 hover:border-[var(--border-strong)] sm:p-4 ${statusPresentation.panelClassName}`}
    >
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 font-mono-system text-[10px] uppercase tracking-[0.18em] ${statusPresentation.badgeClassName}`}
            >
              {statusPresentation.icon}
              {statusPresentation.shortLabel}
            </span>

            <p className="font-mono-system text-[10px] uppercase tracking-[0.14em] text-[var(--text-dim)] sm:text-[11px] sm:tracking-[0.16em]">
              {formatTimestamp(download.createdAt)}
            </p>

            <PlatformBadge platform={download.platform} />
          </div>

          <h3 className="mt-2 text-[15px] font-medium leading-6 text-[var(--text-main)] sm:text-base">
            <a
              href={download.url}
              target="_blank"
              rel="noopener noreferrer"
              title={download.url}
              className="inline-flex max-w-full items-start gap-2 break-words transition-colors hover:text-[var(--neon-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(122,255,193,0.45)]"
            >
              <span className="line-clamp-2 min-w-0 break-words">
                {displayTitle}
              </span>
              <span className="mt-1 shrink-0 text-[var(--neon-soft)]">
                <ExternalLinkIcon />
              </span>
            </a>
          </h3>

          {download.title?.trim() ? (
            <a
              href={download.url}
              target="_blank"
              rel="noopener noreferrer"
              title={download.url}
              className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-full border border-[rgba(122,255,193,0.14)] bg-[rgba(255,255,255,0.025)] px-2.5 py-1 font-mono-system text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)] transition-colors hover:border-[rgba(122,255,193,0.3)] hover:text-[var(--neon-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(122,255,193,0.45)]"
            >
              <ExternalLinkIcon />
              <span className="min-w-0 truncate">
                {truncateSource(download.url, 52)}
              </span>
            </a>
          ) : null}

          <p className="mt-1.5 break-words text-sm leading-6 text-[var(--text-neutral)]">
            {statusPresentation.summary}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleRemove()}
          disabled={isRemoving}
          aria-label="Remove download"
          className="shrink-0 rounded-xl border border-transparent p-2 text-[var(--text-dim)] opacity-100 transition-all hover:border-[var(--border-soft)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-50 xl:opacity-0 xl:group-hover:opacity-100"
        >
          {isRemoving ? <SpinnerIcon /> : <TrashIcon />}
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.028)_0%,rgba(0,0,0,0.16)_100%)] p-3">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <div>
            <p className="font-mono-system text-[11px] uppercase tracking-[0.14em] text-[var(--text-dim)]">
              Status
            </p>
            <p className={`mt-1 text-sm font-medium ${statusPresentation.toneClassName}`}>
              {statusPresentation.label}
            </p>
          </div>

          <div className="md:text-right">
            <p className="font-mono-system text-[11px] uppercase tracking-[0.14em] text-[var(--text-dim)]">
              Progress
            </p>
            <p className={`mt-1 text-sm font-medium ${statusPresentation.toneClassName}`}>
              {progressValue.toFixed(1)}%
            </p>
          </div>
        </div>

        {showProgress ? (
          <div className="mt-4">
            <ProgressBar progress={download.progress} status={download.status} />

            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
                <p className="font-mono-system text-[10px] uppercase tracking-[0.14em] text-[var(--text-dim)]">
                  Stage
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--text-neutral)]">
                  {download.status === "pending"
                    ? "Preparing file"
                    : "Downloading file"}
                </p>
              </div>

              <div className="rounded-lg border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
                <p className="font-mono-system text-[10px] uppercase tracking-[0.14em] text-[var(--text-dim)]">
                  Timing
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--text-neutral)]">
                  {download.eta
                    ? `ETA ${download.eta}`
                    : download.speed ?? "Updating"}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {download.status === "completed" && fileName ? (
          <div className="mt-4 rounded-xl border border-[rgba(122,255,193,0.2)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(122,255,193,0.035)_100%)] p-3.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgba(122,255,193,0.18)] bg-[rgba(255,255,255,0.04)] text-[var(--neon-soft)]">
                  <FileIcon />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-mono-system text-[11px] uppercase tracking-[0.18em] text-[var(--neon-soft)]">
                    Output Ready
                  </p>
                  <p
                    className="mt-2 break-words text-sm font-medium text-[var(--text-main)]"
                    title={download.filePath ?? ""}
                  >
                    {fileName}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-neutral)]">
                    Download completed and saved locally.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[rgba(122,255,193,0.16)] bg-[rgba(255,255,255,0.035)] px-2.5 py-1 font-mono-system text-[10px] uppercase tracking-[0.14em] text-[var(--text-neutral)]">
                      Saved File
                    </span>
                    {download.fileSize ? (
                      <span className="rounded-full border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 font-mono-system text-[10px] uppercase tracking-[0.14em] text-[var(--text-neutral)]">
                        {download.fileSize}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <span className="w-fit shrink-0 self-start rounded-full border border-[rgba(122,255,193,0.18)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 font-mono-system text-[10px] uppercase tracking-[0.16em] text-[var(--neon-soft)] lg:self-auto">
                Ready
              </span>
            </div>
          </div>
        ) : null}

        {download.status === "failed" && download.errorMsg ? (
          <div className="mt-4 rounded-xl border border-[rgba(255,77,109,0.22)] bg-[rgba(255,77,109,0.05)] p-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-[var(--danger)]">
                <ErrorIcon />
              </span>

              <div>
                <p className="font-mono-system text-[11px] uppercase tracking-[0.18em] text-[var(--danger)]">
                  Error Details
                </p>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-main)]">
                  {download.errorMsg}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

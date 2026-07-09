"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/core/Navbar";
import { type OpsStatus } from "@/components/heist/StatusIndicator";
import { CompletionToast, type Celebration } from "@/components/CompletionToast";
import { DownloadList } from "@/components/DownloadList";
import { PlatformBadge } from "@/components/PlatformBadge";
import { ProgressBar } from "@/components/ProgressBar";
import { URLInput } from "@/components/URLInput";
import Panel from "@/components/ui/Panel";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardMotion } from "@/hooks/useDashboardMotion";
import { useDownload } from "@/hooks/useDownload";
import type { DownloadRecord } from "@/types";

function sortDownloadsByNewest(downloads: DownloadRecord[]): DownloadRecord[] {
  return [...downloads].sort((left, right) => {
    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
}

function getCurrentOpsStatus(params: {
  isSubmitting: boolean;
  error: string | null;
  activeDownload: DownloadRecord | null;
  focusedDownload: DownloadRecord | null;
}): OpsStatus {
  const { isSubmitting, error, activeDownload, focusedDownload } = params;

  if (isSubmitting) {
    return "CAPTURE";
  }

  if (activeDownload) {
    return "PROCESSING";
  }

  if (focusedDownload?.status === "completed") {
    return "READY";
  }

  if (error || focusedDownload?.status === "failed") {
    return "REVIEW";
  }

  return "IDLE";
}

function getDisplayLabel(download: DownloadRecord | null): string | null {
  if (!download) {
    return null;
  }

  return download.title?.trim() || download.url;
}

function truncateSource(url: string, maxLength = 52): string {
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

function ExternalLinkIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5M6 8.25V18h9.75" />
    </svg>
  );
}

function ProcessingPanel({
  download,
  error,
  status,
}: {
  download: DownloadRecord | null;
  error: string | null;
  status: OpsStatus;
}) {
  const progress = download ? Math.max(0, Math.min(100, download.progress)) : 0;

  const statusLabel =
    status === "CAPTURE"
      ? "Capturing"
      : status === "PROCESSING"
      ? "Processing"
      : status === "READY"
      ? "Download completed"
      : status === "REVIEW"
      ? "Review"
      : "Idle";

  const statusClassName =
    status === "REVIEW"
      ? "text-[var(--danger)]"
      : status === "CAPTURE"
      ? "text-[var(--amber)]"
      : status === "IDLE"
      ? "text-[var(--text-muted)]"
      : "text-[var(--mint-strong)]";

  return (
    <Panel
      variant="support"
      title="Processing"
      subtitle="Live state from the current source."
      className="h-full"
    >
      <div className="surface-strong min-h-[22rem] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`rounded-md border border-[var(--border)] px-2.5 py-1 font-mono-system text-xs ${statusClassName}`}>
            {statusLabel}
          </span>
          <span className="font-mono-system text-xs text-[var(--text-dim)]">
            {progress.toFixed(1)}%
          </span>
        </div>

        {download ? (
          <div className="mt-5">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge platform={download.platform} />
              <a
                href={download.url}
                target="_blank"
                rel="noopener noreferrer"
                title={download.url}
                className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-[var(--border-soft)] px-2.5 py-1 font-mono-system text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--mint-strong)]"
              >
                <ExternalLinkIcon />
                <span className="truncate">{truncateSource(download.url)}</span>
              </a>
            </div>

            <h3 className="mt-4 line-clamp-2 break-words text-xl font-semibold leading-7 text-[var(--text-main)]">
              {getDisplayLabel(download)}
            </h3>

            <div className="mt-5">
              <ProgressBar progress={download.progress} status={download.status} />
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--text-muted)]">
                {download.speed ? <span>{download.speed}</span> : null}
                {download.eta ? <span>ETA {download.eta}</span> : null}
              </div>
            </div>

            {download.status === "completed" ? (
              <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-[rgba(140,243,198,0.28)] bg-[rgba(101,230,173,0.08)] p-3 text-sm leading-6 text-[var(--mint-strong)]">
                <svg className="h-4 w-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                </svg>
                <span>
                  Download completed
                  {download.fileSize ? ` - ${download.fileSize}` : ""}
                </span>
              </div>
            ) : null}

            {download.status === "failed" && download.errorMsg ? (
              <p className="mt-4 rounded-lg border border-[rgba(255,107,127,0.3)] bg-[rgba(255,107,127,0.08)] p-3 text-sm leading-6 text-[var(--danger)]">
                {download.errorMsg}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-8">
            <h3 className="text-2xl font-semibold leading-8 text-[var(--text-main)]">
              {status === "CAPTURE"
                ? "Starting download..."
                : status === "REVIEW"
                  ? "Needs review."
                  : "Ready for a source."}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              {status === "CAPTURE"
                ? "The job is being created. Progress will appear here as soon as the transfer starts."
                : "The next captured link will appear here with transfer progress."}
            </p>
            {error ? (
              <p className="mt-4 rounded-lg border border-[rgba(255,107,127,0.3)] bg-[rgba(255,107,127,0.08)] p-3 text-sm leading-6 text-[var(--danger)]">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Panel>
  );
}

export default function HomePage() {
  const auth = useAuth();
  const historyKey = auth.isLoading ? "auth-loading" : auth.user?.id ?? "guest";
  const isHistoryEnabled = Boolean(auth.user);

  const {
    downloads,
    isLoading,
    isSubmitting,
    error,
    addDownload,
    removeDownload,
    saveDownloadFile,
  } = useDownload({
    enabled: !auth.isLoading,
    historyKey,
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const previousStatusRef = useRef<Map<string, DownloadRecord["status"]>>(
    new Map()
  );

  const sortedDownloads = useMemo(() => {
    return sortDownloadsByNewest(downloads);
  }, [downloads]);

  const activeDownload = useMemo(() => {
    return (
      sortedDownloads.find(
        (download) =>
          download.status === "pending" || download.status === "downloading"
      ) ?? null
    );
  }, [sortedDownloads]);

  // Keep the panel meaningful after a transfer finishes: fall back to the most
  // recent record instead of blanking out.
  const focusedDownload = activeDownload ?? sortedDownloads[0] ?? null;

  const currentStatus = getCurrentOpsStatus({
    isSubmitting,
    error,
    activeDownload,
    focusedDownload,
  });

  // Fire a celebratory toast whenever a download transitions into "completed".
  useEffect(() => {
    const previousStatus = previousStatusRef.current;

    for (const download of downloads) {
      const prior = previousStatus.get(download.id);
      if (
        prior &&
        prior !== "completed" &&
        download.status === "completed"
      ) {
        setCelebration({
          id: download.id,
          title: download.title?.trim() || download.url,
          fileSize: download.fileSize,
        });
      }
    }

    previousStatusRef.current = new Map(
      downloads.map((download) => [download.id, download.status])
    );
  }, [downloads]);

  useDashboardMotion({
    rootRef,
    status: currentStatus,
  });

  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      <Navbar
        user={auth.user}
        isAuthLoading={auth.isLoading}
        isSigningOut={auth.isSigningOut}
        onSignIn={auth.signIn}
        onSignOut={auth.signOut}
      />

      <div
        ref={rootRef}
        className="relative z-10 mx-auto w-full max-w-[1440px] px-3 py-4 pb-10 sm:px-5 sm:py-5 sm:pb-12 md:px-6 lg:px-8"
      >
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(320px,0.72fr)]">
          <div data-motion="hero" data-ops-reactive="true">
            <Panel
              variant="feature"
              title="Workbench"
              subtitle="Capture a source, track the transfer, and keep the archive close."
              className="h-full sm:p-6 lg:p-7"
            >
              <URLInput onSubmit={addDownload} isSubmitting={isSubmitting} />
            </Panel>
          </div>

          <div data-motion="left-panel" data-ops-reactive="true">
            <ProcessingPanel
              download={focusedDownload}
              error={error}
              status={currentStatus}
            />
          </div>
        </section>

        <section className="mt-5">
          <div data-motion="archive" data-ops-reactive="true">
            <Panel
              variant="archive"
              title={isHistoryEnabled ? "Archive" : "Guest Archive"}
              subtitle={
                isHistoryEnabled
                  ? "Saved source links."
                  : "Temporary downloads for this browser session."
              }
            >
              <DownloadList
                downloads={sortedDownloads}
                isLoading={isLoading}
                onRemove={removeDownload}
                onDownload={saveDownloadFile}
                isHistoryEnabled={isHistoryEnabled}
              />
            </Panel>
          </div>
        </section>
      </div>

      <CompletionToast
        celebration={celebration}
        onDismiss={() => setCelebration(null)}
      />
    </main>
  );
}

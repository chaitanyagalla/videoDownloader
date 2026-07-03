"use client";

import { useMemo, useRef } from "react";
import Navbar from "@/components/core/Navbar";
import TerminalLogs from "@/components/heist/TerminalLogs";
import { type OpsStatus } from "@/components/heist/StatusIndicator";
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
  latestDownload: DownloadRecord | null;
}): OpsStatus {
  const { isSubmitting, error, activeDownload, latestDownload } = params;

  if (isSubmitting) {
    return "CAPTURE";
  }

  if (activeDownload) {
    return "PROCESSING";
  }

  if (latestDownload?.status === "completed") {
    return "READY";
  }

  if (latestDownload?.status === "failed" || error) {
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

function getLogStatusLabel(status: DownloadRecord["status"]): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "downloading":
      return "Processing";
    case "completed":
      return "Ready";
    case "failed":
      return "Review";
    default:
      return status;
  }
}

function truncateForLog(value: string, maxLength = 68): string {
  if (value.length <= maxLength) {
    return value;
  }

  const headLength = Math.max(28, Math.floor(maxLength * 0.6));
  const tailLength = Math.max(12, maxLength - headLength - 3);
  return `${value.slice(0, headLength)}...${value.slice(-tailLength)}`;
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

function getFileName(filePath: string | null | undefined): string | null {
  if (!filePath) {
    return null;
  }

  return filePath.split(/[\\/]/).pop() ?? filePath;
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
  const fileName = getFileName(download?.filePath);
  const progress = download ? Math.max(0, Math.min(100, download.progress)) : 0;

  const statusLabel =
    status === "CAPTURE"
      ? "Capturing"
      : status === "PROCESSING"
      ? "Processing"
      : status === "READY"
      ? "Ready"
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
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <div className="surface p-3">
                <p className="font-mono-system text-[11px] text-[var(--text-dim)]">
                  Stage
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--text-soft)]">
                  {getLogStatusLabel(download.status)}
                </p>
              </div>
              <div className="surface p-3">
                <p className="font-mono-system text-[11px] text-[var(--text-dim)]">
                  Timing
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--text-soft)]">
                  {download.eta ? `ETA ${download.eta}` : download.speed ?? "Stable"}
                </p>
              </div>
              <div className="surface p-3">
                <p className="font-mono-system text-[11px] text-[var(--text-dim)]">
                  Output
                </p>
                <p className="mt-1 line-clamp-2 break-words text-sm font-medium text-[var(--text-soft)]">
                  {fileName ?? "Pending"}
                </p>
              </div>
            </div>

            {download.status === "failed" && download.errorMsg ? (
              <p className="mt-4 rounded-lg border border-[rgba(255,107,127,0.3)] bg-[rgba(255,107,127,0.08)] p-3 text-sm leading-6 text-[var(--danger)]">
                {download.errorMsg}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-8">
            <h3 className="text-2xl font-semibold leading-8 text-[var(--text-main)]">
              Ready for a source.
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              The next captured link will appear here with transfer progress,
              file output, and source access.
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
  } = useDownload({
    enabled: !auth.isLoading,
    historyKey,
  });

  const rootRef = useRef<HTMLDivElement>(null);

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

  const latestDownload = sortedDownloads[0] ?? null;
  const focusedDownload = activeDownload ?? latestDownload;

  const currentStatus = getCurrentOpsStatus({
    isSubmitting,
    error,
    activeDownload,
    latestDownload,
  });

  useDashboardMotion({
    rootRef,
    status: currentStatus,
  });

  const terminalLogs = useMemo(() => {
    const logs: string[] = ["VideoSave ready."];

    if (auth.error) {
      logs.push(`Account: ${auth.error}`);
    } else {
      logs.push(isHistoryEnabled ? "Archive sync enabled." : "Guest workspace.");
    }

    switch (currentStatus) {
      case "CAPTURE":
        logs.push("Source received.");
        logs.push("Validating link.");
        break;

      case "PROCESSING":
        logs.push("Source confirmed.");
        logs.push("Transfer in progress.");
        break;

      case "READY":
        logs.push("File saved.");
        logs.push("Archive updated.");
        break;

      case "REVIEW":
        logs.push("Download needs review.");
        logs.push(error ?? "Check the item details.");
        break;

      default:
        logs.push("Waiting for source.");
        break;
    }

    if (focusedDownload) {
      const label = getDisplayLabel(focusedDownload);

      if (label) {
        logs.push(`Item: ${truncateForLog(label)}`);
      }

      logs.push(`Platform: ${focusedDownload.platform}`);

      if (
        focusedDownload.status === "pending" ||
        focusedDownload.status === "downloading"
      ) {
        logs.push(`Progress: ${focusedDownload.progress.toFixed(1)}%`);
      }

      if (focusedDownload.speed) {
        logs.push(`Speed: ${focusedDownload.speed}`);
      }

      if (focusedDownload.eta) {
        logs.push(`ETA: ${focusedDownload.eta}`);
      }

      if (focusedDownload.fileSize) {
        logs.push(`File size: ${focusedDownload.fileSize}`);
      }

      if (focusedDownload.status === "completed" && focusedDownload.filePath) {
        logs.push(`Saved: ${truncateForLog(focusedDownload.filePath)}`);
      }

      if (focusedDownload.status === "failed" && focusedDownload.errorMsg) {
        logs.push(`Error: ${truncateForLog(focusedDownload.errorMsg)}`);
      }
    }

    if (sortedDownloads.length > 0) {
      logs.push("Recent archive:");

      sortedDownloads.slice(0, 3).forEach((download) => {
        const label = getDisplayLabel(download) ?? download.url;
        logs.push(`${getLogStatusLabel(download.status)}: ${truncateForLog(label)}`);
      });
    }

    return logs;
  }, [
    auth.error,
    currentStatus,
    error,
    focusedDownload,
    isHistoryEnabled,
    sortedDownloads,
  ]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      <Navbar
        statusLabel={currentStatus}
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

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <div data-motion="archive" data-ops-reactive="true">
            <Panel
              variant="archive"
              title={isHistoryEnabled ? "Archive" : "Guest Archive"}
              subtitle={
                isHistoryEnabled
                  ? "Saved sources, local outputs, and source links."
                  : "Temporary downloads for this browser session."
              }
            >
              <DownloadList
                downloads={sortedDownloads}
                isLoading={isLoading}
                onRemove={removeDownload}
                isHistoryEnabled={isHistoryEnabled}
              />
            </Panel>
          </div>

          <aside data-motion="terminal" data-ops-reactive="true">
            <Panel
              variant="support"
              title="Activity"
              subtitle="Compact event stream."
              className="h-full"
            >
              <TerminalLogs logs={terminalLogs} compact />
            </Panel>
          </aside>
        </section>
      </div>
    </main>
  );
}

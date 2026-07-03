"use client";

import { useMemo, useRef } from "react";
import Navbar from "@/components/core/Navbar";
import { type HeistStatus } from "@/components/heist/StatusIndicator";
import TerminalLogs from "@/components/heist/TerminalLogs";
import { URLInput } from "@/components/URLInput";
import { DownloadList } from "@/components/DownloadList";
import Panel from "@/components/ui/Panel";
import { useAuth } from "@/hooks/useAuth";
import { useDownload } from "@/hooks/useDownload";
import { useDashboardMotion } from "@/hooks/useDashboardMotion";
import type { DownloadRecord } from "@/types";

function sortDownloadsByNewest(downloads: DownloadRecord[]): DownloadRecord[] {
  return [...downloads].sort((left, right) => {
    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
}

function getCurrentMissionStatus(params: {
  isSubmitting: boolean;
  error: string | null;
  activeDownload: DownloadRecord | null;
  latestDownload: DownloadRecord | null;
}): HeistStatus {
  const { isSubmitting, error, activeDownload, latestDownload } = params;

  if (isSubmitting) {
    return "LOCKING TARGET";
  }

  if (activeDownload) {
    return "DOWNLOADING";
  }

  if (latestDownload?.status === "completed") {
    return "MISSION COMPLETED";
  }

  if (latestDownload?.status === "failed") {
    return "MISSION FAILED";
  }

  if (error) {
    return "MISSION FAILED";
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
      return "Downloading";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
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

  const currentStatus = getCurrentMissionStatus({
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
    const logs: string[] = [
      "System ready.",
      "Waiting for a video link.",
    ];

    if (auth.error) {
      logs.push(`Account: ${auth.error}`);
    } else {
      logs.push(
        isHistoryEnabled
          ? "History sync enabled."
          : "Guest mode: history off."
      );
    }

    switch (currentStatus) {
      case "IDLE":
        break;

      case "LOCKING TARGET":
        logs.push("Link received.");
        logs.push("Checking the source...");
        logs.push("Preparing the download...");
        break;

      case "DOWNLOADING":
        logs.push("Source confirmed.");
        logs.push("Downloading video data...");
        logs.push("Saving the file locally...");
        break;

      case "MISSION COMPLETED":
        logs.push("Download finished successfully.");
        logs.push("The file is ready on your device.");
        break;

      case "MISSION FAILED":
        logs.push("The download could not be completed.");
        logs.push(error ?? "Something went wrong during extraction.");
        break;

      default:
        break;
    }

    if (focusedDownload) {
      const label = getDisplayLabel(focusedDownload);

      if (label) {
        logs.push(`Current item: ${truncateForLog(label)}`);
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
        logs.push(`Saved to: ${truncateForLog(focusedDownload.filePath)}`);
      }

      if (focusedDownload.status === "failed" && focusedDownload.errorMsg) {
        logs.push(`Error details: ${truncateForLog(focusedDownload.errorMsg)}`);
      }
    }

    if (sortedDownloads.length > 0) {
      logs.push("Recent downloads:");

      sortedDownloads.slice(0, 3).forEach((download) => {
        const label = getDisplayLabel(download) ?? download.url;
        logs.push(
          `${getLogStatusLabel(download.status)}: ${truncateForLog(label)}`
        );
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
        <section className="mb-6">
          <Panel
            variant="feature"
            className="sm:p-6 lg:p-8"
            title="Download Console"
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(18rem,0.88fr)] xl:items-start xl:gap-6 2xl:grid-cols-[minmax(520px,1.16fr)_minmax(0,0.84fr)]">
              <div data-motion="hero" data-mission-reactive="true">
                <div className="rounded-[1.55rem] border border-[rgba(176,200,188,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
                  <URLInput onSubmit={addDownload} isSubmitting={isSubmitting} />
                </div>
              </div>

              <div className="max-w-full xl:max-w-[30rem] xl:pt-2 2xl:max-w-[28rem]">
                <p data-motion="hero" className="section-label">
                  Start Here
                </p>
                <h2
                  data-motion="hero"
                  data-hero-title="true"
                  className="mt-3 max-w-[12ch] text-[clamp(1.55rem,1.18rem+0.95vw,2.25rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-[var(--text-neutral)]"
                >
                  Paste a video URL and save it locally.
                </h2>
                <p
                  data-motion="hero"
                  className="body-text mt-4 max-w-[42ch] text-[var(--text-neutral)]"
                >
                  Use a YouTube, Instagram, or X link. The app detects the
                  source, downloads the file, and shows progress below.
                </p>

                <div data-motion="hero" className="mt-5 grid gap-2.5 sm:mt-6 sm:gap-3">
                  {[
                    {
                      label: "Supported links",
                      value: "Works with YouTube, Instagram, and X video URLs.",
                    },
                    {
                      label: isHistoryEnabled ? "History enabled" : "Guest mode",
                      value: isHistoryEnabled
                        ? "Completed links are saved to your account history."
                        : "Downloads work without an account; history is not saved.",
                    },
                    {
                      label: "Saved automatically",
                      value: "Finished files appear in your Downloads folder.",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.022)] px-4 py-3"
                    >
                      <p className="text-sm font-medium text-[var(--text-main)]">
                        {item.label}
                      </p>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--text-muted)]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <section className="mt-5 grid gap-5 sm:mt-6 sm:gap-6 xl:grid-cols-[minmax(0,1.58fr)_minmax(18rem,0.8fr)] 2xl:grid-cols-[minmax(0,1.72fr)_300px]">
          <div data-motion="archive" data-mission-reactive="true">
            <Panel
              variant="archive"
              title={isHistoryEnabled ? "Download History" : "Downloads"}
              subtitle={
                isHistoryEnabled
                  ? "Your signed-in links and active downloads are listed here."
                  : "Guest downloads stay on this screen only and are not saved."
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

          <aside data-motion="terminal" data-mission-reactive="true">
            <Panel
              variant="support"
              title="Activity Log"
              subtitle="Live details from the current download."
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

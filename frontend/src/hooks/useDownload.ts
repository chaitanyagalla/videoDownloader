// src/hooks/useDownload.ts
"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  fetchDownloads,
  fetchDownloadById,
  startDownload,
  deleteDownload,
  downloadFile,
  ApiClientError,
} from "@/lib/api";
import { useSocket } from "./useSocket";
import { DownloadRecord } from "@/types";

interface UseDownloadReturn {
  downloads: DownloadRecord[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  addDownload: (url: string) => Promise<void>;
  removeDownload: (id: string) => Promise<void>;
  saveDownloadFile: (id: string) => Promise<void>;
  clearError: () => void;
}

type UseDownloadOptions = {
  enabled?: boolean;
  historyKey?: string;
};

const STATUS_POLL_INTERVAL_MS = 2500;

function isActiveDownload(download: DownloadRecord): boolean {
  return download.status === "pending" || download.status === "downloading";
}

function mergeDownloadRecord(
  current: DownloadRecord,
  snapshot: DownloadRecord
): DownloadRecord {
  const currentIsDone =
    current.status === "completed" || current.status === "failed";
  const snapshotIsActive =
    snapshot.status === "pending" || snapshot.status === "downloading";

  if (currentIsDone && snapshotIsActive) {
    return current;
  }

  return {
    ...current,
    ...snapshot,
    progress:
      snapshot.status === "completed"
        ? 100
        : Math.max(current.progress, snapshot.progress),
  };
}

export function useDownload({
  enabled = true,
  historyKey = "guest",
}: UseDownloadOptions = {}): UseDownloadReturn {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingBrowserDownloadsRef = useRef<Set<string>>(new Set());

  const saveDownloadFile = useCallback(async (id: string) => {
    await downloadFile(id);
    setDownloads((prev) =>
      prev.map((download) =>
        download.id === id ? { ...download, filePath: null } : download
      )
    );
  }, []);

  const triggerBrowserSave = useCallback(
    (id: string) => {
      if (!pendingBrowserDownloadsRef.current.has(id)) {
        return;
      }

      pendingBrowserDownloadsRef.current.delete(id);
      saveDownloadFile(id).catch((err) => {
        const msg =
          err instanceof ApiClientError
            ? err.message
            : "Download completed, but the file could not be saved.";
        setError(msg);
      });
    },
    [saveDownloadFile]
  );

  // ── Load existing downloads on mount ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      return () => {
        cancelled = true;
      };
    }

    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchDownloads();
        if (!cancelled) setDownloads(data);
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof ApiClientError
              ? err.message
              : "Failed to load downloads";
          setError(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, historyKey]);

  const downloadIds = useMemo(() => downloads.map((download) => download.id), [
    downloads,
  ]);

  // ── Socket.io real-time updates ──────────────────────────────────────
  useSocket(
    {
      onProgress: ({ id, progress, speed, eta }) => {
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === id
              ? d.status === "completed" || d.status === "failed"
                ? d
                : {
                    ...d,
                    status: "downloading",
                    progress: Math.max(d.progress, progress),
                    speed,
                    eta,
                  }
              : d
          )
        );
      },

      onTitle: ({ id, title }) => {
        setDownloads((prev) =>
          prev.map((d) => (d.id === id ? { ...d, title } : d))
        );
      },

      onCompleted: ({ id, filePath, fileSize }) => {
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: "completed",
                  progress: 100,
                  filePath,
                  fileSize,
                  speed: null,
                  eta: null,
                }
              : d
          )
        );

        triggerBrowserSave(id);
      },

      onFailed: ({ id, error: errorMsg }) => {
        pendingBrowserDownloadsRef.current.delete(id);
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === id
              ? { ...d, status: "failed", errorMsg, speed: null, eta: null }
              : d
          )
        );
      },
    },
    downloadIds
  );

  const activeDownloadIdsKey = useMemo(
    () =>
      downloads
        .filter(isActiveDownload)
        .map((download) => download.id)
        .join("|"),
    [downloads]
  );

  useEffect(() => {
    if (!enabled || !activeDownloadIdsKey) {
      return;
    }

    const activeIds = activeDownloadIdsKey.split("|");
    let cancelled = false;

    async function refreshActiveDownloads() {
      const snapshots = await Promise.all(
        activeIds.map(async (id) => {
          try {
            return await fetchDownloadById(id);
          } catch {
            return null;
          }
        })
      );

      if (cancelled) {
        return;
      }

      const snapshotsById = new Map(
        snapshots
          .filter((snapshot): snapshot is DownloadRecord => Boolean(snapshot))
          .map((snapshot) => [snapshot.id, snapshot])
      );

      if (snapshotsById.size === 0) {
        return;
      }

      setDownloads((prev) =>
        prev.map((download) => {
          const snapshot = snapshotsById.get(download.id);
          return snapshot ? mergeDownloadRecord(download, snapshot) : download;
        })
      );

      snapshotsById.forEach((snapshot) => {
        if (snapshot.status === "completed") {
          triggerBrowserSave(snapshot.id);
        }

        if (snapshot.status === "failed") {
          pendingBrowserDownloadsRef.current.delete(snapshot.id);
        }
      });
    }

    void refreshActiveDownloads();
    const intervalId = window.setInterval(
      () => void refreshActiveDownloads(),
      STATUS_POLL_INTERVAL_MS
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeDownloadIdsKey, enabled, triggerBrowserSave]);

  // ── Add a new download ───────────────────────────────────────────────
  const addDownload = useCallback(
    async (url: string) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const record = await startDownload(url);
        pendingBrowserDownloadsRef.current.add(record.id);

        // Prepend new record to the list
        setDownloads((prev) => [record, ...prev]);
      } catch (err) {
        const msg =
          err instanceof ApiClientError
            ? err.message
            : "Failed to start download";
        setError(msg);
        throw err; // Re-throw so the input component can react
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  // ── Remove a download ────────────────────────────────────────────────
  const removeDownload = useCallback(async (id: string) => {
    // Optimistic removal
    setDownloads((prev) => prev.filter((d) => d.id !== id));

    try {
      await deleteDownload(id);
    } catch {
      // Re-fetch on failure to restore state
      try {
        const data = await fetchDownloads();
        setDownloads(data);
      } catch {
        // Ignore secondary failure
      }
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    downloads,
    isLoading,
    isSubmitting,
    error,
    addDownload,
    removeDownload,
    saveDownloadFile,
    clearError,
  };
}

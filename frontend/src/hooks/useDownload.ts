// src/hooks/useDownload.ts
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  fetchDownloads,
  startDownload,
  deleteDownload,
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
  clearError: () => void;
}

type UseDownloadOptions = {
  enabled?: boolean;
  historyKey?: string;
};

export function useDownload({
  enabled = true,
  historyKey = "guest",
}: UseDownloadOptions = {}): UseDownloadReturn {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              ? { ...d, status: "downloading", progress, speed, eta }
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
      },

      onFailed: ({ id, error: errorMsg }) => {
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

  // ── Add a new download ───────────────────────────────────────────────
  const addDownload = useCallback(
    async (url: string) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const record = await startDownload(url);

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
    clearError,
  };
}

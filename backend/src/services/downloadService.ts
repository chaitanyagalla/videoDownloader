// src/services/downloadService.ts
import { Server as SocketServer } from "socket.io";
import { z } from "zod";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import {
  createDownload,
  findDownloadById,
  findDownloadByIdForUser,
  findAllDownloads,
  findDownloadsByUserId,
  updateDownloadProgress,
  updateDownloadTitle,
  markDownloadCompleted,
  markDownloadFailed,
  deleteDownload,
  deleteDownloadForUser,
} from "../models/downloadModel";
import { startDownload } from "./ytdlpService";
import { detectPlatform, isSupportedUrl, isValidUrl } from "../utils/helpers";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { DownloadRecord, ServerToClientEvents, ClientToServerEvents } from "../types";

const ANONYMOUS_DOWNLOAD_RETENTION_MS = 60 * 60 * 1000;
const anonymousDownloads = new Map<string, DownloadRecord>();

export function getDownloadRoom(downloadId: string): string {
  return `download:${downloadId}`;
}

function createAnonymousDownload(data: {
  url: string;
  platform: DownloadRecord["platform"];
}): DownloadRecord {
  const now = new Date();

  const record: DownloadRecord = {
    id: randomUUID(),
    url: data.url,
    platform: data.platform,
    title: null,
    status: "pending",
    progress: 0,
    speed: null,
    eta: null,
    filePath: null,
    fileSize: null,
    errorMsg: null,
    createdAt: now,
    updatedAt: now,
  };

  anonymousDownloads.set(record.id, record);
  return record;
}

function updateAnonymousDownload(
  id: string,
  patch: Partial<Omit<DownloadRecord, "id" | "createdAt">>
): void {
  const current = anonymousDownloads.get(id);
  if (!current) {
    return;
  }

  anonymousDownloads.set(id, {
    ...current,
    ...patch,
    updatedAt: new Date(),
  });
}

function scheduleAnonymousCleanup(id: string): void {
  setTimeout(() => {
    anonymousDownloads.delete(id);
  }, ANONYMOUS_DOWNLOAD_RETENTION_MS).unref();
}

// ─── Validation Schema ─────────────────────────────────────────────────────

export const createDownloadSchema = z.object({
  url: z
    .string({ required_error: "URL is required" })
    .min(1, "URL cannot be empty")
    .max(2048, "URL is too long")
    .refine(isValidUrl, { message: "Must be a valid HTTP or HTTPS URL" })
    .refine(isSupportedUrl, {
      message: "URL must be from YouTube, X (Twitter), or Instagram",
    }),
});

export type CreateDownloadDto = z.infer<typeof createDownloadSchema>;

// ─── Pre-flight Checks ─────────────────────────────────────────────────────

/**
 * Checks if yt-dlp is installed and available on the system
 * @throws {AppError} If yt-dlp is not found
 * @returns {Promise<string>} The yt-dlp version string
 */
export async function checkYtDlpAvailable(): Promise<string> {
  try {
    const version = execSync("yt-dlp --version", {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    
    logger.debug("yt-dlp version check", { version });
    return version;
  } catch (err) {
    logger.error("yt-dlp availability check failed", { err });
    throw AppError.internalError(
      "yt-dlp is not installed. Please install it from https://github.com/yt-dlp/yt-dlp#installation"
    );
  }
}

// ─── Background Jobs ───────────────────────────────────────────────────────

/**
 * Starts background cleanup job that runs every 6 hours:
 * - Removes failed downloads older than 7 days
 * - Removes completed downloads older than 30 days
 * - Logs cleanup results for monitoring
 * 
 * @param {number} failedRetentionDays - How many days to keep failed downloads (default: 7)
 * @param {number} completedRetentionDays - How many days to keep completed downloads (default: 30)
 * @returns {NodeJS.Timer} The interval timer (save to clear later if needed)
 */
export function startJobCleanup(
  failedRetentionDays: number = 7,
  completedRetentionDays: number = 30
): NodeJS.Timer {
  // Run cleanup every 6 hours
  const cleanupInterval = 6 * 60 * 60 * 1000;

  const job = setInterval(async () => {
    try {
      logger.info("Starting cleanup job");

      const allDownloads = await findAllDownloads();
      const now = Date.now();

      let cleanedCount = 0;

      for (const download of allDownloads) {
        const downloadAge = now - new Date(download.createdAt).getTime();
        const ageInDays = downloadAge / (1000 * 60 * 60 * 24);

        // Remove failed downloads older than retention period
        if (
          download.status === "failed" &&
          ageInDays > failedRetentionDays
        ) {
          try {
            await deleteDownload(download.id);
            cleanedCount++;
            logger.debug("Cleaned old failed download", {
              id: download.id,
              ageInDays: Math.floor(ageInDays),
            });
          } catch (err) {
            logger.error("Failed to clean download", { id: download.id, err });
          }
        }

        // Remove completed downloads older than retention period
        if (
          download.status === "completed" &&
          ageInDays > completedRetentionDays
        ) {
          try {
            await deleteDownload(download.id);
            cleanedCount++;
            logger.debug("Cleaned old completed download", {
              id: download.id,
              ageInDays: Math.floor(ageInDays),
            });
          } catch (err) {
            logger.error("Failed to clean download", { id: download.id, err });
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info("Cleanup job completed", { cleanedCount });
      }
    } catch (err) {
      logger.error("Cleanup job encountered error", { err });
    }
  }, cleanupInterval);

  logger.info("Cleanup job started", {
    interval: `${cleanupInterval / 1000 / 60 / 60} hours`,
    failedRetentionDays,
    completedRetentionDays,
  });

  return job;
}

// ─── Service Functions ─────────────────────────────────────────────────────

export async function getAllDownloads(): Promise<DownloadRecord[]> {
  return findAllDownloads();
}

export async function getDownloadsForUser(
  userId?: string
): Promise<DownloadRecord[]> {
  if (!userId) {
    return [];
  }

  return findDownloadsByUserId(userId);
}

export async function getDownloadById(
  id: string,
  userId?: string
): Promise<DownloadRecord> {
  if (!id) throw AppError.badRequest("Download ID is required");

  const record = userId
    ? await findDownloadByIdForUser(id, userId)
    : anonymousDownloads.get(id) ?? null;

  if (!record) throw AppError.notFound("Download");

  return record;
}

export async function getDownloadSnapshot(
  id: string
): Promise<DownloadRecord | null> {
  return anonymousDownloads.get(id) ?? findDownloadById(id);
}

// export async function initiateDownload(
//   dto: CreateDownloadDto,
//   io: SocketServer<ClientToServerEvents, ServerToClientEvents>
// ): Promise<DownloadRecord> {
//   const platform = detectPlatform(dto.url);

//   logger.info("Initiating download", { url: dto.url, platform });

//   // Create DB record immediately
//   const record = await createDownload({ url: dto.url, platform });

//   // Start yt-dlp in the background (non-blocking)
//   startDownload(record.id, dto.url, {
//     onProgress: async (percent, speed, eta) => {
//   // Emit immediately — do NOT await anything before this
//   io.emit("download:progress", { id: record.id, progress: percent, speed, eta });

//   // DB write is fire-and-forget — UI doesn't depend on it
//   updateDownloadProgress(record.id, { progress: percent, speed, eta }).catch((err) => {
//     logger.error("Failed to persist progress", { id: record.id, err });
//   });
// },

//     onTitle: async (title) => {
//       try {
//         await updateDownloadTitle(record.id, title);
//         io.emit("download:title", { id: record.id, title });
//       } catch (err) {
//         logger.error("Failed to persist title", { id: record.id, err });
//       }
//     },

//     onCompleted: async (filePath, fileSize) => {
//       try {
//         await markDownloadCompleted(record.id, { filePath, fileSize });
//         io.emit("download:completed", { id: record.id, filePath, fileSize });
//         logger.info("Download completed", { id: record.id, filePath });
//       } catch (err) {
//         logger.error("Failed to persist completion", { id: record.id, err });
//       }
//     },

//     onFailed: async (error) => {
//       try {
//         await markDownloadFailed(record.id, error);
//         io.emit("download:failed", { id: record.id, error });
//         logger.warn("Download failed", { id: record.id, error });
//       } catch (err) {
//         logger.error("Failed to persist failure", { id: record.id, err });
//       }
//     },
//   });

//   return record;
// }

export async function initiateDownload(
  dto: CreateDownloadDto,
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>,
  userId?: string
): Promise<DownloadRecord> {
  const platform = detectPlatform(dto.url);
  logger.info("Initiating download", {
    url: dto.url,
    platform,
    historyEnabled: Boolean(userId),
  });

  const record = userId
    ? await createDownload({ url: dto.url, platform, userId })
    : createAnonymousDownload({ url: dto.url, platform });

  let lastDbWriteAt = 0;
  const DB_WRITE_INTERVAL_MS = 2000;

  startDownload(record.id, dto.url, {
    onProgress: (percent, speed, eta) => {
      // ✅ io.emit — broadcasts to ALL sockets instantly
      // Listeners are already set up on the frontend before user pastes URL
      io.to(getDownloadRoom(record.id)).emit("download:progress", {
        id: record.id,
        progress: percent,
        speed,
        eta,
      });

      if (!userId) {
        updateAnonymousDownload(record.id, {
          status: "downloading",
          progress: percent,
          speed,
          eta,
        });
        return;
      }

      const now = Date.now();
      if (now - lastDbWriteAt >= DB_WRITE_INTERVAL_MS) {
        lastDbWriteAt = now;
        updateDownloadProgress(record.id, {
          progress: percent,
          speed,
          eta,
        }).catch((err) =>
          logger.error("Failed to persist progress", { id: record.id, err })
        );
      }
    },

    onTitle: (title) => {
      if (userId) {
        updateDownloadTitle(record.id, title).catch((err) =>
          logger.error("Failed to persist title", { id: record.id, err })
        );
      } else {
        updateAnonymousDownload(record.id, { title });
      }

      io.to(getDownloadRoom(record.id)).emit("download:title", {
        id: record.id,
        title,
      });
    },

    onCompleted: (filePath, fileSize) => {
      io.to(getDownloadRoom(record.id)).emit("download:completed", {
        id: record.id,
        filePath,
        fileSize,
      });

      if (userId) {
        markDownloadCompleted(record.id, { filePath, fileSize })
          .then(() =>
            logger.info("Download completed", { id: record.id, filePath })
          )
          .catch((err) =>
            logger.error("Failed to persist completion", { id: record.id, err })
          );
      } else {
        updateAnonymousDownload(record.id, {
          status: "completed",
          progress: 100,
          filePath,
          fileSize,
          speed: null,
          eta: null,
        });
        scheduleAnonymousCleanup(record.id);
        logger.info("Anonymous download completed", {
          id: record.id,
          filePath,
        });
      }
    },

    onFailed: (error) => {
      io.to(getDownloadRoom(record.id)).emit("download:failed", {
        id: record.id,
        error,
      });

      if (userId) {
        markDownloadFailed(record.id, error).catch((err) =>
          logger.error("Failed to persist failure", { id: record.id, err })
        );
      } else {
        updateAnonymousDownload(record.id, {
          status: "failed",
          errorMsg: error,
          speed: null,
          eta: null,
        });
        scheduleAnonymousCleanup(record.id);
      }
    },
  });

  return record;
}

export async function removeDownload(
  id: string,
  userId?: string
): Promise<void> {
  if (!id) throw AppError.badRequest("Download ID is required");

  if (!userId) {
    anonymousDownloads.delete(id);
    return;
  }

  const record = await findDownloadByIdForUser(id, userId);
  if (!record) throw AppError.notFound("Download");
  await deleteDownloadForUser(id, userId);
}

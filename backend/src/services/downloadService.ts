// src/services/downloadService.ts
import { Server as SocketServer } from "socket.io";
import { z } from "zod";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  createDownload,
  findDownloadByIdForUser,
  findAllDownloads,
  findDownloadsByUserId,
  updateDownloadProgress,
  updateDownloadTitle,
  markDownloadCompleted,
  markDownloadFailed,
  clearDownloadFile,
  deleteDownload,
  deleteDownloadForUser,
} from "../models/downloadModel";
import { startDownload } from "./ytdlpService";
import {
  detectPlatform,
  getDownloadsFolder,
  isSupportedUrl,
  isValidUrl,
  maskUrl,
} from "../utils/helpers";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { DownloadRecord, ServerToClientEvents, ClientToServerEvents } from "../types";

const ANONYMOUS_DOWNLOAD_RETENTION_MS = 60 * 60 * 1000;
const AUTHENTICATED_FILE_RETENTION_MS = 60 * 60 * 1000;
type AnonymousDownloadRecord = DownloadRecord & {
  anonymousClientId: string;
};

const anonymousDownloads = new Map<string, AnonymousDownloadRecord>();

export function getDownloadRoom(downloadId: string): string {
  return `download:${downloadId}`;
}

function createAnonymousDownload(data: {
  url: string;
  platform: DownloadRecord["platform"];
  anonymousClientId: string;
}): DownloadRecord {
  const now = new Date();

  const record: AnonymousDownloadRecord = {
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
    anonymousClientId: data.anonymousClientId,
  };

  anonymousDownloads.set(record.id, record);
  return toPublicDownloadRecord(record);
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
    const record = anonymousDownloads.get(id);
    if (record?.filePath) {
      void deleteDownloadedFile(record.filePath);
    }
    anonymousDownloads.delete(id);
  }, ANONYMOUS_DOWNLOAD_RETENTION_MS).unref();
}

function getPublicFilePath(filePath: string | null): string | null {
  return filePath ? path.basename(filePath) : null;
}

function toPublicDownloadRecord(record: DownloadRecord): DownloadRecord {
  return {
    ...record,
    filePath: getPublicFilePath(record.filePath),
  };
}

function isAnonymousOwner(
  record: AnonymousDownloadRecord,
  anonymousClientId?: string | null
): boolean {
  return Boolean(anonymousClientId && record.anonymousClientId === anonymousClientId);
}

async function deleteDownloadedFile(filePath: string | null): Promise<void> {
  if (!filePath) {
    return;
  }

  const downloadsDir = path.resolve(getDownloadsFolder());
  const resolvedPath = path.resolve(filePath);
  const isInsideDownloadsDir =
    resolvedPath === downloadsDir ||
    resolvedPath.startsWith(`${downloadsDir}${path.sep}`);

  if (!isInsideDownloadsDir) {
    logger.warn("Refusing to delete file outside downloads directory", {
      fileName: path.basename(filePath),
    });
    return;
  }

  try {
    await fs.rm(resolvedPath, { force: true });
  } catch (err) {
    logger.warn("Failed to delete downloaded file", {
      fileName: path.basename(filePath),
      err,
    });
  }
}

function getPrivateDownloadPath(filePath: string | null): string | null {
  if (!filePath) {
    return null;
  }

  const downloadsDir = path.resolve(getDownloadsFolder());
  const resolvedPath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(downloadsDir, filePath);
  const isInsideDownloadsDir =
    resolvedPath === downloadsDir ||
    resolvedPath.startsWith(`${downloadsDir}${path.sep}`);

  if (!isInsideDownloadsDir) {
    logger.warn("Refusing to serve file outside downloads directory", {
      fileName: path.basename(filePath),
    });
    return null;
  }

  return resolvedPath;
}

function scheduleAuthenticatedFileCleanup(id: string, filePath: string): void {
  setTimeout(() => {
    void deleteDownloadedFile(filePath);
    clearDownloadFile(id).catch((err) =>
      logger.warn("Failed to clear expired download file reference", { id, err })
    );
  }, AUTHENTICATED_FILE_RETENTION_MS).unref();
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
            await deleteDownloadedFile(download.filePath);
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
            await deleteDownloadedFile(download.filePath);
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
  const records = await findAllDownloads();
  return records.map(toPublicDownloadRecord);
}

export async function getDownloadsForUser(
  userId?: string
): Promise<DownloadRecord[]> {
  if (!userId) {
    return [];
  }

  const records = await findDownloadsByUserId(userId);
  return records.map(toPublicDownloadRecord);
}

export async function getDownloadById(
  id: string,
  userId?: string,
  anonymousClientId?: string | null
): Promise<DownloadRecord> {
  if (!id) throw AppError.badRequest("Download ID is required");

  const anonymousRecord = anonymousDownloads.get(id);
  const record = userId
    ? await findDownloadByIdForUser(id, userId)
    : anonymousRecord && isAnonymousOwner(anonymousRecord, anonymousClientId)
      ? anonymousRecord
      : null;

  if (!record) throw AppError.notFound("Download");

  return toPublicDownloadRecord(record);
}

export async function getDownloadSnapshot(
  id: string,
  userId?: string,
  anonymousClientId?: string | null,
  allowAnonymousWithoutCookie = false
): Promise<DownloadRecord | null> {
  const anonymousRecord = anonymousDownloads.get(id);

  if (!userId) {
    return anonymousRecord &&
      (isAnonymousOwner(anonymousRecord, anonymousClientId) ||
        allowAnonymousWithoutCookie)
      ? toPublicDownloadRecord(anonymousRecord)
      : null;
  }

  const record = await findDownloadByIdForUser(id, userId);
  return record ? toPublicDownloadRecord(record) : null;
}

export async function getDownloadFileForDelivery(
  id: string,
  userId?: string,
  anonymousClientId?: string | null
): Promise<{ filePath: string; fileName: string }> {
  if (!id) throw AppError.badRequest("Download ID is required");

  const anonymousRecord = anonymousDownloads.get(id);
  const record = userId
    ? await findDownloadByIdForUser(id, userId)
    : anonymousRecord && isAnonymousOwner(anonymousRecord, anonymousClientId)
      ? anonymousRecord
      : null;

  if (!record) throw AppError.notFound("Download");
  if (record.status !== "completed") {
    throw AppError.badRequest("Download is not ready yet");
  }

  const filePath = getPrivateDownloadPath(record.filePath);
  if (!filePath) throw AppError.notFound("Downloaded file");

  try {
    await fs.access(filePath);
  } catch {
    throw AppError.notFound("Downloaded file");
  }

  return {
    filePath,
    fileName: path.basename(filePath),
  };
}

export async function markDeliveredToDevice(
  id: string,
  filePath: string,
  userId?: string,
  anonymousClientId?: string | null
): Promise<void> {
  await deleteDownloadedFile(filePath);

  if (!userId) {
    const record = anonymousDownloads.get(id);
    if (record && isAnonymousOwner(record, anonymousClientId)) {
      updateAnonymousDownload(id, {
        filePath: null,
        fileSize: null,
      });
    }
    return;
  }

  await clearDownloadFile(id);
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
  userId?: string,
  anonymousClientId?: string
): Promise<DownloadRecord> {
  const platform = detectPlatform(dto.url);
  logger.info("Initiating download", {
    url: maskUrl(dto.url),
    platform,
    historyEnabled: Boolean(userId),
  });

  if (!userId && !anonymousClientId) {
    throw AppError.unauthorized("Guest download session is missing");
  }

  const record = userId
    ? await createDownload({ url: dto.url, platform, userId })
    : createAnonymousDownload({
        url: dto.url,
        platform,
        anonymousClientId: anonymousClientId as string,
      });

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
      const publicFilePath = getPublicFilePath(filePath) ?? "download.mp4";

      if (userId) {
        markDownloadCompleted(record.id, { filePath, fileSize })
          .then(() => {
            io.to(getDownloadRoom(record.id)).emit("download:completed", {
              id: record.id,
              filePath: publicFilePath,
              fileSize,
            });
            scheduleAuthenticatedFileCleanup(record.id, filePath);
            logger.info("Download completed", {
              id: record.id,
              fileName: publicFilePath,
            });
          })
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
        io.to(getDownloadRoom(record.id)).emit("download:completed", {
          id: record.id,
          filePath: publicFilePath,
          fileSize,
        });
        logger.info("Anonymous download completed", {
          id: record.id,
          fileName: publicFilePath,
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
  userId?: string,
  anonymousClientId?: string | null
): Promise<void> {
  if (!id) throw AppError.badRequest("Download ID is required");

  if (!userId) {
    const record = anonymousDownloads.get(id);
    if (!record || !isAnonymousOwner(record, anonymousClientId)) {
      throw AppError.notFound("Download");
    }

    await deleteDownloadedFile(record.filePath);
    anonymousDownloads.delete(id);
    return;
  }

  const record = await findDownloadByIdForUser(id, userId);
  if (!record) throw AppError.notFound("Download");
  await deleteDownloadedFile(record.filePath);
  await deleteDownloadForUser(id, userId);
}

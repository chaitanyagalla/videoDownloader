// src/models/downloadModel.ts
import { prisma } from "../config/database";
import { DownloadRecord, DownloadStatus, Platform } from "../types";

// ─── Type Helpers ──────────────────────────────────────────────────────────

function toDownloadRecord(raw: {
  id: string;
  url: string;
  platform: string;
  title: string | null;
  status: string;
  progress: number;
  speed: string | null;
  eta: string | null;
  filePath: string | null;
  fileSize: string | null;
  errorMsg: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DownloadRecord {
  return {
    ...raw,
    platform: raw.platform as Platform,
    status: raw.status as DownloadStatus,
  };
}

// ─── Model Methods ─────────────────────────────────────────────────────────

export async function createDownload(data: {
  url: string;
  platform: Platform;
  userId: string;
}): Promise<DownloadRecord> {
  const record = await prisma.download.create({
    data: {
      url: data.url,
      platform: data.platform,
      userId: data.userId,
      status: "pending",
      progress: 0,
    },
  });
  return toDownloadRecord(record);
}

export async function findDownloadById(id: string): Promise<DownloadRecord | null> {
  const record = await prisma.download.findUnique({ where: { id } });
  return record ? toDownloadRecord(record) : null;
}

export async function findDownloadByIdForUser(
  id: string,
  userId: string
): Promise<DownloadRecord | null> {
  const record = await prisma.download.findFirst({
    where: { id, userId },
  });
  return record ? toDownloadRecord(record) : null;
}

export async function findAllDownloads(): Promise<DownloadRecord[]> {
  const records = await prisma.download.findMany({
    orderBy: { createdAt: "desc" },
  });
  return records.map(toDownloadRecord);
}

export async function findDownloadsByUserId(
  userId: string
): Promise<DownloadRecord[]> {
  const records = await prisma.download.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return records.map(toDownloadRecord);
}

export async function updateDownloadStatus(
  id: string,
  status: DownloadStatus
): Promise<DownloadRecord> {
  const record = await prisma.download.update({
    where: { id },
    data: { status },
  });
  return toDownloadRecord(record);
}

export async function updateDownloadProgress(
  id: string,
  data: { progress: number; speed?: string | null; eta?: string | null }
): Promise<void> {
  await prisma.download.update({
    where: { id },
    data: {
      progress: data.progress,
      speed: data.speed ?? null,
      eta: data.eta ?? null,
      status: "downloading",
    },
  });
}

export async function updateDownloadTitle(
  id: string,
  title: string
): Promise<void> {
  await prisma.download.update({ where: { id }, data: { title } });
}

export async function markDownloadCompleted(
  id: string,
  data: { filePath: string; fileSize?: string | null }
): Promise<DownloadRecord> {
  const record = await prisma.download.update({
    where: { id },
    data: {
      status: "completed",
      progress: 100,
      filePath: data.filePath,
      fileSize: data.fileSize ?? null,
      speed: null,
      eta: null,
    },
  });
  return toDownloadRecord(record);
}

export async function markDownloadFailed(
  id: string,
  errorMsg: string
): Promise<DownloadRecord> {
  const record = await prisma.download.update({
    where: { id },
    data: { status: "failed", errorMsg },
  });
  return toDownloadRecord(record);
}

export async function deleteDownload(id: string): Promise<void> {
  await prisma.download.delete({ where: { id } });
}

export async function deleteDownloadForUser(
  id: string,
  userId: string
): Promise<void> {
  await prisma.download.deleteMany({
    where: { id, userId },
  });
}

export async function deleteStaleDownloads(): Promise<number> {
  // Clean up downloads older than 7 days that are completed or failed
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.download.deleteMany({
    where: {
      createdAt: { lt: sevenDaysAgo },
      status: { in: ["completed", "failed"] },
    },
  });
  return result.count;
}

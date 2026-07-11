import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { del, put } from "@vercel/blob";
import type { Download } from "@prisma/client";
import ffmpegPath from "ffmpeg-static";
import youtubeDl from "youtube-dl-exec";
import { z } from "zod";
import type { DownloadRecord, Platform } from "@/types";
import { detectPlatform, isSupportedUrl, isValidHttpUrl } from "@/lib/validators";
import { env } from "./env";
import { ApiError } from "./http";
import { prisma } from "./prisma";

const youtubeDlExecutable =
  process.platform === "linux"
    ? youtubeDl.create(path.join(process.cwd(), "vendor", "yt-dlp_linux"))
    : youtubeDl;

export const createDownloadSchema = z.object({
  url: z
    .string({ required_error: "URL is required" })
    .trim()
    .min(1, "URL cannot be empty")
    .max(2048, "URL is too long")
    .refine(isValidHttpUrl, "Must be a valid HTTP or HTTPS URL")
    .refine(isSupportedUrl, "URL must be from YouTube, X (Twitter), or Instagram"),
});

type Owner = { userId?: string; anonymousClientId?: string };

function owns(record: Download, owner: Owner): boolean {
  return owner.userId
    ? record.userId === owner.userId
    : Boolean(owner.anonymousClientId && record.anonymousClientId === owner.anonymousClientId);
}

function publicFileName(filePath: string | null): string | null {
  if (!filePath) return null;
  try {
    return decodeURIComponent(new URL(filePath).pathname.split("/").pop() ?? "download.mp4");
  } catch {
    return path.basename(filePath);
  }
}

export function toDownloadRecord(record: Download): DownloadRecord {
  return {
    id: record.id,
    url: record.url,
    platform: record.platform as Platform,
    title: record.title,
    status: record.status as DownloadRecord["status"],
    progress: record.progress,
    speed: record.speed,
    eta: record.eta,
    filePath: publicFileName(record.filePath),
    fileSize: record.fileSize,
    errorMsg: record.errorMsg,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listDownloads(owner: Owner): Promise<DownloadRecord[]> {
  if (!owner.userId) return [];
  const records = await prisma.download.findMany({
    where: { userId: owner.userId },
    orderBy: { createdAt: "desc" },
  });
  return records.map(toDownloadRecord);
}

export async function getDownload(id: string, owner: Owner): Promise<DownloadRecord> {
  const record = await getOwnedDownload(id, owner);
  return toDownloadRecord(record);
}

export async function createDownload(url: string, owner: Owner): Promise<DownloadRecord> {
  if (!owner.userId && !owner.anonymousClientId) {
    throw new ApiError("Guest download session is missing", 401, "UNAUTHORIZED");
  }
  const record = await prisma.download.create({
    data: {
      url,
      platform: detectPlatform(url),
      userId: owner.userId,
      anonymousClientId: owner.userId ? null : owner.anonymousClientId,
    },
  });
  return toDownloadRecord(record);
}

export async function removeDownload(id: string, owner: Owner): Promise<void> {
  const record = await getOwnedDownload(id, owner);
  if (record.filePath?.startsWith("https://")) {
    await del(record.filePath).catch((error) => {
      console.warn("Unable to delete Vercel Blob", { id, error });
    });
  } else if (record.filePath) {
    await removeLocalMedia(record.filePath);
  }
  await prisma.download.delete({ where: { id } });
}

export async function getDownloadDelivery(
  id: string,
  owner: Owner
): Promise<
  | { kind: "redirect"; url: string }
  | { kind: "local"; filePath: string; fileName: string; size: number }
> {
  const record = await getOwnedDownload(id, owner);
  if (record.status !== "completed" || !record.filePath) {
    throw new ApiError("Download is not ready yet", 400, "BAD_REQUEST");
  }
  if (record.filePath.startsWith("https://")) {
    return { kind: "redirect", url: record.filePath };
  }

  const filePath = safeLocalMediaPath(record.filePath);
  const file = await stat(filePath).catch(() => null);
  if (!file?.isFile()) {
    throw new ApiError("Downloaded file not found", 404, "NOT_FOUND");
  }
  return {
    kind: "local",
    filePath,
    fileName: path.basename(filePath),
    size: file.size,
  };
}

async function getOwnedDownload(id: string, owner: Owner): Promise<Download> {
  if (!id) throw new ApiError("Download ID is required", 400, "BAD_REQUEST");
  const record = await prisma.download.findUnique({ where: { id } });
  if (!record || !owns(record, owner)) {
    throw new ApiError("Download not found", 404, "NOT_FOUND");
  }
  return record;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB"];
  let size = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(2)} ${unit}`;
}

async function cookieFile(workDir: string): Promise<string | undefined> {
  const value = env.ytdlpCookiesBase64
    ? Buffer.from(env.ytdlpCookiesBase64, "base64").toString("utf8")
    : env.ytdlpCookies;
  if (!value) return undefined;
  const target = path.join(workDir, "cookies.txt");
  await writeFile(target, value, { mode: 0o600 });
  return target;
}

function friendlyDownloadError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const compact = raw.replace(/\s+/g, " ").trim();
  if (/sign in to confirm|not a bot/i.test(compact)) {
    return "YouTube requested verification. Configure YTDLP_COOKIES_BASE64 in Vercel and try again.";
  }
  if (/code:\s*127|ENOENT|not found/i.test(compact)) {
    return "The media downloader could not start. Please try again after the deployment is updated.";
  }
  return "The media download failed. Please verify the URL and try again.";
}

function localDownloadsDir(): string {
  return path.resolve(process.cwd(), "downloads");
}

function safeLocalMediaPath(candidate: string): string {
  const root = localDownloadsDir();
  const resolved = path.resolve(candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new ApiError("Invalid local download path", 500, "INTERNAL_ERROR");
  }
  return resolved;
}

async function removeLocalMedia(candidate: string): Promise<void> {
  const resolved = safeLocalMediaPath(candidate);
  await rm(path.dirname(resolved), { recursive: true, force: true }).catch(() => undefined);
}

async function storeCompletedMedia(
  id: string,
  mediaPath: string,
  fileName: string,
  size: number
): Promise<string> {
  const hasBlobCredentials = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.BLOB_STORE_ID
  );
  if (hasBlobCredentials) {
    const blob = await put(`downloads/${id}/${fileName}`, createReadStream(mediaPath), {
      access: "public",
      addRandomSuffix: false,
      multipart: size > 100 * 1024 * 1024,
    });
    return blob.url;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Vercel Blob is not configured. Connect a public Blob store and set BLOB_READ_WRITE_TOKEN."
    );
  }

  const destinationDir = path.join(localDownloadsDir(), id);
  await mkdir(destinationDir, { recursive: true });
  const destination = path.join(destinationDir, path.basename(fileName));
  await copyFile(mediaPath, destination);
  return destination;
}

export async function processDownload(id: string, url: string): Promise<void> {
  let workDir: string | undefined;
  try {
    workDir = await mkdtemp(path.join(tmpdir(), `videosave-${id}-`));
    const cookies = await cookieFile(workDir);
    await prisma.download.update({
      where: { id },
      data: { status: "downloading", progress: 1, errorMsg: null },
    });

    const output = path.join(workDir, "%(title).120B-%(id)s.%(ext)s");
    const child = youtubeDlExecutable.exec(
      url,
      {
        noPlaylist: true,
        newline: true,
        noColor: true,
        restrictFilenames: true,
        trimFilenames: 180,
        format: "bv*+ba/b",
        mergeOutputFormat: "mp4",
        ...(ffmpegPath ? { ffmpegLocation: ffmpegPath } : {}),
        output,
        matchFilter: `duration <=? ${env.maxDurationSeconds} & !is_live`,
        retries: 3,
        jsRuntimes: "node",
        ...(cookies ? { cookies } : {}),
        ...(env.ytdlpProxy ? { proxy: env.ytdlpProxy } : {}),
      },
      { cwd: workDir }
    );

    let lastWrite = 0;
    child.stderr?.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      const match = text.match(/\[download\]\s+([\d.]+)%.*?(?:at\s+([^\s]+))?.*?(?:ETA\s+([^\s]+))?/i);
      if (!match) return;
      const now = Date.now();
      if (now - lastWrite < 1500) return;
      lastWrite = now;
      const progress = Math.min(99, Number.parseFloat(match[1] ?? "0"));
      void prisma.download.update({
        where: { id },
        data: {
          status: "downloading",
          progress: Number.isFinite(progress) ? progress : 1,
          speed: match[2] ?? null,
          eta: match[3] ?? null,
        },
      }).catch(() => undefined);
    });

    await child;
    const entries = await readdir(workDir, { withFileTypes: true });
    const media = entries.find(
      (entry) =>
        entry.isFile() &&
        entry.name !== "cookies.txt" &&
        !entry.name.endsWith(".part") &&
        !entry.name.endsWith(".ytdl")
    );
    if (!media) throw new Error("yt-dlp finished without producing a media file");

    const mediaPath = path.join(workDir, media.name);
    const file = await stat(mediaPath);
    const storedPath = await storeCompletedMedia(
      id,
      mediaPath,
      media.name,
      file.size
    );
    const title = media.name.replace(/\.[^.]+$/, "").replace(/[-_][\w-]{6,}$/, "");
    await prisma.download.update({
      where: { id },
      data: {
        title,
        status: "completed",
        progress: 100,
        speed: null,
        eta: null,
        filePath: storedPath,
        fileSize: humanSize(file.size),
      },
    });
  } catch (error) {
    console.error("Download job failed", { id, error });
    await prisma.download
      .update({
        where: { id },
        data: {
          status: "failed",
          speed: null,
          eta: null,
          errorMsg: friendlyDownloadError(error),
        },
      })
      .catch(() => undefined);
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

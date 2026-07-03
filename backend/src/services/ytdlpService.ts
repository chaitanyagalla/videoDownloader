// src/services/ytdlpService.ts
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import {
  getDownloadsFolder,
  maskUrl,
  parseYtdlpProgress,
  parseYtdlpTitle,
} from "../utils/helpers";

export interface YtdlpCallbacks {
  onProgress: (
    percent: number,
    speed: string | null,
    eta: string | null,
  ) => void;
  onTitle: (title: string) => void;
  onCompleted: (filePath: string, fileSize: string | null) => void;
  onFailed: (error: string) => void;
}

// Active processes map for cancellation support
const activeProcesses = new Map<string, ChildProcess>();
const MAX_STDERR_BUFFER_LENGTH = 16 * 1024;

/**
 * Verifies yt-dlp is installed and executable.
 */
export async function verifyYtdlp(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(env.YTDLP_PATH, ["--version"]);
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

/**
 * Starts a yt-dlp download. Fires callbacks as the process emits output.
 * Returns a cleanup function that kills the process if needed.
 */
export function startDownload(
  downloadId: string,
  url: string,
  callbacks: YtdlpCallbacks,
): () => void {
  if (activeProcesses.size >= env.MAX_CONCURRENT_DOWNLOADS) {
    setImmediate(() => {
      callbacks.onFailed("Server is busy. Please try again in a moment.");
    });
    return () => undefined;
  }

  const outputDir = getDownloadsFolder();

  // Ensure the Downloads folder exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputTemplate = path.join(outputDir, `${downloadId}.%(ext)s`);

  const args = [
    "--no-playlist", // single video only
    "--playlist-items",
    "1",
    "--max-filesize",
    `${env.MAX_DOWNLOAD_FILESIZE_MB}M`,
    "--match-filter",
    `duration <= ${env.MAX_VIDEO_DURATION_SECONDS} & !is_live`,
    "--socket-timeout",
    "30",
    "--retries",
    "3",
    "--fragment-retries",
    "3",
    "--no-call-home",
    "--no-cache-dir",
    "--restrict-filenames",
    "--windows-filenames",
    "--merge-output-format",
    "mp4", // always produce .mp4
    "--newline", // one progress line per newline
    "--no-colors", // clean output without ANSI
    // "--print-json", // structured JSON on completion
    // "--write-info-json", // optional metadata
    // "--js-runtimes", "node",
    // Avoid web/mweb clients here because they often require PO tokens
    // for high-quality YouTube formats and can cause "Requested format is
    // not available" failures. Let yt-dlp use the safer default clients.
    "--extractor-args",
    "youtube:player_client=default,-web,-mweb",
    // yt-dlp's recommended "best available" selector for normal downloads.
    "--format",
    "bv*+ba/b",
    "--output",
    outputTemplate,
  ];

  if (env.FFMPEG_LOCATION) {
    args.push("--ffmpeg-location", env.FFMPEG_LOCATION);
  }

  args.push(url);

  logger.info("Spawning yt-dlp", {
    downloadId,
    url: maskUrl(url),
    outputDir,
    maxFileSizeMb: env.MAX_DOWNLOAD_FILESIZE_MB,
    maxDurationSeconds: env.MAX_VIDEO_DURATION_SECONDS,
  });

  const proc = spawn(env.YTDLP_PATH, args, {
    env: buildChildProcessEnv(),
  });

  activeProcesses.set(downloadId, proc);

  let outputFilePath: string | null = null;
  let stderrBuffer = "";
  let settled = false;
  const timeout = setTimeout(() => {
    if (settled) {
      return;
    }

    settled = true;
    activeProcesses.delete(downloadId);
    proc.kill("SIGTERM");
    callbacks.onFailed("Download timed out. Please try a shorter video.");
  }, env.DOWNLOAD_TIMEOUT_MS);
  timeout.unref();

  // ── stdout ────────────────────────────────────────────────────────────
  proc.stdout?.setEncoding("utf-8");
  proc.stdout?.on("data", (chunk: string) => {
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      // Progress line
      const progress = parseYtdlpProgress(line);
      if (progress) {
        callbacks.onProgress(progress.percent, progress.speed, progress.eta);
        continue;
      }

      // Title detection
      const title = parseYtdlpTitle(line);
      if (title) {
        callbacks.onTitle(title);
        continue;
      }

      // Destination (file path)
      const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)/);
      if (destMatch?.[1]) {
        const dest = destMatch[1].trim();
        // Ignore .info.json, .json, .ytdl sidecar files — only capture actual media
        if (!/\.(info\.json|json|ytdl|part)$/i.test(dest)) {
          outputFilePath = dest;
        }
        continue;
      }

      // JSON output from --print-json
      if (line.startsWith("{")) {
        try {
          const info = JSON.parse(line) as {
            title?: string;
            requested_downloads?: Array<{
              filepath?: string;
              filesize?: number;
            }>;
          };

          if (info.title) {
            callbacks.onTitle(info.title);
          }

          const firstDownload = info.requested_downloads?.[0];
          if (firstDownload?.filepath) {
            outputFilePath = firstDownload.filepath;
          }
        } catch {
          // Not valid JSON – skip
        }
      }

    //   logger.debug("yt-dlp stdout", { downloadId, line });
    }
  });

  // ── stderr ────────────────────────────────────────────────────────────
  proc.stderr?.setEncoding("utf-8");
  proc.stderr?.on("data", (chunk: string) => {
    stderrBuffer = (stderrBuffer + chunk).slice(-MAX_STDERR_BUFFER_LENGTH);
    logger.warn("yt-dlp stderr", {
      downloadId,
      message: truncateLogMessage(chunk),
    });
  });

  // ── close ─────────────────────────────────────────────────────────────
  proc.on("close", (code) => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timeout);
    activeProcesses.delete(downloadId);

    if (code === 0) {
      // Resolve the actual output path
      const resolvedPath = resolveDownloadedPath(outputFilePath, outputDir);

      if (!resolvedPath) {
        callbacks.onFailed(
          "Download completed but output file could not be located.",
        );
        return;
      }

      let fileSize: string | null = null;
      try {
        const stat = fs.statSync(resolvedPath);
        const mb = (stat.size / (1024 * 1024)).toFixed(2);
        fileSize = `${mb} MB`;
      } catch {
        // Non-critical; file size is optional
      }

      callbacks.onCompleted(resolvedPath, fileSize);
    } else {
      const errorMessage =
        extractErrorMessage(stderrBuffer) ?? `yt-dlp exited with code ${code}`;
      callbacks.onFailed(errorMessage);
    }
  });

  proc.on("error", (err) => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timeout);
    activeProcesses.delete(downloadId);
    const message = err.message.includes("ENOENT")
      ? `yt-dlp not found at "${env.YTDLP_PATH}". Please install yt-dlp and update YTDLP_PATH in .env`
      : err.message;
    callbacks.onFailed(message);
  });

  // Return cleanup function
  return () => {
    if (activeProcesses.has(downloadId)) {
      settled = true;
      clearTimeout(timeout);
      proc.kill("SIGTERM");
      activeProcesses.delete(downloadId);
    }
  };
}

/**
 * Kills a running download process.
 */
export function cancelDownload(downloadId: string): boolean {
  const proc = activeProcesses.get(downloadId);
  if (!proc) return false;
  proc.kill("SIGTERM");
  activeProcesses.delete(downloadId);
  return true;
}

// ─── Private Helpers ───────────────────────────────────────────────────────

/**
 * Finds the most recently modified file in a directory (fallback).
 */
function buildChildProcessEnv(): NodeJS.ProcessEnv {
  return {
    HOME: process.env["HOME"],
    PATH: process.env["PATH"],
    Path: process.env["Path"],
    PATHEXT: process.env["PATHEXT"],
    SYSTEMROOT: process.env["SYSTEMROOT"],
    SystemRoot: process.env["SystemRoot"],
    TEMP: process.env["TEMP"],
    TMP: process.env["TMP"],
    PYTHONUNBUFFERED: "1",
  };
}

function resolveDownloadedPath(
  candidatePath: string | null,
  outputDir: string
): string | null {
  const resolvedOutputDir = path.resolve(outputDir);
  const resolvedCandidate = candidatePath
    ? path.resolve(candidatePath)
    : findLatestFile(outputDir);

  if (!resolvedCandidate) {
    return null;
  }

  if (
    resolvedCandidate !== resolvedOutputDir &&
    !resolvedCandidate.startsWith(`${resolvedOutputDir}${path.sep}`)
  ) {
    logger.warn("Ignoring yt-dlp output outside downloads directory", {
      fileName: path.basename(resolvedCandidate),
    });
    return null;
  }

  return resolvedCandidate;
}

function truncateLogMessage(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length > 500
    ? `${normalized.slice(0, 500)}...`
    : normalized;
}

function findLatestFile(dir: string): string | null {
  try {
    const files = fs
      .readdirSync(dir)
      .map((name) => {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);
        return { fullPath, name, isFile: stat.isFile(), mtime: stat.mtimeMs };
      })
      .filter((f) => f.isFile)
      .filter((f) => !/\.(info\.json|json|ytdl|part)$/i.test(f.name))
      .filter((f) => f.mtime > Date.now() - 5 * 60 * 1000) // modified in last 5 min
      .sort((a, b) => b.mtime - a.mtime);

    return files[0]?.fullPath ?? null;
  } catch {
    return null;
  }
}

/**
 * Extracts a clean error message from yt-dlp's stderr.
 */
function extractErrorMessage(stderr: string): string | null {
  const errorLine = stderr
    .split("\n")
    .reverse()
    .find((l) => l.toLowerCase().includes("error"));

  if (!errorLine) return null;

  // Remove ANSI escape codes
  return errorLine.replace(/\x1B\[[0-9;]*m/g, "").trim();
}

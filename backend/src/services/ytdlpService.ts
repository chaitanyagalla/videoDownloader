// src/services/ytdlpService.ts
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import {
  getDownloadsFolder,
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
  const outputDir = getDownloadsFolder();

  // Ensure the Downloads folder exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Output template: Downloads/<title>.<ext>
  const outputTemplate = path.join(outputDir, "%(title)s.%(ext)s");

  const args = [
    url,
    "--output",
    outputTemplate,
    "--no-playlist", // single video only
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
    "--ffmpeg-location", "C:\\yt-dlp",
    // yt-dlp's recommended "best available" selector for normal downloads.
    "--format", "bv*+ba/b"
  ];

  logger.info("Spawning yt-dlp", {
    downloadId,
    args: [env.YTDLP_PATH, ...args].join(" "),
  });


  const proc = spawn(env.YTDLP_PATH, args, {
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  activeProcesses.set(downloadId, proc);

  let outputFilePath: string | null = null;
  let stderrBuffer = "";

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
    stderrBuffer += chunk;
    logger.warn("yt-dlp stderr", { downloadId, chunk });
  });

  // ── close ─────────────────────────────────────────────────────────────
  proc.on("close", (code) => {
    activeProcesses.delete(downloadId);

    if (code === 0) {
      // Resolve the actual output path
      const resolvedPath = outputFilePath ?? findLatestFile(outputDir);

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
    activeProcesses.delete(downloadId);
    const message = err.message.includes("ENOENT")
      ? `yt-dlp not found at "${env.YTDLP_PATH}". Please install yt-dlp and update YTDLP_PATH in .env`
      : err.message;
    callbacks.onFailed(message);
  });

  // Return cleanup function
  return () => {
    if (activeProcesses.has(downloadId)) {
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
function findLatestFile(dir: string): string | null {
  try {
    const files = fs
      .readdirSync(dir)
      .map((name) => {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);
        return { fullPath, mtime: stat.mtimeMs };
      })
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

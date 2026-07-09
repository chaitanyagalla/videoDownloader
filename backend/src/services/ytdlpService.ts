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
const TITLE_PRINT_PREFIX = "__VIDEOSAVE_TITLE__";

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
 * Validates the YouTube cookie configuration at startup and logs a clear
 * warning when it's missing or misconfigured. Without cookies, YouTube
 * challenges server IPs with "Sign in to confirm you're not a bot" and
 * downloads fail. This never throws — it only surfaces a diagnostic.
 */
export function checkCookieConfig(): void {
  if (env.YTDLP_COOKIES_FILE) {
    if (fs.existsSync(env.YTDLP_COOKIES_FILE)) {
      logger.info("✅  YouTube cookie file found", {
        path: env.YTDLP_COOKIES_FILE,
      });
    } else {
      logger.warn(
        `⚠️  YTDLP_COOKIES_FILE is set to "${env.YTDLP_COOKIES_FILE}" but no ` +
          `file exists there. YouTube downloads will likely fail with ` +
          `"Sign in to confirm you're not a bot". Export cookies to that path ` +
          `(Netscape format) and restart.`,
      );
    }
    return;
  }

  if (env.YTDLP_COOKIES_FROM_BROWSER) {
    logger.info("✅  Using YouTube cookies from browser", {
      browser: env.YTDLP_COOKIES_FROM_BROWSER,
    });
    return;
  }

  logger.warn(
    "⚠️  No YouTube cookies configured (YTDLP_COOKIES_FILE / " +
      "YTDLP_COOKIES_FROM_BROWSER are empty). Downloads from server IPs will " +
      "likely fail with YouTube's bot-detection. See README for how to export " +
      "a cookie file.",
  );
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
    "--no-update",
    "--no-cache-dir",
    "--restrict-filenames",
    "--windows-filenames",
    "--merge-output-format",
    "mp4", // always produce .mp4
    "--newline", // one progress line per newline
    "--no-colors", // clean output without ANSI
    "--print",
    `before_dl:${TITLE_PRINT_PREFIX}%(title)s`,
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

  if (env.YTDLP_PROXY) {
    args.push("--proxy", env.YTDLP_PROXY);
  }

  appendCookieArgs(args);

  args.push(url);

  logger.info("Spawning yt-dlp", {
    downloadId,
    url: maskUrl(url),
    outputDir,
    maxFileSizeMb: env.MAX_DOWNLOAD_FILESIZE_MB,
    maxDurationSeconds: env.MAX_VIDEO_DURATION_SECONDS,
    cookieSource: getCookieSourceLabel(),
    proxy: env.YTDLP_PROXY ? "enabled" : "disabled",
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

      if (line.startsWith(TITLE_PRINT_PREFIX)) {
        const title = line.slice(TITLE_PRINT_PREFIX.length).trim();
        if (title) {
          callbacks.onTitle(title);
        }
        continue;
      }

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
      const errorMessage = formatFailureMessage(stderrBuffer, code);
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
 * Environment variables yt-dlp needs for PATH lookup and browser discovery.
 */
const CHILD_ENV_KEYS = [
  "ALLUSERSPROFILE",
  "APPDATA",
  "CommonProgramFiles",
  "CommonProgramFiles(x86)",
  "CommonProgramW6432",
  "COMSPEC",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LOCALAPPDATA",
  "OS",
  "PATH",
  "Path",
  "PATHEXT",
  "ProgramData",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "ProgramW6432",
  "PUBLIC",
  "SYSTEMDRIVE",
  "SystemDrive",
  "SYSTEMROOT",
  "SystemRoot",
  "TEMP",
  "TMP",
  "USERNAME",
  "USERDOMAIN",
  "USERPROFILE",
  "WINDIR",
  "windir",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
] as const;

function buildChildProcessEnv(): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = {
    PYTHONUNBUFFERED: "1",
  };

  for (const key of CHILD_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      childEnv[key] = value;
    }
  }

  return childEnv;
}

function appendCookieArgs(args: string[]): void {
  if (env.YTDLP_COOKIES_FILE) {
    args.push("--cookies", env.YTDLP_COOKIES_FILE);
    return;
  }

  if (env.YTDLP_COOKIES_FROM_BROWSER) {
    args.push("--cookies-from-browser", env.YTDLP_COOKIES_FROM_BROWSER);
  }
}

function getCookieSourceLabel(): "file" | "browser" | "none" {
  if (env.YTDLP_COOKIES_FILE) {
    return "file";
  }

  if (env.YTDLP_COOKIES_FROM_BROWSER) {
    return "browser";
  }

  return "none";
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

function formatFailureMessage(stderr: string, code: number | null): string {
  const baseMessage =
    extractErrorMessage(stderr) ?? `yt-dlp exited with code ${code}`;
  const combined = `${baseMessage}\n${stderr}`.toLowerCase();

  if (combined.includes("sign in to confirm") && combined.includes("bot")) {
    return `${baseMessage} ${getCookieRecoveryHint()}`;
  }

  if (combined.includes("database is locked")) {
    return `${baseMessage} Close the browser that owns those cookies, then restart the backend and try again. Firefox is usually the easiest local option; an exported cookie file is the most reliable option.`;
  }

  if (
    combined.includes("could not find") &&
    combined.includes("cookies") &&
    env.YTDLP_COOKIES_FROM_BROWSER
  ) {
    return `${baseMessage} Check YTDLP_COOKIES_FROM_BROWSER="${env.YTDLP_COOKIES_FROM_BROWSER}" and make sure that browser/profile exists on this machine.`;
  }

  return baseMessage;
}

function getCookieRecoveryHint(): string {
  if (env.YTDLP_COOKIES_FILE) {
    return "The configured cookie file did not unlock this video. Re-export YouTube cookies from a signed-in browser session in Netscape format, restart the backend, and try again.";
  }

  if (env.YTDLP_COOKIES_FROM_BROWSER) {
    return `Browser cookies are enabled from "${env.YTDLP_COOKIES_FROM_BROWSER}", but they did not unlock this video. Make sure that exact browser/profile is signed in to YouTube, restart the backend, and try again. If it still fails, export cookies to a Netscape-format file and set YTDLP_COOKIES_FILE.`;
  }

  return "Configure YouTube cookies with YTDLP_COOKIES_FROM_BROWSER for local development, or export a Netscape-format cookie file and set YTDLP_COOKIES_FILE.";
}

// src/utils/helpers.ts
import path from "path";
import { env } from "../config/env";
import { Platform } from "../types";

// ─── Platform Detection ────────────────────────────────────────────────────

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

const TWITTER_HOSTS = new Set([
  "twitter.com",
  "www.twitter.com",
  "x.com",
  "www.x.com",
]);

const INSTAGRAM_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
]);

function parseSupportedHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    if (parsed.username || parsed.password) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function detectPlatform(url: string): Platform {
  const parsed = parseSupportedHttpUrl(url);
  if (!parsed) {
    return "unknown";
  }

  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (YOUTUBE_HOSTS.has(host)) {
    if (host === "youtu.be") {
      return segments[0] ? "youtube" : "unknown";
    }

    if (
      (segments[0] === "watch" && parsed.searchParams.has("v")) ||
      (["shorts", "live"].includes(segments[0] ?? "") && Boolean(segments[1]))
    ) {
      return "youtube";
    }
  }

  if (TWITTER_HOSTS.has(host)) {
    if (
      segments.length >= 3 &&
      segments[1] === "status" &&
      /^\d+$/.test(segments[2] ?? "")
    ) {
      return "twitter";
    }
  }

  if (INSTAGRAM_HOSTS.has(host)) {
    if (["p", "reel", "tv"].includes(segments[0] ?? "") && Boolean(segments[1])) {
      return "instagram";
    }
  }

  return "unknown";
}

export function isSupportedUrl(url: string): boolean {
  return detectPlatform(url) !== "unknown";
}

export function isValidUrl(url: string): boolean {
  return parseSupportedHttpUrl(url) !== null;
}

// ─── File System Helpers ───────────────────────────────────────────────────

/**
 * Returns the system Downloads folder path.
 * Windows: C:\Users\<user>\Downloads
 * macOS/Linux: ~/Downloads
 */
export function getDownloadsFolder(): string {
  return env.DOWNLOADS_DIR
    ? path.resolve(env.DOWNLOADS_DIR)
    : path.join(process.cwd(), "downloads");
}

/**
 * Sanitizes a filename by removing characters that are invalid on most OSes.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_") // invalid chars
    .replace(/\s+/g, "_")                     // spaces → underscores
    .replace(/_{2,}/g, "_")                   // collapse multiple underscores
    .replace(/^_|_$/g, "")                    // trim leading/trailing underscores
    .slice(0, 200);                            // max length
}

// ─── Progress Parser ───────────────────────────────────────────────────────

interface YtdlpProgress {
  percent: number;
  speed: string | null;
  eta: string | null;
}

/**
 * Parses yt-dlp stdout progress lines.
 * Example: "[download]  45.3% of 10.23MiB at 1.23MiB/s ETA 00:05"
 */
export function parseYtdlpProgress(line: string): YtdlpProgress | null {
  const progressMatch = line.match(
    /\[download\]\s+([\d.]+)%\s+of\s+[\d.]+\S+\s+at\s+([\d.]+\S+)\s+ETA\s+([\d:]+)/
  );

  if (progressMatch) {
    const [, percentStr, speed, eta] = progressMatch;
    const percent = parseFloat(percentStr ?? "0");
    return {
      percent: isNaN(percent) ? 0 : Math.min(100, Math.max(0, percent)),
      speed: speed ?? null,
      eta: eta ?? null,
    };
  }

  // Handle "100% of ..." (completed)
  const doneMatch = line.match(/\[download\]\s+100%/);
  if (doneMatch) {
    return { percent: 100, speed: null, eta: null };
  }

  return null;
}

/**
 * Parses yt-dlp title from "[info] title: <title>" lines
 */
export function parseYtdlpTitle(line: string): string | null {
  const match = line.match(/\[info\]\s+(.+?):\s+(.+)/);
  if (match && match[1]?.toLowerCase() === "title") {
    return match[2]?.trim() ?? null;
  }

  // Alternative format: "[download] Destination: /path/to/Title.ext"
  const destMatch = line.match(/\[download\]\s+Destination:\s+.+\/(.+)\.\w+$/);
  if (destMatch && destMatch[1]) {
    return destMatch[1].replace(/_/g, " ").trim();
  }

  return null;
}

/**
 * Formats bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Masks a URL for logging (removes query params for privacy)
 */
export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url.slice(0, 50) + "...";
  }
}

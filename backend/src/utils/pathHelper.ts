import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from './logger';

/**
 * Ensures the downloads directory exists, creating it (recursively) if needed.
 * Throws if the directory cannot be created or written to.
 */
export function ensureDownloadsDir(): void {
  const dir = config.downloads.dir;

  if (!fs.existsSync(dir)) {
    logger.info(`Creating downloads directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }

  // Verify write access
  fs.accessSync(dir, fs.constants.W_OK);
}

/**
 * Strips characters that are illegal in filenames on Windows / macOS / Linux,
 * then collapses multiple spaces and trims.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // illegal chars
    .replace(/\s+/g, ' ')                    // collapse whitespace
    .trim()
    .slice(0, 200);                          // cap length
}

/**
 * Returns the absolute path for yt-dlp's output template.
 * Uses the %(title)s and %(ext)s placeholders so yt-dlp fills them in.
 */
export function buildOutputTemplate(): string {
  return path.join(config.downloads.dir, '%(title).100s [%(id)s].%(ext)s');
}

/**
 * Resolves the final file path after yt-dlp has finished.
 * yt-dlp sometimes merges streams, so we look for the newest file in the
 * downloads directory that was created within the last 60 seconds.
 */
export function findLatestDownloadedFile(title: string): string | null {
  try {
    const dir = config.downloads.dir;
    const now = Date.now();
    const threshold = 60_000; // ms

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    const candidates = entries
      .filter((e) => e.isFile())
      .map((e) => {
        const full = path.join(dir, e.name);
        const stat = fs.statSync(full);
        return { name: e.name, full, mtimeMs: stat.mtimeMs };
      })
      .filter((f) => now - f.mtimeMs < threshold)
      .filter((f) => {
        const sanitised = sanitizeFilename(title).toLowerCase().slice(0, 30);
        return f.name.toLowerCase().includes(sanitised);
      });

    if (candidates.length === 0) return null;

    // Return the most recently modified match
    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return candidates[0]?.full ?? null;
  } catch {
    return null;
  }
}

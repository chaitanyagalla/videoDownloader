import type { Platform } from '../types';

// ─── Platform Regex Patterns ──────────────────────────────────────────────────

const PLATFORM_PATTERNS: Record<Exclude<Platform, 'unknown'>, RegExp> = {
  youtube: /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)/i,
  twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+\/status\/\d+/i,
  instagram:
    /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/i,
};

// ─── Public Helpers ───────────────────────────────────────────────────────────

/**
 * Detects which platform a URL belongs to.
 * Returns 'unknown' when none of the supported patterns match.
 */
export function detectPlatform(url: string): Platform {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(url)) {
      return platform as Exclude<Platform, 'unknown'>;
    }
  }
  return 'unknown';
}

/**
 * Returns true only when the URL is a syntactically valid HTTP/HTTPS URL
 * pointing to a supported platform.
 */
export function isSupportedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return detectPlatform(url) !== 'unknown';
  } catch {
    return false;
  }
}

/**
 * Sanitises user-supplied input: trims whitespace, strips tracking parameters
 * that can confuse yt-dlp (e.g. si= from YouTube share links).
 */
export function sanitizeUrl(raw: string): string {
  const trimmed = raw.trim();

  try {
    const url = new URL(trimmed);

    // Remove common tracking/share query params that aren't needed
    const trackingParams = ['si', 'utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'igshid'];
    for (const param of trackingParams) {
      url.searchParams.delete(param);
    }

    return url.toString();
  } catch {
    return trimmed;
  }
}

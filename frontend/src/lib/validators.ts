// src/lib/validators.ts
import { z } from "zod";
import { Platform } from "@/types";

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

function parseHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function detectPlatform(url: string): Platform {
  const parsed = parseHttpUrl(url);
  if (!parsed) {
    return "unknown";
  }

  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (YOUTUBE_HOSTS.has(host)) {
    if (host === "youtu.be") return segments[0] ? "youtube" : "unknown";
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

export function isValidHttpUrl(url: string): boolean {
  return parseHttpUrl(url) !== null;
}

export const urlSchema = z
  .string()
  .min(1, "Please paste a URL")
  .refine(isValidHttpUrl, { message: "Must be a valid URL starting with http/https" })
  .refine(isSupportedUrl, {
    message: "Supported platforms: YouTube, X (Twitter), Instagram",
  });

export type UrlValidationResult =
  | { valid: true; platform: Platform }
  | { valid: false; error: string };

export function validateUrl(url: string): UrlValidationResult {
  const result = urlSchema.safeParse(url);
  if (!result.success) {
    return { valid: false, error: result.error.errors[0]?.message ?? "Invalid URL" };
  }
  return { valid: true, platform: detectPlatform(url) };
}

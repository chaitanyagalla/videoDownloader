// src/lib/validators.ts
import { z } from "zod";
import { Platform } from "@/types";

const PLATFORM_PATTERNS: Record<Exclude<Platform, "unknown">, RegExp[]> = {
  youtube: [
    /^https?:\/\/(www\.)?(youtube\.com\/(watch\?.*v=|shorts\/|live\/)|youtu\.be\/)/,
  ],
  twitter: [
    /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+\/status\//,
  ],
  instagram: [
    /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//,
  ],
};

export function detectPlatform(url: string): Platform {
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    if (patterns.some((p) => p.test(url))) {
      return platform as Platform;
    }
  }
  return "unknown";
}

export function isSupportedUrl(url: string): boolean {
  return detectPlatform(url) !== "unknown";
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
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

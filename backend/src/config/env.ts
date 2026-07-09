// src/config/env.ts
import "dotenv/config";
import { z } from "zod";

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());

const envSchema = z.object({
  PORT: z
    .string()
    .default("4000")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val < 65536, {
      message: "PORT must be a valid port number (1-65535)",
    }),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: optionalTrimmedString,
  GOOGLE_CLIENT_SECRET: optionalTrimmedString,
  GOOGLE_CALLBACK_URL: optionalTrimmedString.pipe(z.string().url().optional()),
  AUTH_COOKIE_NAME: z.string().default("videosave_session"),
  AUTH_SESSION_DAYS: z
    .string()
    .default("30")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "AUTH_SESSION_DAYS must be a positive number",
    }),
  YTDLP_PATH: z.string().default("yt-dlp"),
  YTDLP_COOKIES_FILE: optionalTrimmedString,
  YTDLP_COOKIES_FROM_BROWSER: optionalTrimmedString,
  // Optional proxy for yt-dlp (e.g. http://user:pass@host:port or socks5://host:port).
  // Useful as a fallback when a datacenter IP is flagged by YouTube.
  YTDLP_PROXY: optionalTrimmedString,
  FFMPEG_LOCATION: optionalTrimmedString,
  DOWNLOADS_DIR: optionalTrimmedString,
  MAX_CONCURRENT_DOWNLOADS: z
    .string()
    .default("2")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 10, {
      message: "MAX_CONCURRENT_DOWNLOADS must be between 1 and 10",
    }),
  MAX_DOWNLOAD_FILESIZE_MB: z
    .string()
    .default("500")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "MAX_DOWNLOAD_FILESIZE_MB must be a positive number",
    }),
  MAX_VIDEO_DURATION_SECONDS: z
    .string()
    .default("3600")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "MAX_VIDEO_DURATION_SECONDS must be a positive number",
    }),
  DOWNLOAD_TIMEOUT_MS: z
    .string()
    .default("900000")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 30000, {
      message: "DOWNLOAD_TIMEOUT_MS must be at least 30000",
    }),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("60000")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "RATE_LIMIT_WINDOW_MS must be a positive number",
    }),
  RATE_LIMIT_MAX: z
    .string()
    .default("20")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "RATE_LIMIT_MAX must be a positive number",
    }),
  DOWNLOAD_RATE_LIMIT_MAX: z
    .string()
    .default("5")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "DOWNLOAD_RATE_LIMIT_MAX must be a positive number",
    }),
  TRUST_PROXY_HOPS: z
    .string()
    .default("0")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 0 && val <= 3, {
      message: "TRUST_PROXY_HOPS must be between 0 and 3",
    }),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌  Invalid environment variables:");
  parsed.error.issues.forEach((issue) => {
    console.error(`   ${issue.path.join(".")}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

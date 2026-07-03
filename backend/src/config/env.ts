// src/config/env.ts
import "dotenv/config";
import { z } from "zod";

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
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  AUTH_COOKIE_NAME: z.string().default("videosave_session"),
  AUTH_SESSION_DAYS: z
    .string()
    .default("30")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "AUTH_SESSION_DAYS must be a positive number",
    }),
  YTDLP_PATH: z.string().default("yt-dlp"),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("60000")
    .transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX: z
    .string()
    .default("20")
    .transform((val) => parseInt(val, 10)),
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

import type { NextRequest } from "next/server";
import { ApiError } from "./http";

const attempts = new Map<string, number[]>();

export function enforceDownloadRateLimit(request: NextRequest): void {
  const key =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  const max = Number.parseInt(process.env.DOWNLOAD_RATE_LIMIT_MAX ?? "5", 10) || 5;
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= max) {
    throw new ApiError("Too many requests, please try again later", 429, "RATE_LIMITED");
  }
  recent.push(now);
  attempts.set(key, recent);
}

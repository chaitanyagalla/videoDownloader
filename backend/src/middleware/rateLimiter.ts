// src/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { ApiError } from "../types";

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const response: ApiError = {
      success: false,
      error: {
        message: "Too many requests — please slow down.",
        code: "RATE_LIMITED",
      },
    };
    res.status(429).json(response);
  },
});

// Stricter limiter specifically for starting new downloads
export const downloadRateLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const response: ApiError = {
      success: false,
      error: {
        message: "Too many download requests — please wait a moment.",
        code: "RATE_LIMITED",
      },
    };
    res.status(429).json(response);
  },
});

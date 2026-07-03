// src/app.ts
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Server as SocketServer } from "socket.io";
import { apiRateLimiter } from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { createAuthRouter } from "./routes/authRoutes";
import { createDownloadRouter } from "./routes/downloadRoutes";
import { logger } from "./utils/logger";
import { env } from "./config/env";
import { ServerToClientEvents, ClientToServerEvents } from "./types";

export function createApp(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>
): Application {
  const app = express();

  if (env.TRUST_PROXY_HOPS > 0) {
    app.set("trust proxy", env.TRUST_PROXY_HOPS);
  }

  // ── Security ──────────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // Allow Socket.io
    })
  );

  // ── CORS ──────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );

  // ── Body Parsing ──────────────────────────────────────────────────────
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: false, limit: "10kb" }));

  // ── HTTP Logging ──────────────────────────────────────────────────────
  app.use(
    morgan("combined", {
      stream: { write: (msg: string) => logger.http(msg.trim()) },
      skip: () => env.NODE_ENV === "test",
    })
  );

  // ── Global Rate Limiter ───────────────────────────────────────────────
  app.use("/api", apiRateLimiter);

  // ── Health Check ──────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
        env: env.NODE_ENV,
      },
    });
  });

  // ── API Routes ────────────────────────────────────────────────────────
  app.use("/api/auth", createAuthRouter());
  app.use("/api/downloads", createDownloadRouter(io));

  // ── 404 Handler ───────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── Global Error Handler ──────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}

// src/server.ts
import http from "http";
import { Server as SocketServer } from "socket.io";
import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { verifyYtdlp } from "./services/ytdlpService";
import { getDownloadRoom, getDownloadSnapshot } from "./services/downloadService";
import {
  anonymousClientCookieName,
  getUserBySessionToken,
} from "./services/authService";
import { getCookieValue } from "./utils/cookies";
import { ServerToClientEvents, ClientToServerEvents } from "./types";
// import { findDownloadById } from "./models/downloadModel";

function normalizeCookieHeader(
  cookieHeader: string | string[] | undefined
): string | undefined {
  return Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
}

async function getSocketIdentity(
  cookieHeader: string | string[] | undefined
): Promise<{ userId?: string; anonymousClientId?: string | null }> {
  const cookies = normalizeCookieHeader(cookieHeader);
  const sessionToken = getCookieValue(cookies, env.AUTH_COOKIE_NAME);
  const user = sessionToken ? await getUserBySessionToken(sessionToken) : null;

  return {
    userId: user?.id,
    anonymousClientId: getCookieValue(cookies, anonymousClientCookieName),
  };
}

async function bootstrap(): Promise<void> {
  // ── 1. Verify yt-dlp ──────────────────────────────────────────────────
  const ytdlpOk = await verifyYtdlp();
  if (!ytdlpOk) {
    logger.error(
      `❌  yt-dlp not found at "${env.YTDLP_PATH}". ` +
        `Please install it and set YTDLP_PATH in your .env file.\n` +
        `  macOS:  brew install yt-dlp\n` +
        `  Linux:  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp\n` +
        `  Windows: winget install yt-dlp`
    );
    process.exit(1);
  }
  logger.info("✅  yt-dlp verified");

  // ── 2. Connect Database ───────────────────────────────────────────────
  await connectDatabase();

  // ── 3. Create HTTP server + Socket.io ─────────────────────────────────
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>({
    cors: {
      origin: env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingInterval: 10_000,
    pingTimeout: 5_000,
  });

  const app = createApp(io);
  const httpServer = http.createServer(app);

  io.attach(httpServer);

  // ── Socket.io connection handler ──────────────────────────────────────
//   io.on("connection", (socket) => {
//   socket.on("subscribe:download", async (downloadId: string) => {
//     console.log("Client subscribed to:", downloadId);
//     void socket.join(`download:${downloadId}`);

//     // ── Catch-up: send current state immediately ──────────────────────
//     // Handles the race where download finishes before client subscribes
//     try {
//       const record = await findDownloadById(downloadId);
//       if (!record) return;

//       if (record.status === "completed" && record.filePath) {
//         socket.emit("download:completed", {
//           id: record.id,
//           filePath: record.filePath,
//           fileSize: record.fileSize,
//         });
//       } else if (record.status === "failed" && record.errorMsg) {
//         socket.emit("download:failed", {
//           id: record.id,
//           error: record.errorMsg,
//         });
//       } else if (record.status === "downloading") {
//         // Send last known progress so bar doesn't sit at 0%
//         socket.emit("download:progress", {
//           id: record.id,
//           progress: record.progress,
//           speed: record.speed,
//           eta: record.eta,
//         });
//       }
//     } catch (err) {
//       logger.error("Failed to send catch-up state", { downloadId, err });
//     }
//   });
// });

  io.on("connection", (socket) => {
  logger.debug("Socket connected", { id: socket.id });

  // Remove subscribe:download handler entirely — rooms not used anymore

  socket.on("subscribe:download", async (downloadId) => {
    if (typeof downloadId !== "string" || downloadId.length > 100) {
      return;
    }

    try {
      const identity = await getSocketIdentity(socket.handshake.headers.cookie);
      const record = await getDownloadSnapshot(
        downloadId,
        identity.userId,
        identity.anonymousClientId
      );
      if (!record) {
        return;
      }

      const room = getDownloadRoom(downloadId);
      await socket.join(room);

      if (record.title) {
        socket.emit("download:title", {
          id: record.id,
          title: record.title,
        });
      }

      socket.emit("download:progress", {
        id: record.id,
        progress: record.progress,
        speed: record.speed,
        eta: record.eta,
      });

      if (record.status === "completed" && record.filePath) {
        socket.emit("download:completed", {
          id: record.id,
          filePath: record.filePath,
          fileSize: record.fileSize,
        });
      }

      if (record.status === "failed" && record.errorMsg) {
        socket.emit("download:failed", {
          id: record.id,
          error: record.errorMsg,
        });
      }
    } catch (err) {
      logger.error("Failed to send download snapshot", { downloadId, err });
    }
  });

  socket.on("unsubscribe:download", (downloadId) => {
    if (typeof downloadId !== "string" || downloadId.length > 100) {
      return;
    }

    void socket.leave(getDownloadRoom(downloadId));
  });

  socket.on("disconnect", (reason) => {
    logger.debug("Socket disconnected", { id: socket.id, reason });
  });
})


  // ── 4. Start Listening ────────────────────────────────────────────────
  httpServer.listen(env.PORT, () => {
    logger.info(`🚀  Server running on http://localhost:${env.PORT}`);
    logger.info(`📡  Socket.io ready`);
    logger.info(`🌐  Accepting requests from ${env.FRONTEND_URL}`);
  });

  // ── 5. Graceful Shutdown ──────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`\n${signal} received — shutting down gracefully...`);

    httpServer.close(async () => {
      await io.close();
      await disconnectDatabase();
      logger.info("✅  Server closed cleanly");
      process.exit(0);
    });

    // Force-kill if graceful shutdown takes too long
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception", { message: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection", { reason });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server", { err });
  process.exit(1);
});

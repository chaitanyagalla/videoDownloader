// src/routes/downloadRoutes.ts
import { Router } from "express";
import { Server as SocketServer } from "socket.io";
import { createDownloadController } from "../controllers/downloadController";
import { optionalAuth } from "../middleware/authMiddleware";
import { validateRequest } from "../middleware/validateRequest";
import { downloadRateLimiter } from "../middleware/rateLimiter";
import { createDownloadSchema } from "../services/downloadService";
import { ServerToClientEvents, ClientToServerEvents } from "../types";

export function createDownloadRouter(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>
): Router {
  const router = Router();
  const controller = createDownloadController(io);

  // GET /api/downloads — list all
  router.use(optionalAuth);

  router.get("/", controller.list);

  // GET /api/downloads/:id/file — send completed file to user's browser
  router.get("/:id/file", controller.file);

  // GET /api/downloads/:id — get one
  router.get("/:id", controller.get);

  // POST /api/downloads — start download (rate-limited + validated)
  router.post(
    "/",
    downloadRateLimiter,
    validateRequest(createDownloadSchema, "body"),
    controller.create
  );

  // DELETE /api/downloads/:id — remove record
  router.delete("/:id", controller.remove);

  return router;
}

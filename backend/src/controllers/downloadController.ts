// src/controllers/downloadController.ts
import { Request, Response, NextFunction } from "express";
import { Server as SocketServer } from "socket.io";
import {
  getDownloadsForUser,
  getDownloadById,
  initiateDownload,
  removeDownload,
  CreateDownloadDto,
} from "../services/downloadService";
import { ApiResponse } from "../types";
import { DownloadRecord, ServerToClientEvents, ClientToServerEvents } from "../types";

/**
 * Controller factory – injects the Socket.io server instance so
 * controllers can emit real-time events.
 */
export function createDownloadController(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>
) {
  return {
    /**
     * GET /api/downloads
     * Returns all download records, newest first.
     */
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const downloads = await getDownloadsForUser(req.authUser?.id);
        const response: ApiResponse<DownloadRecord[]> = {
          success: true,
          data: downloads,
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/downloads/:id
     * Returns a single download record.
     */
    async get(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const download = await getDownloadById(
          req.params["id"] ?? "",
          req.authUser?.id
        );
        const response: ApiResponse<DownloadRecord> = {
          success: true,
          data: download,
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/downloads
     * Creates a new download and immediately starts yt-dlp.
     * Body: { url: string }
     */
    async create(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = req.body as CreateDownloadDto;
        const download = await initiateDownload(dto, io, req.authUser?.id);
        const response: ApiResponse<DownloadRecord> = {
          success: true,
          data: download,
        };
        res.status(202).json(response); // 202 Accepted — download is processing
      } catch (err) {
        next(err);
      }
    },

    /**
     * DELETE /api/downloads/:id
     * Removes a download record from the database.
     */
    async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        await removeDownload(req.params["id"] ?? "", req.authUser?.id);
        const response: ApiResponse<null> = { success: true, data: null };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },
  };
}

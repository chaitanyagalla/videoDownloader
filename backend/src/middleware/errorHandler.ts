// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { ApiError } from "../types";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // ── Zod Validation Error ──────────────────────────────────────────────
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    const response: ApiError = {
      success: false,
      error: { message: "Validation failed", code: "VALIDATION_ERROR", details },
    };
    res.status(400).json(response);
    return;
  }

  // ── Known Operational AppError ────────────────────────────────────────
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error("Non-operational AppError", {
        message: err.message,
        stack: err.stack,
        path: req.path,
      });
    }
    const response: ApiError = {
      success: false,
      error: {
        message: err.message,
        code: err.code,
        details: err.details,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // ── Prisma Errors ─────────────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn("Prisma known request error", { code: err.code, meta: err.meta });

    if (err.code === "P2025") {
      // Record not found
      const response: ApiError = {
        success: false,
        error: { message: "Resource not found", code: "NOT_FOUND" },
      };
      res.status(404).json(response);
      return;
    }

    if (err.code === "P2002") {
      // Unique constraint violation
      const response: ApiError = {
        success: false,
        error: { message: "Resource already exists", code: "CONFLICT" },
      };
      res.status(409).json(response);
      return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error("Prisma validation error", { message: (err as Error).message });
    const response: ApiError = {
      success: false,
      error: { message: "Database validation error", code: "DB_VALIDATION_ERROR" },
    };
    res.status(400).json(response);
    return;
  }

  // ── Unknown / Unhandled Errors ────────────────────────────────────────
  const message = err instanceof Error ? err.message : "An unexpected error occurred";
  logger.error("Unhandled error", {
    message,
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  const response: ApiError = {
    success: false,
    error: {
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : message,
      code: "INTERNAL_ERROR",
    },
  };
  res.status(500).json(response);
}

// Catch-all for 404 routes
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route ${req.method} ${req.path}`));
}

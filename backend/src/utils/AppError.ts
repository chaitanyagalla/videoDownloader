// src/utils/AppError.ts

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_ERROR",
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, "BAD_REQUEST", details);
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError(message, 401, "UNAUTHORIZED");
  }

  static serviceUnavailable(message: string, code = "SERVICE_UNAVAILABLE"): AppError {
    return new AppError(message, 503, code);
  }

  static notFound(resource: string): AppError {
    return new AppError(`${resource} not found`, 404, "NOT_FOUND");
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409, "CONFLICT");
  }

  static tooManyRequests(): AppError {
    return new AppError(
      "Too many requests, please try again later",
      429,
      "RATE_LIMITED"
    );
  }

  static internalError(message = "An unexpected error occurred"): AppError {
    return new AppError(message, 500, "INTERNAL_ERROR", undefined, false);
  }
}

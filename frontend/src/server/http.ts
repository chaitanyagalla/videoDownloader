import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly code = "INTERNAL_ERROR",
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiFailure(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.issues[0]?.message ?? "Invalid request",
          code: "VALIDATION_ERROR",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError("An unexpected error occurred");

  if (!(error instanceof ApiError)) {
    console.error("Unhandled API error", error);
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        message: apiError.message,
        code: apiError.code,
        ...(apiError.details === undefined ? {} : { details: apiError.details }),
      },
    },
    { status: apiError.status }
  );
}

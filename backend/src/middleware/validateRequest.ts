// src/middleware/validateRequest.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ApiError } from "../types";

type RequestPart = "body" | "query" | "params";

/**
 * Factory function that returns an Express middleware which validates
 * a specific part of the request against a Zod schema.
 *
 * Usage:
 *   router.post("/", validateRequest(mySchema, "body"), myController)
 */
export function validateRequest<T>(
  schema: ZodSchema<T>,
  part: RequestPart = "body"
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const details = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      const response: ApiError = {
        success: false,
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details,
        },
      };

      res.status(400).json(response);
      return;
    }

    // Attach validated + typed data back to request
    req[part] = result.data as typeof req[typeof part];
    next();
  };
}

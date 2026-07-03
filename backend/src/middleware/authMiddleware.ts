import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import {
  clearSessionCookie,
  getUserBySessionToken,
} from "../services/authService";
import { AppError } from "../utils/AppError";
import { getCookieValue } from "../utils/cookies";

export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = getCookieValue(req.headers.cookie, env.AUTH_COOKIE_NAME);

    if (!token) {
      next();
      return;
    }

    const user = await getUserBySessionToken(token);

    if (!user) {
      res.append("Set-Cookie", clearSessionCookie());
      next();
      return;
    }

    req.authUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    next(AppError.unauthorized());
    return;
  }

  next();
}

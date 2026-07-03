import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import {
  buildOAuthStateCookie,
  buildSessionCookie,
  clearOAuthStateCookie,
  clearSessionCookie,
  createGoogleAuthUrl,
  createOAuthState,
  isValidOAuthState,
  oauthStateCookieName,
  revokeSession,
  signInWithGoogleCode,
} from "../services/authService";
import { ApiResponse, AuthUser } from "../types";
import { AppError } from "../utils/AppError";
import { getCookieValue } from "../utils/cookies";

function buildFrontendRedirect(params: Record<string, string>): string {
  const url = new URL(env.FRONTEND_URL);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

export function createAuthController() {
  return {
    async me(req: Request, res: Response): Promise<void> {
      const response: ApiResponse<AuthUser | null> = {
        success: true,
        data: req.authUser ?? null,
      };

      res.status(200).json(response);
    },

    async startGoogleAuth(
      _req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const state = createOAuthState();

        res.append("Set-Cookie", buildOAuthStateCookie(state));
        res.redirect(createGoogleAuthUrl(state));
      } catch (err) {
        next(err);
      }
    },

    async handleGoogleCallback(
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        if (typeof req.query["error"] === "string") {
          res.append("Set-Cookie", clearOAuthStateCookie());
          res.redirect(
            buildFrontendRedirect({ auth_error: req.query["error"] })
          );
          return;
        }

        const code = req.query["code"];
        const state = req.query["state"];

        if (typeof code !== "string" || typeof state !== "string") {
          throw AppError.badRequest("Google callback is missing code or state");
        }

        const expectedState = getCookieValue(
          req.headers.cookie,
          oauthStateCookieName
        );

        if (!isValidOAuthState(expectedState, state)) {
          throw AppError.badRequest("Invalid Google OAuth state");
        }

        const { sessionToken } = await signInWithGoogleCode(code);

        res.append("Set-Cookie", clearOAuthStateCookie());
        res.append("Set-Cookie", buildSessionCookie(sessionToken));
        res.redirect(buildFrontendRedirect({ signed_in: "1" }));
      } catch (err) {
        next(err);
      }
    },

    async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const token = getCookieValue(req.headers.cookie, env.AUTH_COOKIE_NAME);

        if (token) {
          await revokeSession(token);
        }

        res.append("Set-Cookie", clearSessionCookie());

        const response: ApiResponse<null> = {
          success: true,
          data: null,
        };

        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },
  };
}

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AuthUser } from "@/types";
import { env } from "./env";
import { ApiError } from "./http";
import { prisma } from "./prisma";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";
const OAUTH_STATE_COOKIE = `${env.authCookieName}_oauth_state`;
export const anonymousCookieName = `${env.authCookieName}_anon`;

const googleTokenSchema = z.object({ access_token: z.string().min(1) });
const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

type GoogleProfile = z.infer<typeof googleProfileSchema>;

function cookieOptions(maxAge: number, path = "/") {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function mapUser(user: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}): AuthUser {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
}

function googleConfig() {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new ApiError(
      "Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to frontend/.env.local locally, or to the Vercel project environment when deployed.",
      503,
      "AUTH_NOT_CONFIGURED"
    );
  }
  return { clientId: env.googleClientId, clientSecret: env.googleClientSecret };
}

function callbackUrl(requestUrl?: string): string {
  if (env.googleCallbackUrl) return env.googleCallbackUrl;
  const origin = requestUrl ? new URL(requestUrl).origin : env.appUrl;
  return `${origin}/api/auth/google/callback`;
}

async function json(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function currentUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(env.authCookieName)?.value;
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.authSession.delete({ where: { id: session.id } });
    return null;
  }

  void prisma.authSession
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);
  return mapUser(session.user);
}

export function ensureAnonymousIdentity(
  request: NextRequest,
  response: NextResponse
): string {
  const existing = request.cookies.get(anonymousCookieName)?.value;
  if (existing) return existing;
  const token = randomBytes(32).toString("base64url");
  response.cookies.set(anonymousCookieName, token, cookieOptions(7 * 24 * 60 * 60));
  return token;
}

export function anonymousIdentity(request: NextRequest): string | undefined {
  return request.cookies.get(anonymousCookieName)?.value;
}

export function beginGoogleAuth(request: NextRequest, response: NextResponse): void {
  const config = googleConfig();
  const state = randomBytes(32).toString("base64url");
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", callbackUrl(request.url));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  response.headers.set("Location", url.toString());
  response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions(10 * 60, "/api/auth/google"));
}

function validState(expected: string | undefined, actual: string): boolean {
  if (!expected) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function finishGoogleAuth(
  request: NextRequest,
  code: string,
  state: string
): Promise<string> {
  if (!validState(request.cookies.get(OAUTH_STATE_COOKIE)?.value, state)) {
    throw new ApiError("Invalid Google OAuth state", 400, "BAD_REQUEST");
  }

  const config = googleConfig();
  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: callbackUrl(request.url),
      grant_type: "authorization_code",
    }),
  });
  const tokenPayload = await json(tokenResponse);
  const token = googleTokenSchema.safeParse(tokenPayload);
  if (!tokenResponse.ok || !token.success) {
    throw new ApiError("Google sign-in could not be completed", 400, "BAD_REQUEST");
  }

  const profileResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${token.data.access_token}` },
  });
  const profilePayload = await json(profileResponse);
  const parsedProfile = googleProfileSchema.safeParse(profilePayload);
  if (!profileResponse.ok || !parsedProfile.success) {
    throw new ApiError("Google profile could not be loaded", 400, "BAD_REQUEST");
  }
  if (parsedProfile.data.email_verified === false) {
    throw new ApiError("Google account email is not verified", 401, "UNAUTHORIZED");
  }

  const user = await upsertGoogleUser(parsedProfile.data);
  const sessionToken = randomBytes(32).toString("base64url");
  await prisma.authSession.create({
    data: {
      tokenHash: hashToken(sessionToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + env.authSessionDays * 24 * 60 * 60 * 1000),
    },
  });
  return sessionToken;
}

async function upsertGoogleUser(profile: GoogleProfile): Promise<AuthUser> {
  const existing = await prisma.user.findFirst({
    where: { provider: "google", providerAccountId: profile.sub },
  });
  const data = {
    email: profile.email,
    name: profile.name ?? null,
    avatarUrl: profile.picture ?? null,
    provider: "google",
    providerAccountId: profile.sub,
  };
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data })
    : await prisma.user.upsert({
        where: { email: profile.email },
        create: data,
        update: data,
      });
  return mapUser(user);
}

export async function logout(request: NextRequest, response: NextResponse): Promise<void> {
  const token = request.cookies.get(env.authCookieName)?.value;
  if (token) {
    await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  response.cookies.set(env.authCookieName, "", cookieOptions(0));
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(
    env.authCookieName,
    token,
    cookieOptions(env.authSessionDays * 24 * 60 * 60)
  );
}

export function clearOAuthCookie(response: NextResponse): void {
  response.cookies.set(OAUTH_STATE_COOKIE, "", cookieOptions(0, "/api/auth/google"));
}

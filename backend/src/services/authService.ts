import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { clearCookie, serializeCookie } from "../utils/cookies";
import type { AuthUser } from "../types";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_PROVIDER = "google";

const googleTokenSchema = z.object({
  access_token: z.string().min(1),
});

const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

type GoogleProfile = z.infer<typeof googleProfileSchema>;

export const oauthStateCookieName = `${env.AUTH_COOKIE_NAME}_oauth_state`;
export const anonymousClientCookieName = `${env.AUTH_COOKIE_NAME}_anon`;

function isSecureCookie(): boolean {
  return env.NODE_ENV === "production";
}

function getSessionMaxAgeSeconds(): number {
  return env.AUTH_SESSION_DAYS * 24 * 60 * 60;
}

function getSessionExpiresAt(): Date {
  return new Date(Date.now() + getSessionMaxAgeSeconds() * 1000);
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function mapUser(user: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

function getGoogleCallbackUrl(): string {
  return (
    env.GOOGLE_CALLBACK_URL ??
    `http://localhost:${env.PORT}/api/auth/google/callback`
  );
}

function getGoogleOAuthConfig(): {
  clientId: string;
  clientSecret: string;
} {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw AppError.serviceUnavailable(
      "Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the backend environment.",
      "AUTH_NOT_CONFIGURED"
    );
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function exchangeCodeForAccessToken(code: string): Promise<string> {
  const config = getGoogleOAuthConfig();

  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: getGoogleCallbackUrl(),
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw AppError.badRequest("Google sign-in could not be completed", payload);
  }

  const parsed = googleTokenSchema.safeParse(payload);
  if (!parsed.success) {
    throw AppError.badRequest("Google returned an invalid token response");
  }

  return parsed.data.access_token;
}

async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw AppError.badRequest("Google profile could not be loaded", payload);
  }

  const parsed = googleProfileSchema.safeParse(payload);
  if (!parsed.success) {
    throw AppError.badRequest("Google returned an invalid profile response");
  }

  if (parsed.data.email_verified === false) {
    throw AppError.unauthorized("Google account email is not verified");
  }

  return parsed.data;
}

async function upsertGoogleUser(profile: GoogleProfile): Promise<AuthUser> {
  const existingProviderUser = await prisma.user.findFirst({
    where: {
      provider: GOOGLE_PROVIDER,
      providerAccountId: profile.sub,
    },
  });

  if (existingProviderUser) {
    const updated = await prisma.user.update({
      where: { id: existingProviderUser.id },
      data: {
        email: profile.email,
        name: profile.name ?? null,
        avatarUrl: profile.picture ?? null,
      },
    });

    return mapUser(updated);
  }

  const user = await prisma.user.upsert({
    where: { email: profile.email },
    create: {
      email: profile.email,
      name: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
      provider: GOOGLE_PROVIDER,
      providerAccountId: profile.sub,
    },
    update: {
      name: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
      provider: GOOGLE_PROVIDER,
      providerAccountId: profile.sub,
    },
  });

  return mapUser(user);
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function isValidOAuthState(
  expectedState: string | null,
  actualState: string
): boolean {
  if (!expectedState) {
    return false;
  }

  const expected = Buffer.from(expectedState);
  const actual = Buffer.from(actualState);

  if (expected.byteLength !== actual.byteLength) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function createGoogleAuthUrl(state: string): string {
  const config = getGoogleOAuthConfig();

  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", getGoogleCallbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  return url.toString();
}

export function buildOAuthStateCookie(state: string): string {
  return serializeCookie(oauthStateCookieName, state, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "Lax",
    maxAge: 10 * 60,
    path: "/api/auth/google",
  });
}

export function clearOAuthStateCookie(): string {
  return clearCookie(oauthStateCookieName, "/api/auth/google");
}

export function buildSessionCookie(token: string): string {
  return serializeCookie(env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "Lax",
    maxAge: getSessionMaxAgeSeconds(),
    path: "/",
  });
}

export function clearSessionCookie(): string {
  return clearCookie(env.AUTH_COOKIE_NAME);
}

export function createAnonymousClientToken(): string {
  return randomBytes(32).toString("base64url");
}

export function buildAnonymousClientCookie(token: string): string {
  return serializeCookie(anonymousClientCookieName, token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  await prisma.authSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt: getSessionExpiresAt(),
    },
  });

  return token;
}

export async function getUserBySessionToken(
  token: string
): Promise<AuthUser | null> {
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.authSession.delete({ where: { id: session.id } });
    return null;
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return mapUser(session.user);
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.authSession.deleteMany({
    where: { tokenHash: hashSessionToken(token) },
  });
}

export async function signInWithGoogleCode(code: string): Promise<{
  user: AuthUser;
  sessionToken: string;
}> {
  const accessToken = await exchangeCodeForAccessToken(code);
  const profile = await fetchGoogleProfile(accessToken);
  const user = await upsertGoogleUser(profile);
  const sessionToken = await createSession(user.id);

  return { user, sessionToken };
}

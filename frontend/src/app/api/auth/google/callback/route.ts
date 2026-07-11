import { NextResponse, type NextRequest } from "next/server";
import {
  clearOAuthCookie,
  finishGoogleAuth,
  setSessionCookie,
} from "@/server/auth";
import { env } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function frontendRedirect(request: NextRequest, params: Record<string, string>): URL {
  const target = new URL(env.appUrl || request.nextUrl.origin);
  Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, value));
  return target;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    const response = NextResponse.redirect(
      frontendRedirect(request, { auth_error: oauthError })
    );
    clearOAuthCookie(response);
    return response;
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      frontendRedirect(request, { auth_error: "missing_code_or_state" })
    );
  }

  try {
    const sessionToken = await finishGoogleAuth(request, code, state);
    const response = NextResponse.redirect(frontendRedirect(request, { signed_in: "1" }));
    clearOAuthCookie(response);
    setSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    const response = NextResponse.redirect(
      frontendRedirect(request, { auth_error: "sign_in_failed" })
    );
    clearOAuthCookie(response);
    return response;
  }
}

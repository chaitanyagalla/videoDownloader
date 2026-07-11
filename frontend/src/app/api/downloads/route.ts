import { randomBytes } from "node:crypto";
import { after, type NextRequest, NextResponse } from "next/server";
import { anonymousCookieName, currentUser } from "@/server/auth";
import {
  createDownload,
  createDownloadSchema,
  listDownloads,
  processDownload,
} from "@/server/downloads";
import { apiFailure, apiSuccess } from "@/server/http";
import { enforceDownloadRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await currentUser(request);
    return apiSuccess(await listDownloads(user ? { userId: user.id } : {}));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    enforceDownloadRateLimit(request);
    const body = createDownloadSchema.parse(await request.json());
    const user = await currentUser(request);
    const existingAnonymousId = request.cookies.get(anonymousCookieName)?.value;
    const anonymousClientId = user
      ? undefined
      : existingAnonymousId ?? randomBytes(32).toString("base64url");
    const record = await createDownload(body.url, {
      userId: user?.id,
      anonymousClientId,
    });
    const response = apiSuccess(record, 202);
    if (!user && !existingAnonymousId && anonymousClientId) {
      response.cookies.set(anonymousCookieName, anonymousClientId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });
    }
    after(() => processDownload(record.id, body.url));
    return response;
  } catch (error) {
    return apiFailure(error);
  }
}

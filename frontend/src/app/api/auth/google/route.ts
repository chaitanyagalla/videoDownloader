import { NextResponse, type NextRequest } from "next/server";
import { beginGoogleAuth } from "@/server/auth";
import { apiFailure } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest): NextResponse {
  try {
    const response = new NextResponse(null, { status: 302 });
    beginGoogleAuth(request, response);
    return response;
  } catch (error) {
    return apiFailure(error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { logout } from "@/server/auth";
import { apiFailure } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const response = NextResponse.json({ success: true, data: null });
    await logout(request, response);
    return response;
  } catch (error) {
    return apiFailure(error);
  }
}

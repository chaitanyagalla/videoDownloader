import type { NextRequest } from "next/server";
import { currentUser } from "@/server/auth";
import { apiFailure, apiSuccess } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return apiSuccess(await currentUser(request));
  } catch (error) {
    return apiFailure(error);
  }
}

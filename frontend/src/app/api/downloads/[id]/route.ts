import type { NextRequest } from "next/server";
import { apiFailure, apiSuccess } from "@/server/http";
import { getDownload, removeDownload } from "@/server/downloads";
import { requestOwner } from "@/server/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    return apiSuccess(await getDownload(id, await requestOwner(request)));
  } catch (error) {
    return apiFailure(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    await removeDownload(id, await requestOwner(request));
    return apiSuccess(null);
  } catch (error) {
    return apiFailure(error);
  }
}

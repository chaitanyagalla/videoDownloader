import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { getDownloadDelivery } from "@/server/downloads";
import { apiFailure } from "@/server/http";
import { requestOwner } from "@/server/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const delivery = await getDownloadDelivery(id, await requestOwner(request));
    if (delivery.kind === "redirect") {
      return NextResponse.redirect(delivery.url, 307);
    }

    const stream = Readable.toWeb(createReadStream(delivery.filePath));
    return new NextResponse(stream as ReadableStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(delivery.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(delivery.fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiFailure(error);
  }
}

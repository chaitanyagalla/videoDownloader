import type { NextRequest } from "next/server";
import { anonymousIdentity, currentUser } from "./auth";

export async function requestOwner(request: NextRequest): Promise<{
  userId?: string;
  anonymousClientId?: string;
}> {
  const user = await currentUser(request);
  return user
    ? { userId: user.id }
    : { anonymousClientId: anonymousIdentity(request) };
}

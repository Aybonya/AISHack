import { NextResponse } from "next/server";

import { getLiveSnapshot, updateLiveTaskStatus } from "@/lib/server/greenapi-bridge";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const body = await request.json();
  const { id } = await context.params;

  await updateLiveTaskStatus(id, body.status);
  return NextResponse.json(await getLiveSnapshot());
}

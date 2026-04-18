import { NextResponse } from "next/server";

import { createLiveTask, getLiveSnapshot } from "@/lib/server/greenapi-bridge";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();

  await createLiveTask({
    title: String(body.title || ""),
    description: String(body.description || ""),
    assigneeUserId: String(body.assigneeUserId || ""),
    dueDate: String(body.dueDate || new Date().toISOString()),
  });

  return NextResponse.json(await getLiveSnapshot());
}

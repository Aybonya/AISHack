import { NextResponse } from "next/server";

import { getLiveSnapshot, processLiveMessage } from "@/lib/server/greenapi-bridge";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();

  await processLiveMessage({
    chatId: String(body.chatId || "chat-general"),
    senderId: String(body.senderId || "director-janar"),
    senderType: body.senderType === "teacher" ? "teacher" : "director",
    text: String(body.text || ""),
    kind: body.kind === "voice" ? "voice" : "text",
  });

  return NextResponse.json(await getLiveSnapshot());
}

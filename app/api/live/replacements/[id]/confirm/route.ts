import { NextResponse } from "next/server";

import { confirmLiveSuggestion, getLiveSnapshot } from "@/lib/server/greenapi-bridge";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const body = await request.json().catch(() => ({}));
  const { id } = await context.params;

  await confirmLiveSuggestion(id, body.candidateTeacherId || null);
  return NextResponse.json(await getLiveSnapshot());
}

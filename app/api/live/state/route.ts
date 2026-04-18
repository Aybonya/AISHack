import { NextResponse } from "next/server";

import { getLiveSnapshot } from "@/lib/server/greenapi-bridge";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = await getLiveSnapshot();
  return NextResponse.json(snapshot);
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { tryLoadRuntime } = await import("@/lib/server/greenapi-bridge");
    const { runtime, error } = tryLoadRuntime();
    if (!runtime) return NextResponse.json({ error }, { status: 503 });

    const { db } = runtime.firebase ?? (await import("@/lib/server/firebase-admin"));
    await db.collection("director_events").doc(params.id).delete();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

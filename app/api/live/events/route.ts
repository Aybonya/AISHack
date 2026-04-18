import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET() {
  try {
    const { tryLoadRuntime } = await import("@/lib/server/greenapi-bridge");
    const { runtime, error } = tryLoadRuntime();
    if (!runtime) return NextResponse.json({ error }, { status: 503 });

    const events = await runtime.schoolDataService.loadCollection("director_events", {
      limit: 200,
      forceRefresh: true,
    });
    return NextResponse.json({ events });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, startTime, endTime, description, participants } = body;

    if (!title || !startTime) {
      return NextResponse.json({ error: "title and startTime are required" }, { status: 400 });
    }

    const { tryLoadRuntime } = await import("@/lib/server/greenapi-bridge");
    const { runtime, error } = tryLoadRuntime();
    if (!runtime) return NextResponse.json({ error }, { status: 503 });

    const { db, admin } = runtime.firebase ?? (await import("@/lib/server/firebase-admin"));
    const ref = db.collection("director_events").doc();
    await ref.set({
      title,
      startTime,
      endTime: endTime ?? null,
      description: description ?? "",
      participants: participants ?? [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: "director-janar",
    });

    return NextResponse.json({ id: ref.id, ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

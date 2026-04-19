import { NextRequest, NextResponse } from "next/server";

// Прокси-роут: фронтенд обращается сюда, а мы перенаправляем на Express (порт 3001)
// Это нужно чтобы избежать проблем с CORS при прямых вызовах браузера к localhost:3001

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const backendRes = await fetch(
      "http://localhost:3001/api/integrations/cafeteria/send-report",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  const form = await request.formData();
  const audio = form.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  const openAiForm = new FormData();
  openAiForm.append("file", audio, audio.name || "ais-orb-recording.webm");
  openAiForm.append("model", DEFAULT_TRANSCRIPTION_MODEL);
  openAiForm.append("response_format", "json");

  const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: openAiForm,
  });

  const payload = (await response.json()) as { text?: string; error?: { message?: string } };

  if (!response.ok) {
    return NextResponse.json(
      { error: payload.error?.message || "OpenAI transcription failed." },
      { status: response.status },
    );
  }

  return NextResponse.json({ text: payload.text ?? "" });
}

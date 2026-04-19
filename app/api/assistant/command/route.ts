import { NextResponse } from "next/server";

import type { AssistantCommandPlan } from "@/lib/assistant/command-types";

export const runtime = "nodejs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_ASSISTANT_MODEL = "gpt-5.4-mini";

const commandPlanSchema = {
  name: "assistant_command_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "actions"],
    properties: {
      reply: {
        type: "string",
      },
      actions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "type",
            "title",
            "description",
            "assigneeUserId",
            "dueDate",
            "taskId",
            "taskStatus",
            "incidentId",
            "incidentStatus",
            "suggestionId",
            "chatId",
            "text",
            "kind",
            "path",
          ],
          properties: {
            type: {
              type: "string",
              enum: [
                "create_task",
                "update_task_status",
                "update_incident_status",
                "confirm_suggestion",
                "send_cafeteria_summary",
                "navigate",
                "send_message",
                "mark_chat_read",
                "reset_demo",
              ],
            },
            title: { type: ["string", "null"] },
            description: { type: ["string", "null"] },
            assigneeUserId: { type: ["string", "null"] },
            dueDate: { type: ["string", "null"] },
            taskId: { type: ["string", "null"] },
            taskStatus: { type: ["string", "null"], enum: ["new", "in_progress", "done", null] },
            incidentId: { type: ["string", "null"] },
            incidentStatus: { type: ["string", "null"], enum: ["new", "in_progress", "resolved", null] },
            suggestionId: { type: ["string", "null"] },
            chatId: { type: ["string", "null"] },
            text: { type: ["string", "null"] },
            kind: { type: ["string", "null"], enum: ["text", "voice", null] },
            path: { type: ["string", "null"] },
          },
        },
      },
    },
  },
} as const;

function extractStructuredText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const response = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }

  return null;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as {
    command?: string;
    state?: unknown;
  };

  const command = String(body.command ?? "").trim();

  if (!command) {
    return NextResponse.json({ error: "Command is required." }, { status: 400 });
  }

  const developerPrompt = [
    "You are AISana's command planner for a school operations dashboard.",
    "Decide which supported site actions to execute for the user's command.",
    "You may read the provided site state summary and answer questions from it.",
    "Only use IDs that exist in the provided state.",
    "If no mutation is needed, return an empty actions array.",
    "Supported actions:",
    "- create_task: create a task with title, description, assigneeUserId, dueDate",
    "- update_task_status: update an existing task by taskId and taskStatus",
    "- update_incident_status: update an incident by incidentId and incidentStatus",
    "- confirm_suggestion: confirm a substitution suggestion by suggestionId",
    "- send_cafeteria_summary: trigger cafeteria summary delivery",
    "- navigate: navigate to a path like /tasks, /incidents, /schedule, /documents, /teacher-schedule, /chats",
    "- send_message: send a text message as the director into an existing chat",
    "- mark_chat_read: mark an existing chat as read by chatId",
    "- reset_demo: reset local demo data when explicitly requested",
    "For every action item, always include every schema field. Use null for fields that do not apply.",
    "If the user asks to send a message to a person, department, or group, match that request to the best existing chatId from site_state.chats and use send_message.",
    "If the user asks to open a page, locate a chat, show tasks, incidents, documents, schedule, or teacher schedule, use navigate with the most relevant path.",
    "When the user asks to send a message, prioritize the actual message delivery action; the UI will automatically open that chat after sending.",
    "Prefer helpful, concise replies in Russian.",
    "You have broad control over this site's supported actions and navigation, but do not invent capabilities that are not listed.",
    "For dueDate use full ISO timestamp when possible. If not specified, infer a reasonable same-day deadline at 18:00 local time.",
  ].join("\n");

  const userPrompt = JSON.stringify(
    {
      command,
      site_state: body.state ?? {},
    },
    null,
    2,
  );

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_ASSISTANT_MODEL,
      input: [
        {
          role: "developer",
          content: [{ type: "input_text", text: developerPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          ...commandPlanSchema,
        },
      },
      reasoning: {
        effort: "low",
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const errorPayload = payload as { error?: { message?: string } };

    return NextResponse.json(
      { error: errorPayload.error?.message || "OpenAI command planning failed." },
      { status: response.status },
    );
  }

  const rawText = extractStructuredText(payload);

  if (!rawText) {
    return NextResponse.json({ error: "Assistant response was empty." }, { status: 502 });
  }

  const plan = JSON.parse(rawText) as AssistantCommandPlan;

  return NextResponse.json(plan);
}

import { NextResponse } from "next/server";

import type { AssistantChatPlan } from "@/lib/assistant/command-types";

export const runtime = "nodejs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_ASSISTANT_MODEL = "gpt-5.4-mini";

const assistantChatSchema = {
  name: "assistant_chat_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "needsClarification", "clarification", "workspace", "actions"],
    properties: {
      reply: {
        type: "string",
      },
      needsClarification: {
        type: "boolean",
      },
      clarification: {
        type: ["object", "null"],
        additionalProperties: false,
        required: ["intro", "question", "options", "allowFreeText", "freeTextLabel"],
        properties: {
          intro: { type: ["string", "null"] },
          question: { type: ["string", "null"] },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label", "value"],
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                value: { type: "string" },
              },
            },
          },
          allowFreeText: { type: ["boolean", "null"] },
          freeTextLabel: { type: ["string", "null"] },
        },
      },
      workspace: {
        type: ["object", "null"],
        additionalProperties: false,
        required: ["title", "fileName", "summary", "html"],
        properties: {
          title: { type: ["string", "null"] },
          fileName: { type: ["string", "null"] },
          summary: { type: ["string", "null"] },
          html: { type: ["string", "null"] },
        },
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
            "eventDate",
            "startTime",
            "endTime",
            "room",
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
                "create_schedule_event",
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
            eventDate: { type: ["string", "null"] },
            startTime: { type: ["string", "null"] },
            endTime: { type: ["string", "null"] },
            room: { type: ["string", "null"] },
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

function normalizeAssistantPlan(plan: AssistantChatPlan): AssistantChatPlan {
  const hasClarificationQuestion =
    typeof plan.clarification?.question === "string" && plan.clarification.question.trim().length > 0;
  const hasClarificationOptions = Array.isArray(plan.clarification?.options) && plan.clarification.options.length > 0;
  const shouldUseClarification = Boolean(plan.needsClarification || hasClarificationQuestion || hasClarificationOptions);

  if (!shouldUseClarification) {
    return {
      ...plan,
      needsClarification: false,
      clarification: null,
    };
  }

  const safeClarification = {
    intro: plan.clarification?.intro?.trim() || "Нужно уточнить одну деталь перед продолжением.",
    question: plan.clarification?.question?.trim() || "Уточни, пожалуйста, недостающую деталь.",
    options: Array.isArray(plan.clarification?.options) ? plan.clarification.options.slice(0, 4) : [],
    allowFreeText: plan.clarification?.allowFreeText ?? true,
    freeTextLabel: plan.clarification?.freeTextLabel?.trim() || "Свой вариант",
  };

  const conciseReply = [safeClarification.intro, safeClarification.question].filter(Boolean).join(" ");

  return {
    ...plan,
    reply: conciseReply,
    needsClarification: true,
    clarification: safeClarification,
    actions: [],
    workspace: null,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as {
    message?: string;
    kind?: "text" | "voice";
    bureaucraticMode?: boolean;
    chatId?: string;
    history?: unknown;
    ragContext?: unknown;
    state?: unknown;
  };

  const message = String(body.message ?? "").trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const developerPrompt = [
    "You are AISana, the director's executive AI assistant inside a school operations dashboard.",
    "You behave like a capable chat assistant, but you can also plan supported actions for the web app.",
    "Use the provided site state and recent chat history.",
    "If bureaucratic_mode is true, treat the request as document-heavy or formal-administration work: prefer more formal wording, document structure, implementation steps, and policy-aware execution when relevant.",
    "When bureaucratic_mode is true, rely on rag_context as your internal document base for orders, forms, templates, and school regulations.",
    "If the user asks for an order, report, memo, directive, or formal response, your main job is to draft the actual document text, not just explain the policy.",
    "If the user asks for order 76, 110, 130 or a school order template, use rag_context first and build the draft around it.",
    "In bureaucratic_mode, do not output raw placeholders like [name], [date], [number], [facts], [fill this], or similar blanks unless the user explicitly asked for a template only.",
    "Prefer filling missing details yourself using reasonable professional defaults, the current date, recent chat history, site_state, and the organization context below.",
    "If you must infer facts, do so confidently and write a complete working draft in polished official Russian.",
    "Use 'Aqbobek School' as the default organization name when no other name is provided.",
    "For draft orders and reports, prefer a finished document over a questionnaire. Ask follow-up questions only for details that are essential to legality, safety, or routing.",
    "Only ask a clarification when a missing detail is truly required to complete the request safely or accurately.",
    "If a reasonable default exists, use it and act instead of asking.",
    "When asking a clarification, ask only one concise Russian follow-up and return no actions.",
    "If clarification is needed, fill the clarification object and keep actions empty.",
    "When clarification is needed, do not explain the UI, do not provide sample wording, and do not say 'вот пример' or similar meta phrases.",
    "If the user asks to show an example of a clarification, respond by actually producing a real clarification object as if the flow is already active.",
    "The reply field for clarification must be short and plain: one short intro plus the current question only.",
    "Clarifying questions must work like Claude Code: show one current question at a time, with 2-4 suggested answer options whenever possible, plus free text when useful.",
    "For clarification.intro use one short helpful sentence.",
    "For clarification.question use a direct single question.",
    "For clarification.options provide short answer chips in Russian when there are obvious choices.",
    "Set clarification.allowFreeText to true when the user might type their own answer.",
    "If bureaucratic_mode is true and enough information is already available, return a polished formal draft in Russian with headings, official wording, and a ready-to-copy structure.",
    "When you return a final bureaucratic document, also fill workspace with a document preview payload.",
    "workspace.title should be a short Russian title for the document.",
    "workspace.fileName should be a safe .doc filename in latin letters and hyphens.",
    "workspace.summary should be one concise sentence describing what was prepared.",
    "workspace.html should contain body-only semantic HTML for a Word-like document preview using only tags such as h1, h2, h3, p, ol, ul, li, strong, em, table, thead, tbody, tr, td, th, div, br.",
    "If this is not a final document draft, return workspace as null.",
    "Supported actions:",
    "- create_task: create a task with title, description, assigneeUserId, dueDate",
    "- create_schedule_event: create a director calendar item with title, description, eventDate, startTime, endTime, room",
    "- update_task_status: update an existing task by taskId and taskStatus",
    "- update_incident_status: update an incident by incidentId and incidentStatus",
    "- confirm_suggestion: confirm a substitution suggestion by suggestionId",
    "- send_cafeteria_summary: trigger cafeteria summary delivery",
    "- navigate: navigate to a path like /tasks, /incidents, /schedule, /documents, /teacher-schedule, /chats, /chats/<chatId>",
    "- send_message: send a text message as the director into an existing chat",
    "- mark_chat_read: mark an existing chat as read by chatId",
    "- reset_demo: reset local demo data when explicitly requested",
    "For every action item, always include every schema field. Use null for fields that do not apply.",
    "If the user asks to send a message to a person, department, or group, match it to the best existing chatId from site_state.chats.",
    "If the user asks to open or show something, use navigate when it materially helps the user see the result.",
    "If the user asks to add something to the director's schedule, calendar, meeting plan, or agenda, prefer create_schedule_event.",
    "For create_schedule_event use ISO date format YYYY-MM-DD for eventDate and HH:MM 24-hour format for startTime/endTime.",
    "Prefer concise, confident Russian replies with an executive-assistant tone.",
    "Do not invent capabilities beyond the listed actions, but you may still answer questions from the provided state.",
    "If dueDate is needed and not specified, infer a reasonable same-day deadline at 18:00 local time.",
  ].join("\n");

  const userPrompt = JSON.stringify(
    {
      chat_id: body.chatId ?? "chat-aisana",
      input_kind: body.kind ?? "text",
      bureaucratic_mode: Boolean(body.bureaucraticMode),
      organization_context: {
        school_name: "Aqbobek School",
        locale: "Kazakhstan",
      },
      user_message: message,
      recent_history: body.history ?? [],
      rag_context: body.ragContext ?? [],
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
          ...assistantChatSchema,
        },
      },
      reasoning: {
        effort: "medium",
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const errorPayload = payload as { error?: { message?: string } };

    return NextResponse.json(
      { error: errorPayload.error?.message || "OpenAI assistant chat failed." },
      { status: response.status },
    );
  }

  const rawText = extractStructuredText(payload);

  if (!rawText) {
    return NextResponse.json({ error: "Assistant response was empty." }, { status: 502 });
  }

  const plan = normalizeAssistantPlan(JSON.parse(rawText) as AssistantChatPlan);

  return NextResponse.json(plan);
}

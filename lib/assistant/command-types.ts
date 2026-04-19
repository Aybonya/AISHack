import type { IncidentStatus, TaskStatus } from "@/lib/types";

export type AssistantCommandActionType =
  | "create_task"
  | "create_schedule_event"
  | "update_task_status"
  | "update_incident_status"
  | "confirm_suggestion"
  | "send_cafeteria_summary"
  | "navigate"
  | "send_message"
  | "mark_chat_read"
  | "reset_demo";

export interface AssistantCommandAction {
  type: AssistantCommandActionType;
  title?: string;
  description?: string;
  assigneeUserId?: string;
  dueDate?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  taskId?: string;
  taskStatus?: TaskStatus;
  incidentId?: string;
  incidentStatus?: IncidentStatus;
  suggestionId?: string;
  chatId?: string;
  text?: string;
  kind?: "text" | "voice";
  path?: string;
}

export interface AssistantCommandPlan {
  reply: string;
  actions: AssistantCommandAction[];
}

export interface AssistantClarificationOption {
  id: string;
  label: string;
  value: string;
}

export interface AssistantClarificationPrompt {
  intro: string | null;
  question: string | null;
  options: AssistantClarificationOption[];
  allowFreeText: boolean | null;
  freeTextLabel?: string | null;
}

export interface AssistantWorkspaceDocument {
  title: string;
  fileName: string;
  summary: string;
  html: string;
}

export interface AssistantChatPlan extends AssistantCommandPlan {
  needsClarification: boolean;
  clarification: AssistantClarificationPrompt | null;
  workspace: AssistantWorkspaceDocument | null;
}

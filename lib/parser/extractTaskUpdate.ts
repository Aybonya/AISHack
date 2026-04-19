import type { User } from "@/lib/types";
import { normalizeText } from "@/lib/utils";

export interface TaskUpdate {
  taskId?: string;
  status: "done" | "in_progress";
  keywords: string[];
}

export function extractTaskUpdate(text: string): TaskUpdate | null {
  const normalized = normalizeText(text).toLowerCase();
  
  const doneKeywords = ["сделал", "готово", "выполнил", "завершил", "отремонтировал", "починил", "заказал", "подготовил", "сделано"];
  
  const isDone = doneKeywords.some(kw => normalized.includes(kw));
  
  if (isDone) {
    return {
      status: "done",
      keywords: doneKeywords.filter(kw => normalized.includes(kw))
    };
  }
  
  return null;
}

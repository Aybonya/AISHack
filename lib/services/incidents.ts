import type { Incident, IncidentExtraction, User } from "@/lib/types";
import { createId } from "@/lib/utils";

export function createIncidentFromExtraction(
  extraction: IncidentExtraction,
  sourceMessageId: string,
  users: User[],
): Incident {
  const assignedTo =
    users.find((user) => user.role === extraction.responsibleRole) ??
    users.find((user) => user.role === "director");

  const title =
    extraction.type === "electrical"
      ? "Не работает свет"
      : extraction.type === "plumbing"
        ? "Проблема с водой"
        : extraction.type === "safety"
          ? "Инцидент по безопасности"
          : "Сломалась мебель";

  return {
    id: createId("incident"),
    title,
    description: extraction.description,
    location: extraction.location,
    priority: extraction.priority,
    assignedToUserId: assignedTo?.id ?? users[0]?.id ?? "director-janar",
    status: extraction.status,
    sourceMessageId,
    createdAt: new Date().toISOString(),
  };
}

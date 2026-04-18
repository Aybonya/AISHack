import type { ParsedTaskDraft, User } from "@/lib/types";
import { normalizeText, toIsoDate, withTime } from "@/lib/utils";

function guessTaskDueDate(action: string) {
  const now = new Date();
  const normalized = normalizeText(action);

  if (normalized.includes("сегодня")) {
    return withTime(now, "17:00");
  }

  if (normalized.includes("закаж") || normalized.includes("бейдж")) {
    return withTime(now, "13:00");
  }

  if (normalized.includes("подготов")) {
    return withTime(now, "14:00");
  }

  if (normalized.includes("до")) {
    const match = normalized.match(/до\s*(\d{1,2})[:.](\d{2})/);
    if (match) {
      const hours = match[1];
      const minutes = match[2];
      return withTime(now, `${hours.padStart(2, "0")}:${minutes}`);
    }
  }

  return withTime(now, "16:00");
}

function titleFromAction(action: string) {
  const trimmed = action.trim().replace(/\.$/, "");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function extractTasks(text: string, users: User[]): ParsedTaskDraft[] {
  const segments = text
    .split(/[.!?]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.flatMap((segment) => {
    const match = segment.match(
      /^([А-ЯA-ZӘІҢҒҮҰҚӨҺ][А-ЯA-ZӘІҢҒҮҰҚӨҺа-яa-zәіңғүұқөһ.\-\s]+?),\s*(.+)$/i,
    );

    if (!match) {
      return [];
    }

    const assignee = match[1].trim();
    const action = match[2].trim();
    const hasKnownUser = users.some((user) =>
      normalizeText(user.name).includes(normalizeText(assignee)),
    );

    if (!hasKnownUser) {
      return [];
    }

    return [
      {
        assignee,
        title: titleFromAction(action),
        description: `${titleFromAction(action)}. Создано из команды директора ${toIsoDate(new Date())}.`,
        dueDate: guessTaskDueDate(action),
      },
    ];
  });
}

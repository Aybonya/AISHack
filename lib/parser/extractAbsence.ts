import type { AbsenceExtraction, User } from "@/lib/types";
import { normalizeText, toIsoDate } from "@/lib/utils";

function detectDate(text: string) {
  const now = new Date();

  if (normalizeText(text).includes("завтра")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toIsoDate(tomorrow);
  }

  return toIsoDate(now);
}

export function extractAbsence(text: string, users: User[]): AbsenceExtraction | null {
  const normalized = normalizeText(text);
  const hasAbsenceSignal =
    normalized.includes("не будет") ||
    normalized.includes("заболел") ||
    normalized.includes("заболела") ||
    normalized.includes("больничн") ||
    normalized.includes("отсутств");

  if (!hasAbsenceSignal) {
    return null;
  }

  const matchedUser =
    users.find((user) => normalized.includes(normalizeText(user.name))) ??
    users.find((user) => normalized.includes(normalizeText(user.name.split(" ")[0] ?? "")));

  if (!matchedUser) {
    return null;
  }

  return {
    teacherName: matchedUser.name,
    teacherUserId: matchedUser.id,
    date: detectDate(text),
    reason: normalized.includes("забол")
      ? "болезнь"
      : normalized.includes("больничн")
        ? "больничный"
        : "отсутствие",
    subject: matchedUser.subjects[0],
  };
}

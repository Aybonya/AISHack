import type { IncidentExtraction, UserRole } from "@/lib/types";
import { normalizeText } from "@/lib/utils";

const facilityKeywords = [
  "сломал",
  "сломалась",
  "сломался",
  "не работает",
  "протекает",
  "разбилось",
  "перегорел",
  "нет света",
  "парта",
  "вода",
  "свет",
];

const urgentKeywords = ["дым", "искрит", "драка", "травма", "пожар"];

function resolveResponsibleRole(type: string): UserRole {
  if (type === "safety") {
    return "director";
  }

  return "facilities";
}

function normalizeLocation(rawLocation: string) {
  return rawLocation
    .replace(/^кабинете/i, "Кабинет")
    .replace(/^туалете/i, "Туалет")
    .replace(/^коридоре/i, "Коридор")
    .replace(/^столовой/i, "Столовая");
}

export function extractIncident(text: string): IncidentExtraction | null {
  const normalized = normalizeText(text);
  const locationMatch =
    text.match(/в\s+(кабинете\s*\d+[а-яa-z]?)/i) ??
    text.match(/в\s+(туалете\s+на\s+\d+\s+этаже)/i) ??
    text.match(/в\s+(коридоре\s+\d+)/i) ??
    text.match(/в\s+(столовой)/i);

  const hasIncidentSignal =
    facilityKeywords.some((keyword) => normalized.includes(keyword)) ||
    urgentKeywords.some((keyword) => normalized.includes(keyword));

  if (!hasIncidentSignal || !locationMatch) {
    return null;
  }

  const type = urgentKeywords.some((keyword) => normalized.includes(keyword))
    ? "safety"
    : normalized.includes("свет")
      ? "electrical"
      : normalized.includes("вода")
        ? "plumbing"
        : "furniture";

  const priority = urgentKeywords.some((keyword) => normalized.includes(keyword))
    ? "high"
    : normalized.includes("не работает") || normalized.includes("протекает")
      ? "high"
      : "medium";

  return {
    type,
    location: normalizeLocation(locationMatch[1]),
    description: text.trim(),
    priority,
    responsibleRole: resolveResponsibleRole(type),
    status: "new",
  };
}

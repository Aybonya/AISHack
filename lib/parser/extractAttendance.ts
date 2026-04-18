import type { AttendanceExtraction } from "@/lib/types";

const classPattern = /(\d+\s*[А-ЯA-ZӘІҢҒҮҰҚӨҺ])/i;

function parseNumber(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

export function extractAttendance(text: string): AttendanceExtraction | null {
  const classMatch = text.match(classPattern);
  if (!classMatch) {
    return null;
  }

  const className = classMatch[1].replace(/\s+/g, "").toUpperCase();

  const presentExplicit = parseNumber(/(\d+)\s*присутствуют/i, text);
  const absentExplicit = parseNumber(/(\d+)\s*отсутствуют/i, text);
  const totalChildren = parseNumber(/(\d+)\s*дет(ей|и)/i, text);
  const absentSick = parseNumber(/(\d+)\s*боле(ет|ют)/i, text);

  let presentCount = presentExplicit ?? 0;
  let absentCount = absentExplicit ?? absentSick ?? 0;

  if (presentExplicit === null && totalChildren !== null) {
    presentCount = Math.max(totalChildren - absentCount, 0);
  }

  if (presentExplicit === null && totalChildren === null) {
    return null;
  }

  if (presentExplicit !== null && absentExplicit === null && absentSick === null) {
    absentCount = 0;
  }

  return {
    className,
    presentCount,
    absentCount,
    totalMeals: presentCount,
    confidence:
      totalChildren !== null || presentExplicit !== null
        ? absentExplicit !== null || absentSick !== null
          ? 0.96
          : 0.84
        : 0.62,
  };
}

import { extractAbsence } from "@/lib/parser/extractAbsence";
import { extractAttendance } from "@/lib/parser/extractAttendance";
import { extractIncident } from "@/lib/parser/extractIncident";
import { extractTasks } from "@/lib/parser/extractTasks";
import type { ParsedIntent, User } from "@/lib/types";

export function classifyMessage(text: string, users: User[]): ParsedIntent {
  if (extractAttendance(text)) {
    return "attendance";
  }

  if (extractIncident(text)) {
    return "incident";
  }

  if (extractAbsence(text, users)) {
    return "substitution";
  }

  if (extractTasks(text, users).length > 0) {
    return "task";
  }

  return "generic";
}

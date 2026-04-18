import { suggestSubstitutionExplanation } from "@/lib/ai/suggestSubstitution";
import type {
  AbsenceExtraction,
  AppState,
  CandidateScore,
  ScheduleEntry,
  SubstitutionSuggestion,
  TeacherAbsence,
  User,
} from "@/lib/types";
import { createId, getWeekdayIndex, normalizeText } from "@/lib/utils";

function classGrade(className: string) {
  return Number(className.match(/\d+/)?.[0] ?? 0);
}

function coversSubject(user: User, subject: string) {
  const normalizedSubject = normalizeText(subject);
  return (
    user.subjects.some((item) => normalizeText(item).includes(normalizedSubject)) ||
    user.qualifications.some((item) => normalizeText(item).includes(normalizedSubject))
  );
}

function coversClass(user: User, className: string, subject: string) {
  const grade = classGrade(className);
  const qualifications = user.qualifications.map(normalizeText);

  if (grade <= 4 && qualifications.some((value) => value.includes("1-4") || value.includes("primary"))) {
    return true;
  }

  if (coversSubject(user, subject)) {
    return true;
  }

  return qualifications.some((value) => value.includes(`${grade}`));
}

function hasConflict(userId: string, entries: ScheduleEntry[], weekday: number, lessonNumbers: number[]) {
  return entries.some(
    (entry) =>
      lessonNumbers.includes(entry.lessonNumber) &&
      entry.weekday === weekday &&
      (entry.teacherUserId === userId || entry.substituteUserId === userId),
  );
}

export function createTeacherAbsence(
  extraction: AbsenceExtraction,
  sourceMessageId: string,
): TeacherAbsence {
  return {
    id: createId("absence"),
    teacherUserId: extraction.teacherUserId ?? "askar",
    date: extraction.date,
    reason: extraction.reason,
    sourceMessageId,
  };
}

export function buildSubstitutionSuggestion(
  absence: TeacherAbsence,
  users: User[],
  scheduleEntries: ScheduleEntry[],
  existingAbsences: TeacherAbsence[],
): SubstitutionSuggestion | null {
  const weekday = getWeekdayIndex(absence.date);
  const affectedLessons = scheduleEntries
    .filter((entry) => entry.teacherUserId === absence.teacherUserId && entry.weekday === weekday)
    .sort((left, right) => left.lessonNumber - right.lessonNumber)
    .map((entry) => ({
      scheduleEntryId: entry.id,
      className: entry.className,
      subject: entry.subject,
      room: entry.room,
      lessonNumber: entry.lessonNumber,
      startTime: entry.startTime,
      endTime: entry.endTime,
    }));

  if (affectedLessons.length === 0) {
    return null;
  }

  const lessonNumbers = affectedLessons.map((lesson) => lesson.lessonNumber);
  const primarySubject = affectedLessons[0]?.subject ?? "урок";
  const primaryClass = affectedLessons[0]?.className ?? "";

  const candidateRankings: CandidateScore[] = users
    .filter((user) => user.role === "teacher" && user.id !== absence.teacherUserId)
    .filter((user) => !existingAbsences.some((item) => item.teacherUserId === user.id && item.date === absence.date))
    .filter((user) => user.isAvailable)
    .flatMap((user) => {
      if (hasConflict(user.id, scheduleEntries, weekday, lessonNumbers)) {
        return [];
      }

      let score = 0;
      const reasons: string[] = [];

      if (coversSubject(user, primarySubject)) {
        score += 60;
        reasons.push("совпадает предмет");
      } else if (user.subjects.some((subject) => normalizeText(subject).includes("начальные"))) {
        score += 25;
        reasons.push("может подменить смежный урок");
      }

      if (lessonNumbers.every((lessonNumber) => user.availabilitySlots.includes(lessonNumber))) {
        score += 20;
        reasons.push("свободна по слотам");
      }

      if (coversClass(user, primaryClass, primarySubject)) {
        score += 12;
        reasons.push("подходит по квалификации");
      }

      const workload = scheduleEntries.filter(
        (entry) =>
          entry.weekday === weekday &&
          (entry.teacherUserId === user.id || entry.substituteUserId === user.id),
      ).length;

      score += Math.max(8 - workload, 0);
      reasons.push(workload <= 2 ? "низкая нагрузка" : "нагрузка допустима");

      return [
        {
          userId: user.id,
          score,
          reason: reasons.join(", "),
        },
      ];
    })
    .sort((left, right) => right.score - left.score);

  const bestCandidate = candidateRankings[0];

  if (!bestCandidate) {
    return null;
  }

  const candidateUser = users.find((user) => user.id === bestCandidate.userId);
  if (!candidateUser) {
    return null;
  }

  return {
    id: createId("suggestion"),
    absenceId: absence.id,
    teacherUserId: absence.teacherUserId,
    date: absence.date,
    affectedLessons,
    candidateUserId: bestCandidate.userId,
    candidateRankings,
    explanation: suggestSubstitutionExplanation(candidateUser, affectedLessons, primarySubject),
    status: "suggested",
  };
}

export function confirmSubstitution(state: AppState, suggestionId: string): AppState {
  const suggestion = state.substitutionSuggestions.find((item) => item.id === suggestionId);
  if (!suggestion) {
    return state;
  }

  return {
    ...state,
    substitutionSuggestions: state.substitutionSuggestions.map((item) =>
      item.id === suggestionId ? { ...item, status: "confirmed" } : item,
    ),
    scheduleEntries: state.scheduleEntries.map((entry) => {
      const affected = suggestion.affectedLessons.find((lesson) => lesson.scheduleEntryId === entry.id);
      if (!affected) {
        return entry;
      }

      return {
        ...entry,
        substituteUserId: suggestion.candidateUserId,
        substitutionStatus: "confirmed",
      };
    }),
  };
}

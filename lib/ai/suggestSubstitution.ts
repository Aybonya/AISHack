import type { AffectedLesson, User } from "@/lib/types";

export function suggestSubstitutionExplanation(candidate: User, lessons: AffectedLesson[], subject: string) {
  const lesson = lessons[0];
  const lessonLabel =
    lessons.length > 1
      ? `${lessons.length} урока(ов) по предмету ${subject}`
      : `${lesson.lessonNumber} уроке`;

  return `${candidate.name} выбрана, потому что свободна на ${lessonLabel} и может вести ${subject.toLowerCase()}.`;
}

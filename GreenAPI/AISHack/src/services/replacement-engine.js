const { normalizeClassId, normalizeSpace, parseLessonNumber } = require("../utils");

const DAY_PATTERNS = [
  ["monday", ["дүйсенбі", "понедельник", "monday"]],
  ["tuesday", ["сейсенбі", "вторник", "tuesday"]],
  ["wednesday", ["сәрсенбі", "среда", "wednesday"]],
  ["thursday", ["бейсенбі", "четверг", "thursday"]],
  ["friday", ["жұма", "пятница", "friday"]],
  ["saturday", ["сенбі", "суббота", "saturday"]],
];

function buildTeacherIndex(teachers) {
  const byId = new Map();
  const aliases = [];

  teachers.forEach((teacher) => {
    byId.set(teacher.id, teacher);
    const values = new Set([
      teacher.id,
      teacher.fullName,
      teacher.shortName,
      ...(teacher.aliases || []),
    ]);

    values.forEach((alias) => {
      const text = normalizeSpace(alias).toLowerCase();
      if (text) {
        aliases.push({ text, teacherId: teacher.id });
      }
    });
  });

  aliases.sort((a, b) => b.text.length - a.text.length);
  return { byId, aliases };
}

function findTeacherByText(noteText, teacherIndex) {
  const normalized = normalizeSpace(noteText).toLowerCase();
  return (
    teacherIndex.aliases.find((alias) => normalized.includes(alias.text))?.teacherId || null
  );
}

function extractLessonNumber(noteText) {
  const normalized = normalizeSpace(noteText);
  const patterns = [
    /(?:урок|сабақ|lesson)\s*№?\s*(\d{1,2})/iu,
    /(\d{1,2})\s*(?:урок|сабақ|lesson)/iu,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return parseLessonNumber(match[1]);
    }
  }

  return null;
}

function extractClassId(noteText) {
  const match = normalizeSpace(noteText).match(
    /\b(\d{1,2}\s*[A-Za-zА-Яа-яӘәІіҢңҒғҮүҰұҚқӨөҺһ])\b/u
  );
  return match ? normalizeClassId(match[1]) : null;
}

function extractDayKey(noteText) {
  const normalized = normalizeSpace(noteText).toLowerCase();
  for (const [key, values] of DAY_PATTERNS) {
    if (values.some((value) => normalized.includes(value))) {
      return key;
    }
  }
  return null;
}

function inferIntent(noteText) {
  const normalized = normalizeSpace(noteText).toLowerCase();
  if (
    normalized.includes("забол") ||
    normalized.includes("болеет") ||
    normalized.includes("больнич") ||
    normalized.includes("ауырып") ||
    normalized.includes("отсутств")
  ) {
    return "teacher_absence";
  }
  return "note";
}

function parseChatNote(noteText, teacherIndex) {
  const teacherId = findTeacherByText(noteText, teacherIndex);
  return {
    intent: inferIntent(noteText),
    teacherId,
    classId: extractClassId(noteText),
    lessonNumber: extractLessonNumber(noteText),
    dayKey: extractDayKey(noteText),
    rawText: noteText,
  };
}

function pickAbsentEntries(scheduleEntries, parsedNote) {
  return scheduleEntries.filter((entry) => {
    if (parsedNote.teacherId && !(entry.teacherIds || []).includes(parsedNote.teacherId)) {
      return false;
    }
    if (parsedNote.dayKey && entry.dayKey !== parsedNote.dayKey) {
      return false;
    }
    if (parsedNote.lessonNumber && entry.lessonNumber !== parsedNote.lessonNumber) {
      return false;
    }
    if (parsedNote.classId && entry.classId !== parsedNote.classId) {
      return false;
    }
    return true;
  });
}

function buildReplacementCandidates({
  targetEntry,
  scheduleEntries,
  teacherLoad,
  teachersById,
  absentTeacherId,
}) {
  const busyTeacherIds = new Set(
    scheduleEntries
      .filter(
        (entry) =>
          entry.dayKey === targetEntry.dayKey && entry.lessonNumber === targetEntry.lessonNumber
      )
      .flatMap((entry) => entry.teacherIds || [])
  );

  const candidates = new Map();
  teacherLoad.forEach((load) => {
    if (load.baseSubjectId !== targetEntry.baseSubjectId) {
      return;
    }
    if (load.teacherId === absentTeacherId) {
      return;
    }

    const teacher = teachersById.get(load.teacherId);
    if (!teacher || teacher.active === false) {
      return;
    }

    const isBusy = busyTeacherIds.has(load.teacherId);
    let mergeClass = null;

    if (isBusy) {
      // Проверяем, может ли учитель объединить классы (ведет ли он этот же предмет в это же время другому классу)
      const busyLesson = scheduleEntries.find(
        (e) =>
          e.dayKey === targetEntry.dayKey &&
          e.lessonNumber === targetEntry.lessonNumber &&
          (e.teacherIds || []).includes(load.teacherId)
      );

      if (busyLesson && busyLesson.baseSubjectId === targetEntry.baseSubjectId) {
        const targetGrade = parseInt(targetEntry.classId, 10);
        const busyGrade = parseInt(busyLesson.classId, 10);

        if (!isNaN(targetGrade) && targetGrade === busyGrade) {
          mergeClass = busyLesson.classId;
        } else {
          return; // Занят другой параллелью, объединять нельзя
        }
      } else {
        return; // Занят другим предметом, пропускаем
      }
    }

    const candidate = candidates.get(load.teacherId) || {
      teacherId: load.teacherId,
      fullName: teacher.fullName,
      shortName: teacher.shortName,
      score: 0,
      reasons: [],
      sameClassHours: 0,
      totalSubjectHours: 0,
    };

    const hours = Number(load.hours || 0);
    candidate.totalSubjectHours += hours;
    candidate.score += hours;

    if (mergeClass) {
      candidate.score += 3; // Приоритет ниже, чем у свободного учителя
      candidate.reasons.push(`Объединение с классом ${mergeClass}`);
    } else {
      candidate.score += 15; // Свободный учитель получает большой бонус
      candidate.reasons.push("Свободен(на) в это время");
    }

    if (load.classId === targetEntry.classId) {
      candidate.sameClassHours += hours;
      candidate.score += 10;
      candidate.reasons.push("Уже преподает у этого класса");
    }

    if ((teacher.baseSubjectIds || []).includes(targetEntry.baseSubjectId)) {
      candidate.score += 5;
      candidate.reasons.push("Совпадает базовый предмет");
    }

    candidates.set(load.teacherId, candidate);
  });

  let sortedCandidates = Array.from(candidates.values())
    .sort((a, b) => b.score - a.score)
    .map((candidate) => ({
      ...candidate,
      reasons: [...new Set(candidate.reasons)],
    }));

  // Внедряем крайний вариант (Куратор), если вообще нет кандидатов или как резервный вариант
  sortedCandidates.push({
    teacherId: "curator_replacement",
    fullName: "Куратор параллели",
    shortName: "Куратор",
    score: -1,
    reasons: ["Крайняя мера: назначение куратора"],
    sameClassHours: 0,
    totalSubjectHours: 0,
  });

  return sortedCandidates;
}

function recommendReplacements(data, parsedNote) {
  const teacherIndex = buildTeacherIndex(data.teachers);
  const teachersById = teacherIndex.byId;
  const absentEntries = pickAbsentEntries(data.scheduleEntries, parsedNote);

  return absentEntries.map((entry) => ({
    entry,
    absentTeacher: parsedNote.teacherId ? teachersById.get(parsedNote.teacherId) || null : null,
    candidates: buildReplacementCandidates({
      targetEntry: entry,
      scheduleEntries: data.scheduleEntries,
      teacherLoad: data.teacherLoad,
      teachersById,
      absentTeacherId: parsedNote.teacherId,
    }),
  }));
}

module.exports = {
  buildTeacherIndex,
  findTeacherByText,
  parseChatNote,
  recommendReplacements,
  extractClassId,
  extractDayKey,
  extractLessonNumber,
};

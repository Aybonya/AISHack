const path = require("path");
const XLSX = require("xlsx");
const admin = require("firebase-admin");

const serviceAccount = require("../firebase-service-account.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const DATA_DIR = path.join(__dirname, "..", "data");
const WORKBOOK_PATHS = {
  schedule: path.join(DATA_DIR, "schedule.xlsx"),
  teacherLoad: path.join(DATA_DIR, "teacher-load.xlsx"),
};

const DAY_MAP = [
  { key: "monday", labels: ["Дүйсенбі", "понедельник"] },
  { key: "tuesday", labels: ["Сейсенбі", "вторник"] },
  { key: "wednesday", labels: ["Сәрсенбі", "среда"] },
  { key: "thursday", labels: ["Бейсенбі", "четверг"] },
  { key: "friday", labels: ["Жұма", "пятница"] },
  { key: "saturday", labels: ["Сенбі", "суббота"] },
];

const COLLECTIONS_TO_RESET = [
  "meta",
  "teachers",
  "classes",
  "subjects",
  "rooms",
  "bell_schedule",
  "teacher_load",
  "schedule_entries",
  "assessment_schedule_entries",
  "room_occupancy",
  "raw_sheet_rows",
];

const SUBJECT_SYNONYMS = {
  "англ.яз": "ағылшын тілі",
  "ағылшын": "ағылшын тілі",
  "электив ағылшын": "ағылшын тілі",
  "ағылшын тілі электив": "ағылшын тілі",
  "джт": "дүниежүзі тарихы",
  "мат сауат": "математикалық сауаттылық",
  "мат.сау": "математикалық сауаттылық",
  "мат сауаттылық": "математикалық сауаттылық",
  "құқық": "құқық негіздері",
  "қаз тарихы": "қазақстан тарихы",
  "қазақстан тарихы": "қазақстан тарихы",
  "геометрия мат.сауат.": "геометрия",
};

function normalizeSpace(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeClassId(value) {
  return normalizeSpace(value)
    .toUpperCase()
    .replace(/А/g, "A")
    .replace(/В/g, "B")
    .replace(/С/g, "C")
    .replace(/Д/g, "D")
    .replace(/Е/g, "E")
    .replace(/\s+/g, "");
}

function isClassId(value) {
  return /^\d+[A-Z]$/u.test(normalizeClassId(value));
}

function transliterate(value) {
  const map = {
    а: "a",
    ә: "a",
    б: "b",
    в: "v",
    г: "g",
    ғ: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "i",
    к: "k",
    қ: "k",
    л: "l",
    м: "m",
    н: "n",
    ң: "n",
    о: "o",
    ө: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ұ: "u",
    ү: "u",
    ф: "f",
    х: "h",
    һ: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    і: "i",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return normalizeSpace(value)
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("");
}

function toId(value) {
  return transliterate(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function makeDocId(...parts) {
  return parts
    .map((part) => normalizeSpace(part))
    .filter(Boolean)
    .map((part) => toId(part))
    .filter(Boolean)
    .join("_");
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const normalized = normalizeSpace(value).replace(",", ".");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLessonNumber(value) {
  const number = parseNumber(value);
  return Number.isInteger(number) ? number : null;
}

function parseTimeRange(value) {
  const text = normalizeSpace(value).replace(/–/g, "-");
  const match = text.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
  if (!match) {
    return { raw: text, start: null, end: null };
  }
  const [, h1, m1, h2, m2] = match;
  return {
    raw: text,
    start: `${String(h1).padStart(2, "0")}:${m1}`,
    end: `${String(h2).padStart(2, "0")}:${m2}`,
  };
}

function cleanTeacherName(value) {
  return normalizeSpace(value).replace(/\([^)]*\)/g, "").trim();
}

function makeShortTeacherName(fullName) {
  const cleanName = cleanTeacherName(fullName);
  const parts = cleanName.split(" ").filter(Boolean);
  if (parts.length < 2) {
    return cleanName;
  }
  const surname = parts[0];
  const initials = parts
    .slice(1, 3)
    .map((part) => `${part[0]}.`)
    .join("");
  return `${surname} ${initials}`.trim();
}

function createTeacherAliases(fullName) {
  const cleanName = cleanTeacherName(fullName);
  const parts = cleanName.split(" ").filter(Boolean);
  const aliases = new Set();
  const surname = parts[0] ?? cleanName;
  aliases.add(cleanName);
  aliases.add(surname);
  aliases.add(makeShortTeacherName(cleanName));

  if (parts[1]) {
    aliases.add(`${surname} ${parts[1][0]}.`);
    aliases.add(`${surname}${parts[1][0]}`);
  }
  if (parts[1] && parts[2]) {
    aliases.add(`${surname} ${parts[1][0]}.${parts[2][0]}.`);
  }

  return Array.from(aliases).map(normalizeSpace).filter(Boolean);
}

function detectDayKey(row) {
  const text = row.map(normalizeSpace).filter(Boolean).join(" ");
  if (!text) {
    return null;
  }

  for (const day of DAY_MAP) {
    for (const label of day.labels) {
      if (text.includes(label)) {
        return day.key;
      }
    }
  }

  return null;
}

function detectHeaderRow(rows) {
  return rows.findIndex((row) => row.some((cell) => normalizeSpace(cell) === "Уақыт"));
}

function extractClassDefinitions(headerRow) {
  const definitions = [];
  let currentTimeCol = null;
  let currentLessonCol = null;

  for (let col = 0; col < headerRow.length; col += 1) {
    const cell = normalizeSpace(headerRow[col]);
    if (cell === "Уақыт") {
      currentTimeCol = col;
      continue;
    }
    if (cell === "№") {
      currentLessonCol = col;
      continue;
    }
    if (isClassId(cell)) {
      definitions.push({
        classId: normalizeClassId(cell),
        subjectCol: col,
        roomCol: col + 1,
        timeCol: currentTimeCol,
        lessonCol: currentLessonCol,
      });
    }
  }

  return definitions;
}

function inferEntryType(subjectName, rawText) {
  const text = `${normalizeSpace(subjectName)} ${normalizeSpace(rawText)}`.toLowerCase();
  if (text.includes("үй жұмысы")) {
    return "study_hall";
  }
  if (text.includes("тәрбие сағаты")) {
    return "homeroom";
  }
  if (text.includes("ұбт")) {
    return "test_prep";
  }
  if (text.includes("электив") || text.includes("ielts") || text.includes("sat")) {
    return "elective";
  }
  return "lesson";
}

function cleanupSubjectText(value) {
  return normalizeSpace(
    value
      .replace(/[(),]/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/\/+/g, " ")
  );
}

function sanitizeSubjectName(value) {
  let text = cleanupSubjectText(value)
    .replace(/\s+[A-ZА-ЯӘІҢҒҮҰҚӨҺ]\.?[A-ZА-ЯӘІҢҒҮҰҚӨҺ]?\.?$/u, "")
    .replace(/\s+[А-ЯӘІҢҒҮҰҚӨҺ]{2,}$/u, "")
    .replace(/\s+[A-ZА-ЯӘІҢҒҮҰҚӨҺ]$/u, "")
    .replace(/[.,;:/-]+$/g, "");

  text = normalizeSpace(text);
  return text || cleanupSubjectText(value);
}

function normalizeSubjectKey(value) {
  return sanitizeSubjectName(value).toLowerCase();
}

function resolveBaseSubject(subjectName, canonicalSubjects) {
  const cleaned = sanitizeSubjectName(subjectName);
  const normalized = normalizeSubjectKey(cleaned);
  const synonym = SUBJECT_SYNONYMS[normalized];
  if (synonym) {
    return { name: synonym, id: toId(synonym) };
  }

  let bestMatch = null;
  for (const candidate of canonicalSubjects) {
    const candidateNormalized = normalizeSubjectKey(candidate);
    if (
      normalized === candidateNormalized ||
      normalized.startsWith(candidateNormalized) ||
      candidateNormalized.startsWith(normalized)
    ) {
      if (!bestMatch || candidate.length > bestMatch.length) {
        bestMatch = candidate;
      }
    }
  }

  const baseName = bestMatch || cleaned;
  return {
    name: baseName,
    id: toId(baseName),
  };
}

function splitTopLevel(value, delimiter = "/") {
  const text = normalizeSpace(value);
  if (!text.includes(delimiter)) {
    return [text];
  }
  const items = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    }

    if (char === delimiter && depth === 0) {
      if (normalizeSpace(current)) {
        items.push(normalizeSpace(current));
      }
      current = "";
    } else {
      current += char;
    }
  }
  if (normalizeSpace(current)) {
    items.push(normalizeSpace(current));
  }
  return items.length ? items : [text];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTeacherIndexes(teachersMap) {
  const surnameCounts = new Map();
  for (const teacher of teachersMap.values()) {
    const surname = teacher.cleanName.split(" ")[0];
    surnameCounts.set(surname, (surnameCounts.get(surname) ?? 0) + 1);
  }

  const aliases = [];
  for (const teacher of teachersMap.values()) {
    for (const alias of teacher.aliases) {
      const surnameOnly = alias === teacher.cleanName.split(" ")[0];
      if (surnameOnly && surnameCounts.get(alias) > 1) {
        continue;
      }
      aliases.push({
        alias,
        aliasLower: alias.toLowerCase(),
        teacherId: teacher.id,
      });
    }
  }

  aliases.sort((a, b) => b.alias.length - a.alias.length);
  return aliases;
}

function findTeacherIdsInText(text, teacherAliases) {
  const normalized = normalizeSpace(text).toLowerCase();
  const teacherIds = [];
  for (const alias of teacherAliases) {
    if (normalized.includes(alias.aliasLower) && !teacherIds.includes(alias.teacherId)) {
      teacherIds.push(alias.teacherId);
    }
  }
  return teacherIds;
}

function extractTrailingTeacherName(text) {
  const normalized = normalizeSpace(text);
  const match = normalized.match(/([A-ZА-ЯӘІҢҒҮҰҚӨҺ][^\s/()]+(?:\s+[A-ZА-ЯӘІҢҒҮҰҚӨҺ][^/\s()]*)?)$/u);
  return match ? normalizeSpace(match[1]) : "";
}

function ensureTeacherByName(rawName, teachersMap, teacherAliases) {
  const cleanName = cleanTeacherName(rawName);
  if (!cleanName) {
    return null;
  }
  const existing = Array.from(teachersMap.values()).find(
    (teacher) => teacher.cleanName === cleanName
  );
  if (existing) {
    return existing.id;
  }

  const id = toId(cleanName);
  const teacher = {
    id,
    fullName: cleanName,
    cleanName,
    shortName: makeShortTeacherName(cleanName),
    aliases: createTeacherAliases(cleanName),
    subjectNames: new Set(),
    classIds: new Set(),
    source: "derived_from_schedule",
    active: true,
  };
  teachersMap.set(id, teacher);
  if (teacherAliases) {
    teacher.aliases.forEach((alias) => {
      teacherAliases.push({
        alias,
        aliasLower: alias.toLowerCase(),
        teacherId: teacher.id,
      });
    });
    teacherAliases.sort((a, b) => b.alias.length - a.alias.length);
  }
  return id;
}

function parseSegment(segmentText, roomText, teacherAliases, teachersMap, previousSubject) {
  const text = normalizeSpace(segmentText);
  const room = normalizeSpace(roomText);
  if (!text) {
    return null;
  }

  let subjectName = "";
  let teacherIds = [];

  const parenthesized = text.match(/^(.+?)\((.+)\)$/u);
  if (parenthesized) {
    subjectName = sanitizeSubjectName(parenthesized[1]);
    teacherIds = findTeacherIdsInText(parenthesized[2], teacherAliases);
    if (!teacherIds.length) {
      const derivedNames = splitTopLevel(parenthesized[2], ",");
      for (const derivedName of derivedNames) {
        const teacherId = ensureTeacherByName(derivedName, teachersMap, teacherAliases);
        if (teacherId && !teacherIds.includes(teacherId)) {
          teacherIds.push(teacherId);
        }
      }
    }
  } else {
    teacherIds = findTeacherIdsInText(text, teacherAliases);
    if (teacherIds.length) {
      let stripped = text;
      for (const teacherId of teacherIds) {
        const teacher = teachersMap.get(teacherId);
        for (const alias of teacher.aliases) {
          stripped = stripped.replace(new RegExp(escapeRegex(alias), "giu"), " ");
        }
      }
      subjectName = sanitizeSubjectName(stripped);
    } else {
      const trailingTeacher = extractTrailingTeacherName(text);
      if (trailingTeacher) {
        const teacherId = ensureTeacherByName(trailingTeacher, teachersMap, teacherAliases);
        if (teacherId) {
          teacherIds.push(teacherId);
          subjectName = sanitizeSubjectName(text.replace(trailingTeacher, " "));
        }
      }
    }
  }

  if (!subjectName) {
    subjectName = sanitizeSubjectName(previousSubject || text);
  }

  const teacherNames = teacherIds
    .map((teacherId) => teachersMap.get(teacherId))
    .filter(Boolean)
    .map((teacher) => teacher.shortName || teacher.cleanName);

  return {
    rawText: text,
    subjectName,
    roomText: room,
    teacherIds,
    teacherNames,
  };
}

function parseLessonCell(rawText, roomText, teacherAliases, teachersMap) {
  const text = normalizeSpace(rawText);
  const room = normalizeSpace(roomText);
  const pieces = splitTopLevel(text);
  const roomPieces = splitTopLevel(room);
  const subgroups = [];
  let previousSubject = "";

  const useSegments =
    pieces.length > 1 && (text.includes("(") || roomPieces.length > 1 || text.includes("/"));

  const rawSegments = useSegments ? pieces : [text];
  rawSegments.forEach((segment, index) => {
    const subgroup = parseSegment(
      segment,
      roomPieces[index] ?? roomPieces[0] ?? room,
      teacherAliases,
      teachersMap,
      previousSubject
    );
    if (subgroup) {
      previousSubject = subgroup.subjectName || previousSubject;
      subgroups.push(subgroup);
    }
  });

  if (!subgroups.length) {
    return null;
  }

  const teacherIds = [...new Set(subgroups.flatMap((subgroup) => subgroup.teacherIds))];
  const teacherNames = [...new Set(subgroups.flatMap((subgroup) => subgroup.teacherNames))];
  const subjectNames = [...new Set(subgroups.map((subgroup) => subgroup.subjectName))];
  const roomTexts = [...new Set(subgroups.map((subgroup) => subgroup.roomText).filter(Boolean))];

  return {
    rawText: text,
    roomText: room,
    subjectName: subjectNames[0] ?? text,
    subjectNames,
    teacherIds,
    teacherNames,
    roomTexts,
    subgroups,
    entryType: inferEntryType(subjectNames[0] ?? text, text),
  };
}

function collectRawRows(workbookKey, workbook) {
  const docs = [];
  workbook.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
    });
    rows.forEach((row, index) => {
      docs.push({
        id: makeDocId(workbookKey, sheetName, `row_${index + 1}`),
        workbookKey,
        sheetName,
        rowIndex: index + 1,
        values: row.map((value) => (typeof value === "number" ? value : String(value ?? ""))),
      });
    });
  });
  return docs;
}

function parseBellSchedule(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const docs = [];
  for (let index = 1; index < rows.length; index += 1) {
    const lessonNumber = parseLessonNumber(rows[index][0]);
    const text = normalizeSpace(rows[index][1]);
    if (!text) {
      continue;
    }
    const { start, end, raw } = parseTimeRange(text);
    docs.push({
      id: makeDocId("bell", lessonNumber || index, raw),
      lessonNumber,
      label: text,
      timeStart: start,
      timeEnd: end,
      rawTimeText: raw,
      eventType: lessonNumber ? "lesson" : "break",
      order: index,
    });
  }
  return docs;
}

function parseTeacherWorkbook(workbook) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
    header: 1,
    defval: "",
  });
  const roomsRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[2]], {
    header: 1,
    defval: "",
  });

  const teachers = new Map();
  const classes = new Map();
  const subjects = new Map();
  const teacherLoadDocs = [];
  const referenceLinks = XLSX.utils
    .sheet_to_json(workbook.Sheets[workbook.SheetNames[1]], { header: 1, defval: "" })
    .flat()
    .map(normalizeSpace)
    .filter(Boolean);
  const canonicalSubjects = [];

  const classColumns = [];
  for (let col = 4; col < rows[1].length; col += 1) {
    const classId = normalizeClassId(rows[1][col]);
    if (isClassId(classId)) {
      classColumns.push({ classId, col });
      classes.set(classId, {
        id: classId,
        name: classId,
        grade: parseInt(classId, 10),
        letter: classId.replace(/^\d+/, ""),
        studentCount: parseNumber(rows[2][col]) ?? null,
        academicYear: "2025-2026",
        source: "teacher_load",
      });
    }
  }

  let currentTeacher = null;

  for (let rowIndex = 3; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const teacherName = normalizeSpace(row[1]);
    if (teacherName) {
      const cleanName = cleanTeacherName(teacherName);
      const teacher = {
        id: toId(cleanName),
        fullName: cleanName,
        cleanName,
        shortName: makeShortTeacherName(cleanName),
        aliases: createTeacherAliases(cleanName),
        subjectNames: new Set(),
        classIds: new Set(),
        source: "teacher_load",
        active: true,
      };
      teachers.set(teacher.id, teacher);
      currentTeacher = teacher;
    }

    if (!currentTeacher) {
      continue;
    }

    const subjectName = normalizeSpace(row[3]);
    if (!subjectName) {
      continue;
    }

    currentTeacher.subjectNames.add(subjectName);
    const subjectId = toId(subjectName);
    if (!subjects.has(subjectId)) {
      subjects.set(subjectId, {
        id: subjectId,
        name: subjectName,
        source: "teacher_load",
      });
      canonicalSubjects.push(subjectName);
    }

    for (const classColumn of classColumns) {
      const hours = parseNumber(row[classColumn.col]);
      if (!hours) {
        continue;
      }
      currentTeacher.classIds.add(classColumn.classId);
      teacherLoadDocs.push({
        id: makeDocId(currentTeacher.id, subjectName, classColumn.classId),
        teacherId: currentTeacher.id,
        teacherName: currentTeacher.fullName,
        subjectId,
        subjectName,
        baseSubjectId: resolveBaseSubject(subjectName, canonicalSubjects).id,
        baseSubjectName: resolveBaseSubject(subjectName, canonicalSubjects).name,
        classId: classColumn.classId,
        hours,
        academicYear: "2025-2026",
      });
    }
  }

  const rooms = new Map();
  for (let rowIndex = 1; rowIndex < roomsRows.length; rowIndex += 1) {
    const row = roomsRows[rowIndex];
    const roomNumber = normalizeSpace(row[1]);
    if (!roomNumber) {
      continue;
    }
    const managerName = cleanTeacherName(row[5]);
    if (managerName) {
      ensureTeacherByName(managerName, teachers);
    }
    rooms.set(roomNumber, {
      id: roomNumber,
      roomNumber,
      floor: parseNumber(row[2]) ?? null,
      capacity: parseNumber(row[3]) ?? null,
      assignedClass: isClassId(row[4]) ? normalizeClassId(row[4]) : normalizeClassId(row[4]) || null,
      managerTeacherName: managerName || null,
      managerTeacherId: managerName
        ? Array.from(teachers.values()).find((teacher) => teacher.cleanName === managerName)?.id ?? null
        : null,
      description: normalizeSpace(row[6]) || null,
      source: "teacher_rooms",
    });
  }

  return {
    teachers,
    classes,
    subjects,
    teacherLoadDocs,
    rooms,
    referenceLinks,
    canonicalSubjects,
  };
}

function parseScheduleWorkbook(workbook, teachers, classes, subjects, rooms) {
  const teacherAliases = buildTeacherIndexes(teachers);
  const canonicalSubjects = Array.from(subjects.values())
    .filter((subject) => subject.source === "teacher_load")
    .map((subject) => subject.name);
  const regularSheet = workbook.Sheets[workbook.SheetNames[0]];
  const assessmentSheet = workbook.Sheets[workbook.SheetNames[1]];
  const roomSheet = workbook.Sheets[workbook.SheetNames[2]];

  const parseEntriesFromSheet = (sheet, collectionPrefix) => {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const headerIndex = detectHeaderRow(rows);
    const classDefs = extractClassDefinitions(rows[headerIndex]);
    const entries = [];
    let currentDay = null;

    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const dayKey = detectDayKey(row);
      if (dayKey) {
        currentDay = dayKey;
        continue;
      }

      for (const classDef of classDefs) {
        const lessonNumber = parseLessonNumber(row[classDef.lessonCol]);
        const timeInfo = parseTimeRange(row[classDef.timeCol]);
        const rawText = normalizeSpace(row[classDef.subjectCol]);
        const roomText = normalizeSpace(row[classDef.roomCol]);

        if (!currentDay || !lessonNumber || !timeInfo.raw || !rawText) {
          continue;
        }

        if (!classes.has(classDef.classId)) {
          classes.set(classDef.classId, {
            id: classDef.classId,
            name: classDef.classId,
            grade: parseInt(classDef.classId, 10),
            letter: classDef.classId.replace(/^\d+/, ""),
            studentCount: null,
            academicYear: "2025-2026",
            source: "schedule",
          });
        }

        const parsed = parseLessonCell(rawText, roomText, teacherAliases, teachers);
        if (!parsed) {
          continue;
        }

        parsed.subjectNames.forEach((subjectName) => {
          const subjectId = toId(subjectName);
          if (!subjects.has(subjectId)) {
            subjects.set(subjectId, {
              id: subjectId,
              name: subjectName,
              source: collectionPrefix,
            });
          }
        });

        parsed.teacherIds.forEach((teacherId) => {
          const teacher = teachers.get(teacherId);
          if (!teacher) {
            return;
          }
          parsed.subjectNames.forEach((subjectName) => teacher.subjectNames.add(subjectName));
          teacher.classIds.add(classDef.classId);
        });

        parsed.roomTexts.forEach((roomId) => {
          if (!rooms.has(roomId) && roomId) {
            rooms.set(roomId, {
              id: roomId,
              roomNumber: roomId,
              floor: null,
              capacity: null,
              assignedClass: null,
              managerTeacherName: null,
              managerTeacherId: null,
              description: null,
              source: collectionPrefix,
            });
          }
        });

        entries.push({
          id: makeDocId(
            collectionPrefix,
            currentDay,
            classDef.classId,
            lessonNumber,
            timeInfo.start || timeInfo.raw
          ),
          sourceSheet: collectionPrefix,
          academicYear: "2025-2026",
          dayKey: currentDay,
          classId: classDef.classId,
          lessonNumber,
          timeStart: timeInfo.start,
          timeEnd: timeInfo.end,
          rawTimeText: timeInfo.raw,
          subjectId: toId(parsed.subjectName),
          subjectName: parsed.subjectName,
          baseSubjectId: resolveBaseSubject(parsed.subjectName, canonicalSubjects).id,
          baseSubjectName: resolveBaseSubject(parsed.subjectName, canonicalSubjects).name,
          subjectNames: parsed.subjectNames,
          teacherIds: parsed.teacherIds,
          teacherNames: parsed.teacherNames,
          roomIds: parsed.roomTexts,
          rawText,
          rawRoomText: roomText,
          entryType: parsed.entryType,
          subgroups: parsed.subgroups,
        });
      }
    }

    return entries;
  };

  const scheduleEntries = parseEntriesFromSheet(regularSheet, "regular_schedule");
  const assessmentScheduleEntries = parseEntriesFromSheet(
    assessmentSheet,
    "assessment_schedule"
  );

  const roomRows = XLSX.utils.sheet_to_json(roomSheet, { header: 1, defval: "" });
  const roomOccupancy = [];
  let currentDay = null;
  let roomHeaders = [];

  for (let rowIndex = 0; rowIndex < roomRows.length; rowIndex += 1) {
    const row = roomRows[rowIndex];
    const dayKey = detectDayKey(row);
    if (dayKey) {
      currentDay = dayKey;
      roomHeaders = [];
      continue;
    }

    if (currentDay && !roomHeaders.length) {
      const possibleHeaders = row
        .slice(2)
        .map((value) => normalizeSpace(value))
        .filter(Boolean);
      if (possibleHeaders.length) {
        roomHeaders = row.slice(2).map((value) => normalizeSpace(value));
        continue;
      }
    }

    const lessonNumber = parseLessonNumber(row[0]);
    const timeInfo = parseTimeRange(row[1]);
    if (!currentDay || !lessonNumber || !timeInfo.raw || !roomHeaders.length) {
      continue;
    }

    for (let col = 2; col < row.length; col += 1) {
      const classId = normalizeClassId(row[col]);
      const roomHeader = normalizeSpace(roomHeaders[col - 2]);
      if (!classId || !roomHeader) {
        continue;
      }

      const roomNumber = normalizeSpace(roomHeader.split(" ")[0]);
      if (!roomNumber) {
        continue;
      }

      roomOccupancy.push({
        id: makeDocId(currentDay, lessonNumber, roomNumber, classId),
        dayKey: currentDay,
        lessonNumber,
        timeStart: timeInfo.start,
        timeEnd: timeInfo.end,
        rawTimeText: timeInfo.raw,
        roomId: roomNumber,
        classId,
        headerText: roomHeader,
      });
    }
  }

  return {
    scheduleEntries,
    assessmentScheduleEntries,
    roomOccupancy,
  };
}

async function resetCollection(name) {
  while (true) {
    const snapshot = await db.collection(name).limit(400).get();
    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function writeCollection(name, docs) {
  if (!docs.length) {
    return;
  }

  for (let index = 0; index < docs.length; index += 400) {
    const batch = db.batch();
    const chunk = docs.slice(index, index + 400);
    chunk.forEach((doc) => {
      const { id, ...data } = doc;
      batch.set(db.collection(name).doc(String(id)), data);
    });
    await batch.commit();
  }
}

async function run() {
  const scheduleWorkbook = XLSX.readFile(WORKBOOK_PATHS.schedule);
  const teacherWorkbook = XLSX.readFile(WORKBOOK_PATHS.teacherLoad);

  const rawRows = [
    ...collectRawRows("schedule", scheduleWorkbook),
    ...collectRawRows("teacher_load", teacherWorkbook),
  ];

  const teacherData = parseTeacherWorkbook(teacherWorkbook);
  const bellSchedule = parseBellSchedule(teacherWorkbook.Sheets[teacherWorkbook.SheetNames[3]]);
  const scheduleData = parseScheduleWorkbook(
    scheduleWorkbook,
    teacherData.teachers,
    teacherData.classes,
    teacherData.subjects,
    teacherData.rooms
  );

  const teachersDocs = Array.from(teacherData.teachers.values()).map((teacher) => ({
    id: teacher.id,
    fullName: teacher.fullName,
    shortName: teacher.shortName,
    cleanName: teacher.cleanName,
    aliases: teacher.aliases,
    subjectNames: Array.from(teacher.subjectNames).sort(),
    subjectIds: Array.from(teacher.subjectNames).map(toId).sort(),
    baseSubjectIds: Array.from(teacher.subjectNames)
      .map((subjectName) =>
        resolveBaseSubject(subjectName, teacherData.canonicalSubjects).id
      )
      .sort(),
    classIds: Array.from(teacher.classIds).sort(),
    source: teacher.source,
    active: teacher.active,
  }));

  const classesDocs = Array.from(teacherData.classes.values());
  const subjectsDocs = Array.from(teacherData.subjects.values()).map((subject) => {
    const baseSubject = resolveBaseSubject(
      subject.name,
      teacherData.canonicalSubjects
    );
    return {
      ...subject,
      normalizedName: normalizeSpace(subject.name).toLowerCase(),
      baseSubjectId: baseSubject.id,
      baseSubjectName: baseSubject.name,
    };
  });
  const roomsDocs = Array.from(teacherData.rooms.values());

  const metaDocs = [
    {
      id: "school",
      schoolName: "AISHack",
      academicYear: "2025-2026",
      timezone: "Asia/Qyzylorda",
      sourceFiles: [
        "data/schedule.xlsx",
        "data/teacher-load.xlsx",
      ],
      importedAt: new Date().toISOString(),
      referenceLinks: teacherData.referenceLinks,
      counts: {
        rawRows: rawRows.length,
        teachers: teachersDocs.length,
        classes: classesDocs.length,
        subjects: subjectsDocs.length,
        rooms: roomsDocs.length,
        bellSchedule: bellSchedule.length,
        teacherLoad: teacherData.teacherLoadDocs.length,
        scheduleEntries: scheduleData.scheduleEntries.length,
        assessmentScheduleEntries: scheduleData.assessmentScheduleEntries.length,
        roomOccupancy: scheduleData.roomOccupancy.length,
      },
    },
  ];

  for (const collection of COLLECTIONS_TO_RESET) {
    await resetCollection(collection);
  }

  await writeCollection("meta", metaDocs);
  await writeCollection("teachers", teachersDocs);
  await writeCollection("classes", classesDocs);
  await writeCollection("subjects", subjectsDocs);
  await writeCollection("rooms", roomsDocs);
  await writeCollection("bell_schedule", bellSchedule);
  await writeCollection("teacher_load", teacherData.teacherLoadDocs);
  await writeCollection("schedule_entries", scheduleData.scheduleEntries);
  await writeCollection(
    "assessment_schedule_entries",
    scheduleData.assessmentScheduleEntries
  );
  await writeCollection("room_occupancy", scheduleData.roomOccupancy);
  await writeCollection("raw_sheet_rows", rawRows);

  console.log("Import completed.");
  console.log(
    JSON.stringify(
      {
        teachers: teachersDocs.length,
        classes: classesDocs.length,
        subjects: subjectsDocs.length,
        rooms: roomsDocs.length,
        bellSchedule: bellSchedule.length,
        teacherLoad: teacherData.teacherLoadDocs.length,
        scheduleEntries: scheduleData.scheduleEntries.length,
        assessmentScheduleEntries: scheduleData.assessmentScheduleEntries.length,
        roomOccupancy: scheduleData.roomOccupancy.length,
        rawRows: rawRows.length,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});

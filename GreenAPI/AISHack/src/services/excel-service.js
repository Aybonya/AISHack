const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const WORKBOOK_PATHS = {
  schedule: path.join(DATA_DIR, "schedule.xlsx"),
  teacherLoad: path.join(DATA_DIR, "teacher-load.xlsx"),
};

// --- Вспомогательные функции из import-school-data.js ---
const DAY_MAP = [
  { key: "monday", labels: ["Дүйсенбі", "понедельник"] },
  { key: "tuesday", labels: ["Сейсенбі", "вторник"] },
  { key: "wednesday", labels: ["Сәрсенбі", "среда"] },
  { key: "thursday", labels: ["Бейсенбі", "четверг"] },
  { key: "friday", labels: ["Жұма", "пятница"] },
  { key: "saturday", labels: ["Сенбі", "суббота"] },
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
  "құқық": "құқық негездере",
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
    а: "a", ә: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", қ: "k", л: "l", м: "m", н: "n", ң: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ұ: "u", ү: "u", ф: "f", х: "h", һ: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", і: "i", ь: "", э: "e", ю: "yu", я: "ya"
  };
  return normalizeSpace(value).toLowerCase().split("").map((char) => map[char] ?? char).join("");
}

function toId(value) {
  return transliterate(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
}

function parseNumber(value) {
  const normalized = normalizeSpace(value).replace(",", ".");
  if (!normalized) return null;
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
  if (!match) return { raw: text, start: null, end: null };
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
  if (parts.length < 2) return cleanName;
  const surname = parts[0];
  const initials = parts.slice(1, 3).map((part) => `${part[0]}.`).join("");
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
  if (parts[1] && parts[2]) aliases.add(`${surname} ${parts[1][0]}.${parts[2][0]}.`);
  return Array.from(aliases).map(normalizeSpace).filter(Boolean);
}

function detectDayKey(row) {
  const text = row.map(normalizeSpace).filter(Boolean).join(" ");
  if (!text) return null;
  for (const day of DAY_MAP) {
    for (const label of day.labels) {
      if (text.includes(label)) return day.key;
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
    if (cell === "Уақыт") { currentTimeCol = col; continue; }
    if (cell === "№") { currentLessonCol = col; continue; }
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

function sanitizeSubjectName(value) {
  let text = normalizeSpace(value)
    .replace(/[(),]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\/+/g, " ")
    .replace(/\s+[A-ZА-ЯӘІҢҒҮҰҚӨҺ]\.?[A-ZА-ЯӘІҢҒҮҰҚӨҺ]?\.?$/u, "")
    .replace(/\s+[А-ЯӘІҢҒҮҰҚӨҺ]{2,}$/u, "")
    .replace(/\s+[A-ZА-ЯӘІҢҒҮҰҚӨҺ]$/u, "")
    .replace(/[.,;:/-]+$/g, "");
  return normalizeSpace(text) || normalizeSpace(value);
}

function resolveBaseSubject(subjectName, canonicalSubjects) {
  const cleaned = sanitizeSubjectName(subjectName);
  const normalized = cleaned.toLowerCase();
  const synonym = SUBJECT_SYNONYMS[normalized];
  if (synonym) return { name: synonym, id: toId(synonym) };

  let bestMatch = null;
  for (const candidate of (canonicalSubjects || [])) {
    const candidateNormalized = candidate.toLowerCase();
    if (normalized === candidateNormalized || normalized.startsWith(candidateNormalized) || candidateNormalized.startsWith(normalized)) {
      if (!bestMatch || candidate.length > bestMatch.length) bestMatch = candidate;
    }
  }
  const baseName = bestMatch || cleaned;
  return { name: baseName, id: toId(baseName) };
}

function splitTopLevel(value, delimiter = "/") {
  const text = normalizeSpace(value);
  if (!text.includes(delimiter)) return [text];
  const items = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    if (char === delimiter && depth === 0) {
      if (normalizeSpace(current)) items.push(normalizeSpace(current));
      current = "";
    } else current += char;
  }
  if (normalizeSpace(current)) items.push(normalizeSpace(current));
  return items.length ? items : [text];
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
      if (surnameOnly && surnameCounts.get(alias) > 1) continue;
      aliases.push({ alias, aliasLower: alias.toLowerCase(), teacherId: teacher.id });
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
  const match = normalizeSpace(text).match(/([A-ZА-ЯӘІҢҒҮҰҚӨҺ][^\s/()]+(?:\s+[A-ZА-ЯӘІҢҒҮҰҚӨҺ][^/\s()]*)?)$/u);
  return match ? normalizeSpace(match[1]) : "";
}

function ensureTeacherByName(rawName, teachersMap, teacherAliases) {
  const cleanName = cleanTeacherName(rawName);
  if (!cleanName) return null;
  const existing = Array.from(teachersMap.values()).find(t => t.cleanName === cleanName);
  if (existing) return existing.id;
  const id = toId(cleanName);
  const teacher = {
    id, fullName: cleanName, cleanName, shortName: makeShortTeacherName(cleanName),
    aliases: createTeacherAliases(cleanName), subjectNames: new Set(), classIds: new Set(), active: true
  };
  teachersMap.set(id, teacher);
  if (teacherAliases) {
    teacher.aliases.forEach(alias => teacherAliases.push({ alias, aliasLower: alias.toLowerCase(), teacherId: id }));
    teacherAliases.sort((a, b) => b.alias.length - a.alias.length);
  }
  return id;
}

function parseSegment(segmentText, roomText, teacherAliases, teachersMap, previousSubject) {
  const text = normalizeSpace(segmentText);
  if (!text) return null;
  let subjectName = "";
  let teacherIds = [];
  const parenthesized = text.match(/^(.+?)\((.+)\)$/u);
  if (parenthesized) {
    subjectName = sanitizeSubjectName(parenthesized[1]);
    teacherIds = findTeacherIdsInText(parenthesized[2], teacherAliases);
    if (!teacherIds.length) {
      const derivedNames = splitTopLevel(parenthesized[2], ",");
      for (const d of derivedNames) {
        const tid = ensureTeacherByName(d, teachersMap, teacherAliases);
        if (tid && !teacherIds.includes(tid)) teacherIds.push(tid);
      }
    }
  } else {
    teacherIds = findTeacherIdsInText(text, teacherAliases);
    if (teacherIds.length) {
      let stripped = text;
      for (const tid of teacherIds) {
        const teacher = teachersMap.get(tid);
        for (const alias of teacher.aliases) stripped = stripped.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), " ");
      }
      subjectName = sanitizeSubjectName(stripped);
    } else {
      const trailing = extractTrailingTeacherName(text);
      if (trailing) {
        const tid = ensureTeacherByName(trailing, teachersMap, teacherAliases);
        if (tid) { teacherIds.push(tid); subjectName = sanitizeSubjectName(text.replace(trailing, " ")); }
      }
    }
  }
  if (!subjectName) subjectName = sanitizeSubjectName(previousSubject || text);
  return { rawText: text, subjectName, roomText: normalizeSpace(roomText), teacherIds };
}

function parseLessonCell(rawText, roomText, teacherAliases, teachersMap) {
  const text = normalizeSpace(rawText);
  const room = normalizeSpace(roomText);
  const pieces = splitTopLevel(text);
  const roomPieces = splitTopLevel(room);
  const subgroups = [];
  let previousSubject = "";
  const rawSegments = pieces.length > 1 && (text.includes("(") || roomPieces.length > 1 || text.includes("/")) ? pieces : [text];
  rawSegments.forEach((segment, index) => {
    const sub = parseSegment(segment, roomPieces[index] ?? roomPieces[0] ?? room, teacherAliases, teachersMap, previousSubject);
    if (sub) { previousSubject = sub.subjectName || previousSubject; subgroups.push(sub); }
  });
  if (!subgroups.length) return null;
  return {
    subjectNames: [...new Set(subgroups.map(s => s.subjectName))],
    teacherIds: [...new Set(subgroups.flatMap(s => s.teacherIds))],
    roomTexts: [...new Set(subgroups.map(s => s.roomText).filter(Boolean))],
    subgroups,
    subjectName: subgroups[0].subjectName
  };
}

async function loadDataFromExcel() {
  const result = { teachers: [], scheduleEntries: [], teacherLoad: [], rooms: [], classes: [] };
  if (!fs.existsSync(WORKBOOK_PATHS.schedule) || !fs.existsSync(WORKBOOK_PATHS.teacherLoad)) return result;

  try {
    const teacherWorkbook = XLSX.readFile(WORKBOOK_PATHS.teacherLoad);
    const scheduleWorkbook = XLSX.readFile(WORKBOOK_PATHS.schedule);

    const loadRows = XLSX.utils.sheet_to_json(teacherWorkbook.Sheets[teacherWorkbook.SheetNames[0]], { header: 1, defval: "" });
    const teachersMap = new Map();
    const classesMap = new Map();
    const classCols = [];

    for (let col = 4; col < (loadRows[1] || []).length; col++) {
      const cid = normalizeClassId(loadRows[1][col]);
      if (isClassId(cid)) {
        classCols.push({ id: cid, col });
        classesMap.set(cid, { id: cid, name: cid });
      }
    }

    let currentTeacher = null;
    for (let i = 3; i < loadRows.length; i++) {
      const row = loadRows[i];
      const tName = normalizeSpace(row[1]);
      if (tName) {
        const cleanName = cleanTeacherName(tName);
        const tid = toId(cleanName);
        if (!teachersMap.has(tid)) {
          teachersMap.set(tid, {
            id: tid, fullName: cleanName, cleanName, shortName: makeShortTeacherName(cleanName),
            aliases: createTeacherAliases(cleanName), subjectNames: new Set(), classIds: new Set(), active: true
          });
        }
        currentTeacher = teachersMap.get(tid);
      }
      if (!currentTeacher) continue;
      const subjName = normalizeSpace(row[3]);
      if (!subjName) continue;
      currentTeacher.subjectNames.add(subjName);

      for (const cCol of classCols) {
        const hours = parseNumber(row[cCol.col]);
        if (hours > 0) {
          currentTeacher.classIds.add(cCol.id);
          result.teacherLoad.push({
            id: `${currentTeacher.id}_${toId(subjName)}_${cCol.id}`,
            teacherId: currentTeacher.id,
            teacherName: currentTeacher.fullName,
            subjectName: subjName,
            baseSubjectId: resolveBaseSubject(subjName, []).id,
            baseSubjectName: resolveBaseSubject(subjName, []).name,
            classId: cCol.id,
            hours
          });
        }
      }
    }

    const teacherAliases = buildTeacherIndexes(teachersMap);
    const schedSheet = scheduleWorkbook.Sheets[scheduleWorkbook.SheetNames[0]];
    const schedRows = XLSX.utils.sheet_to_json(schedSheet, { header: 1, defval: "" });
    const headerIdx = detectHeaderRow(schedRows);
    const classDefs = extractClassDefinitions(schedRows[headerIdx]);
    let currentDay = null;

    for (let i = headerIdx + 1; i < schedRows.length; i++) {
      const row = schedRows[i];
      const dKey = detectDayKey(row);
      if (dKey) { currentDay = dKey; continue; }
      if (!currentDay) continue;

      for (const def of classDefs) {
        const lessonNum = parseLessonNumber(row[def.lessonCol]);
        const timeInfo = parseTimeRange(row[def.timeCol]);
        const rawText = normalizeSpace(row[def.subjectCol]);
        if (!lessonNum || !timeInfo.raw || !rawText) continue;

        const parsed = parseLessonCell(rawText, row[def.roomCol], teacherAliases, teachersMap);
        if (!parsed) continue;

        result.scheduleEntries.push({
          id: `entry_${currentDay}_${def.classId}_${lessonNum}`,
          dayKey: currentDay,
          classId: def.classId,
          lessonNumber: lessonNum,
          timeStart: timeInfo.start,
          timeEnd: timeInfo.end,
          subjectName: parsed.subjectName,
          baseSubjectId: resolveBaseSubject(parsed.subjectName, []).id,
          teacherIds: parsed.teacherIds,
          teacherNames: parsed.teacherIds.map(id => teachersMap.get(id)?.shortName || id),
          roomIds: parsed.roomTexts,
          rawText
        });
      }
    }

    result.teachers = Array.from(teachersMap.values()).map(t => ({
      ...t,
      subjectNames: Array.from(t.subjectNames),
      classIds: Array.from(t.classIds),
      baseSubjectIds: Array.from(t.subjectNames).map(s => resolveBaseSubject(s, []).id)
    }));
    result.classes = Array.from(classesMap.values());
    
    return result;
  } catch (e) {
    console.error("Excel parse failed:", e);
    return result;
  }
}

module.exports = { loadDataFromExcel };

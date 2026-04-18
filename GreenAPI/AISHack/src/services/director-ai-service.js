const { db, admin } = require("../firebase");
const stringSimilarity = require("string-similarity");
const { normalizeClassId, normalizeSpace, parseDateKey, parseLessonNumber, toId } = require("../utils");
const {
  buildTeacherIndex,
  parseChatNote,
  recommendReplacements,
} = require("./replacement-engine");
const { saveChatNote } = require("./chat-note-service");
const { invalidateCollectionCache } = require("./school-data-service");

const INCIDENT_KEYWORDS = [
  "\\u0441\\u043b\\u043e\\u043c",
  "\\u043d\\u0435 \\u0440\\u0430\\u0431\\u043e\\u0442\\u0430\\u0435\\u0442",
  "\\u043f\\u0440\\u043e\\u0442\\u0435\\u043a\\u0430",
  "\\u0442\\u0435\\u0447\\u0435\\u0442",
  "\\u043f\\u0440\\u043e\\u0431\\u043b\\u0435\\u043c\\u0430",
  "\\u0440\\u0430\\u0437\\u0431\\u0438\\u0442",
  "\\u043f\\u0430\\u0440\\u0442\\u0430",
  "\\u0441\\u0442\\u0443\\u043b",
  "\\u043e\\u043a\\u043d\\u043e",
  "\\u0434\\u0432\\u0435\\u0440\\u044c",
  "\\u043b\\u0430\\u043c\\u043f\\u0430",
  "\\u0441\\u0432\\u0435\\u0442",
  "\\u0440\\u043e\\u0437\\u0435\\u0442\\u043a\\u0430",
  "\\u0438\\u043d\\u0442\\u0435\\u0440\\u043d\\u0435\\u0442",
  "wi-fi",
].map((item) => JSON.parse(`"${item}"`));

const TASK_VERBS = [
  "\\u043f\\u043e\\u0434\\u0433\\u043e\\u0442\\u043e\\u0432",
  "\\u0437\\u0430\\u043a\\u0430\\u0436",
  "\\u0441\\u0434\\u0435\\u043b\\u0430\\u0439",
  "\\u043f\\u0440\\u043e\\u0432\\u0435\\u0440\\u044c",
  "\\u043e\\u0440\\u0433\\u0430\\u043d\\u0438\\u0437",
  "\\u0441\\u043e\\u0431\\u0435\\u0440\\u0438",
  "\\u043e\\u0442\\u043f\\u0440\\u0430\\u0432",
  "\\u0441\\u043e\\u0437\\u0432\\u043e\\u043d",
  "\\u0434\\u043e\\u0433\\u043e\\u0432\\u043e\\u0440",
  "\\u043f\\u043e\\u043f\\u0440\\u043e\\u0441",
].map((item) => JSON.parse(`"${item}"`));

const ATTENDANCE_PRESENT_RE = /(\d{1,3})\s*(?:детей|оқушы|ученик(?:ов)?|реб[её]нка|присутств)/iu;
const ATTENDANCE_ABSENT_RE = /(\d{1,2})\s*(?:болеют|болеет|отсутств|ауырып|жоқ|қалған)/iu;
const CLASS_RE = /(^|[^\p{L}\d])(\d{1,2}\s*[\p{L}])(?=$|[^\p{L}\d])/u;
const ROOM_RE = /(?:кабинет(?:е)?|каб\.?|room)\s*(\d{1,3}|актовый зал|столовая|спортзал)/iu;
const LEADING_NAME_RE = /^([\p{Lu}][\p{L}-]+)[,\s-]+/u;

// ФИО учителя: "Нахмадинов Марат" / "Ахметова А." / «Я, Смирнова» и т.д.
const FULL_NAME_PATTERNS = [
  /(?:я[,\s]+|учитель[,\s]+|учительница[,\s]+|мұғалім[,\s]+)?([\p{Lu}][\p{Ll}]+(?:\s+[\p{Lu}][\p{Ll}]+){1,2})/u,
];

// Дата/время из WhatsApp-формата: [01:09, 18.04.2026]
const WA_TIMESTAMP_RE = /\[(\d{2}:\d{2}),\s*(\d{2}\.\d{2}\.\d{4})\]/;

// Извлекаем дату из тела сообщения (WhatsApp-формат) или берём текущую
function extractMessageDate(text) {
  const match = normalizeSpace(text).match(WA_TIMESTAMP_RE);
  if (match) {
    // match[2] = "18.04.2026"
    const [day, month, year] = match[2].split(".");
    return parseDateKey(new Date(`${year}-${month}-${day}`));
  }
  return parseDateKey(); // текущая дата
}

function senderTeacherId(senderName, teacherIndex) {
  if (!senderName) {
    return null;
  }
  const normalizedSender = normalizeSpace(senderName).toLowerCase();
  return teacherIndex.aliases.find((alias) => normalizedSender.includes(alias.text))?.teacherId || null;
}

// Ищем учителя в тексте сообщения по ФИО (Нахмадинов Марат и т.д.)
function findTeacherInText(text, teacherIndex) {
  const normalized = normalizeSpace(text).toLowerCase();
  // Сначала ищем по всем известным псевдонимам (длинные совпадения приоритетнее)
  for (const alias of teacherIndex.aliases) {
    if (alias.text.length >= 4 && normalized.includes(alias.text)) {
      return alias.teacherId;
    }
  }
  // Дополнительно: ищем паттерн «Фамилия Имя» (2+ слова с заглавной)
  for (const pattern of FULL_NAME_PATTERNS) {
    const match = normalizeSpace(text).match(pattern);
    if (match) {
      const candidate = normalizeSpace(match[1]).toLowerCase();
      const found = teacherIndex.aliases.find((a) => candidate.includes(a.text) || a.text.includes(candidate.split(" ")[0]));
      if (found) return found.teacherId;
    }
  }
  return null;
}

function detectAttendance(text) {
  const normalized = normalizeSpace(text);
  const classMatch = normalized.match(CLASS_RE);
  const structuralMatch = normalized.match(
    /^\s*\d{1,2}\s*[\p{L}]\s*[-:]\s*(\d{1,3})(?:\D+(\d{1,2}))?/u
  );
  const presentMatch =
    structuralMatch ||
    normalized.match(ATTENDANCE_PRESENT_RE) ||
    normalized.match(/-\s*(\d{1,3})\b/u);
  const absentMatch = normalized.match(ATTENDANCE_ABSENT_RE);

  if (!classMatch || !presentMatch) {
    return null;
  }

  const classId = normalizeClassId(classMatch[2]);
  const presentCount = Number(presentMatch[1]);
  const absentCount = absentMatch
    ? Number(absentMatch[1])
    : structuralMatch?.[2]
      ? Number(structuralMatch[2])
      : 0;

  return {
    classId,
    presentCount,
    absentCount,
    totalCount: presentCount + absentCount,
  };
}

function detectIncident(text) {
  const normalized = normalizeSpace(text);
  const lower = normalized.toLowerCase();
  if (!INCIDENT_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return null;
  }

  const roomMatch = normalized.match(ROOM_RE);
  return {
    title: roomMatch ? `Инцидент в ${roomMatch[0]}` : "Школьный инцидент",
    roomText: roomMatch ? normalizeSpace(roomMatch[1]) : null,
    summary: normalized,
    priority:
      lower.includes("слом") || lower.includes("не работает") ? "high" : "medium",
    status: "open",
    category: "facility",
  };
}

function detectDueHint(text) {
  const normalized = normalizeSpace(text).toLowerCase();
  if (normalized.includes("сегодня")) return "today";
  if (normalized.includes("завтра")) return "tomorrow";
  if (normalized.includes("на следующей неделе")) return "next_week";
  if (normalized.includes("до пятницы")) return "before_friday";
  return "unspecified";
}

function resolveAssignee(sentence, teachers, teacherIndex) {
  const normalized = normalizeSpace(sentence);
  const lower = normalized.toLowerCase();

  for (const alias of teacherIndex.aliases) {
    if (lower.includes(alias.text)) {
      const teacher = teachers.find((item) => item.id === alias.teacherId);
      return {
        assigneeId: alias.teacherId,
        assigneeName: teacher?.fullName || alias.text,
      };
    }
  }

  const leadingNameMatch = normalized.match(LEADING_NAME_RE);
  if (leadingNameMatch) {
    return {
      assigneeId: toId(leadingNameMatch[1]),
      assigneeName: leadingNameMatch[1],
    };
  }

  return null;
}

function cleanTaskTitle(sentence, assigneeName) {
  let title = normalizeSpace(sentence);
  if (!assigneeName) return title;
  const escaped = assigneeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  title = title.replace(new RegExp(`^${escaped}[,\\s-]*`, "iu"), "");
  return normalizeSpace(title);
}

function detectTasks(text, teachers, teacherIndex) {
  const normalized = normalizeSpace(text);
  const lower = normalized.toLowerCase();

  if (lower.includes("забол") || lower.includes("болеет") || lower.includes("ауырып")) {
    return [];
  }

  return normalized
    .split(/[.!?]+/)
    .map(normalizeSpace)
    .filter(Boolean)
    .map((sentence) => {
      const sentenceLower = sentence.toLowerCase();
      const looksLikeTask =
        /[,:]/.test(sentence) || TASK_VERBS.some((verb) => sentenceLower.includes(verb));

      if (!looksLikeTask) return null;

      const assignee = resolveAssignee(sentence, teachers, teacherIndex);
      if (!assignee) return null;

      return {
        assigneeId: assignee.assigneeId,
        assigneeName: assignee.assigneeName,
        title: cleanTaskTitle(sentence, assignee.assigneeName) || sentence,
        description: sentence,
        dueHint: detectDueHint(sentence),
        status: "open",
        priority: "medium",
        sourceType: "director_command",
      };
    })
    .filter(Boolean);
}

async function storeAttendance(messageId, senderName, source, attendance, dateKey = null) {
  const resolvedDate = dateKey || parseDateKey();
  const docId = `${resolvedDate}_${attendance.classId}_${messageId}`;
  await db.collection("attendance_updates").doc(docId).set({
    ...attendance,
    messageId,
    senderName: senderName || null,
    source,
    dateKey: resolvedDate,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  invalidateCollectionCache("attendance_updates");
  return docId;
}

async function storeIncident(messageId, senderName, source, incident) {
  const docRef = db.collection("incident_cards").doc();
  await docRef.set({
    ...incident,
    messageId,
    senderName: senderName || null,
    source,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  invalidateCollectionCache("incident_cards");
  return docRef.id;
}

async function storeTasks(messageId, senderName, source, tasks) {
  const ids = [];
  for (const task of tasks) {
    const docRef = db.collection("director_tasks").doc();
    await docRef.set({
      ...task,
      messageId,
      source,
      senderName: senderName || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    ids.push(docRef.id);
  }
  invalidateCollectionCache("director_tasks");
  return ids;
}

async function storeMessageEnvelope(message) {
  const ref = db.collection("chat_messages").doc();
  await ref.set({
    ...message,
    normalizedText: normalizeSpace(message.text),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  invalidateCollectionCache("chat_messages");
  return ref.id;
}

async function createOrchestratorEvent(messageId, eventType, payload) {
  const ref = db.collection("orchestrator_events").doc();
  await ref.set({
    messageId,
    eventType,
    payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  invalidateCollectionCache("orchestrator_events");
  return ref.id;
}

// ── ИНТЕГРАЦИЯ С ИИ (GPT-4) ────────────────────────────────────────────────
function findFuzzyTeacher(name, teacherIndex) {
  if (!name) return null;
  const normalizedName = normalizeSpace(name).toLowerCase();
  
  // Собираем все алиасы учителей в массив строк
  const targetStrings = teacherIndex.aliases.map(a => a.text);
  if (targetStrings.length === 0) return null;
  
  const matches = stringSimilarity.findBestMatch(normalizedName, targetStrings);
  const bestMatch = matches.bestMatch;
  
  // Если совпадение больше 40% (учитывая "Лина" -> "Есалина")
  if (bestMatch.rating > 0.4) {
    console.log(`[FUZZY] Найдено совпадение: "${name}" -> "${bestMatch.target}" (рейтинг: ${bestMatch.rating})`);
    const aliasObj = teacherIndex.aliases.find(a => a.text === bestMatch.target);
    if (aliasObj) return aliasObj.teacherId;
  }
  return null;
}

async function smartAIAnalyze(text, teacherAliases) {
  try {
    const prompt = `
Ты умный ассистент завуча школы. Проанализируй текст от учителей и извлеки события в строгом JSON.
Извлекай только то, что есть в тексте. Учителя могут писать с ошибками, неформально или странно.

СЕГОДНЯ: ${new Date().toLocaleDateString('ru-RU')}
ТЕКУЩИЙ ДЕНЬ НЕДЕЛИ: ${new Date().toLocaleDateString('en-US', {weekday: 'long'}).toLowerCase()}

Возможные события:
1. attendance: {"classId": "10A", "presentCount": 25, "absentCount": 3}
2. incident: {"title": "Кратко", "summary": "Подробно", "priority": "low"|"medium"|"high"}
3. replacement: {"teacherName": "ФИО или Имя", "dayKey": "monday|tuesday|wednesday|thursday|friday|saturday", "lessonNumber": 4, "classId": "11A"}
4. tasks: [{"title": "...", "dueHint": "...", "assigneeName": "..."}]
5. partnership: {"topic": "Краткая суть", "priority": "high"}

ИГНОРИРОВАНИЕ СПАМА:
Если сообщение вообще не относится к школьным делам (например: вопросы "как дела", личные диалоги, спам, сторонние эвенты вне школы, рассылка), верни абсолютно пустой JSON объект: {}

ВАЖНО ДЛЯ REPLACEMENT (ЗАМЕН):
Если замена требуется на ВЕСЬ ДЕНЬ ("все уроки", "не приду", "заболела" без указания урока), установи "lessonNumber": null и "classId": null.
Если день (dayKey) не указан в тексте, но по смыслу подразумевается замена "на сегодня", используй ТЕКУЩИЙ ДЕНЬ НЕДЕЛИ (указан выше). Если "на завтра" — укажи завтрашний день недели.

Текст сообщения:
"${text}"
`;
    const response = await fetch("http://127.0.0.1:5001/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt, system_prompt: "Выведи только валидный JSON без markdown блоков." })
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    let content = data.content.trim();
    if (content.startsWith("\`\`\`json")) {
      content = content.replace(/^\`\`\`json/i, "").replace(/\`\`\`$/i, "").trim();
    }
    
    return JSON.parse(content);
  } catch (err) {
    console.error("AI Analysis failed, falling back to regex:", err.message);
    return null;
  }
}

async function processIncomingMessage({ message, schoolData }) {
  const teacherIndex = buildTeacherIndex(schoolData.teachers);
  const rawText = message.text || "";

  // ── 1. Определяем отправителя ──────────────────────────────────────────────
  // Приоритет: совпадение по имени профиля → поиск ФИО в тексте
  const senderId =
    senderTeacherId(message.senderName, teacherIndex) ||
    findTeacherInText(rawText, teacherIndex);

  // ── 2. Дата сообщения (из текста или текущая) ──────────────────────────────
  const messageDateKey = extractMessageDate(rawText);

  // ── 3. Сохраняем конверт сообщения ────────────────────────────────────────
  const messageId = await storeMessageEnvelope({
    chatId: message.chatId || null,
    senderName: message.senderName || null,
    senderRole: message.senderRole || "teacher",
    senderTeacherId: senderId,
    source: message.source || "whatsapp_green_api",
    externalMessageId: message.externalMessageId || null,
    dateKey: messageDateKey,
    text: rawText,
  });

  // ── 4. Детекция: Смарт-ИИ или регулярки ──────────────────────────
  const detections = {
    attendance: null,
    incident: null,
    tasks: [],
  };
  
  let parsedAbsence = { intent: "note", teacherId: null, classId: null, lessonNumber: null, dayKey: null, rawText: rawText };
  
  // Пробуем умный ИИ
  const aiResult = await smartAIAnalyze(rawText, teacherIndex.aliases);
  if (aiResult) {
    console.log("GPT Parsing result:", aiResult);
    if (aiResult.attendance) detections.attendance = aiResult.attendance;
    if (aiResult.incident) detections.incident = aiResult.incident;
    if (aiResult.tasks) detections.tasks = aiResult.tasks;
    if (aiResult.partnership) detections.partnership = aiResult.partnership;
    if (aiResult.replacement) {
      parsedAbsence.intent = "teacher_absence";
      if (aiResult.replacement.teacherName) {
         parsedAbsence.teacherId = findFuzzyTeacher(aiResult.replacement.teacherName, teacherIndex) 
                                || findTeacherInText(aiResult.replacement.teacherName, teacherIndex) 
                                || senderId;
      }
      parsedAbsence.classId = aiResult.replacement.classId ? normalizeClassId(aiResult.replacement.classId) : null;
      parsedAbsence.lessonNumber = aiResult.replacement.lessonNumber ? parseInt(aiResult.replacement.lessonNumber, 10) : null;
      parsedAbsence.dayKey = aiResult.replacement.dayKey || null;
    }
  } else {
    // Fallback: регулярки
    const lines = rawText.split(/\n|(?=\[\d{2}:\d{2})/).map(normalizeSpace).filter(Boolean);
    const candidates = lines.length > 1 ? [...lines, rawText] : [rawText];
    for (const chunk of candidates) {
      if (!detections.attendance) detections.attendance = detectAttendance(chunk);
      if (!detections.incident) detections.incident = detectIncident(chunk);
    }
    if (message.senderRole === "director") {
      detections.tasks = detectTasks(rawText, schoolData.teachers, teacherIndex);
    }
    
    // Fallback парсинг отсутствия
    const { parseChatNote } = require("./replacement-engine");
    parsedAbsence = parseChatNote(rawText, teacherIndex);
    // Добавим слово "замен" в fallback если ИИ не отработал
    if (rawText.toLowerCase().includes("замен") || rawText.toLowerCase().includes("воскреснет") || rawText.toLowerCase().includes("умерла")) {
      parsedAbsence.intent = "teacher_absence";
    }
  }

  // Если учитель не найден в тексте — подставляем из отправителя
  if (!parsedAbsence.teacherId && senderId && parsedAbsence.intent === "teacher_absence") {
    parsedAbsence.teacherId = senderId;
  }
  // Если дата не указана явно — используем дату сообщения
  if (!parsedAbsence.dayKey && messageDateKey) {
    parsedAbsence._messageDateKey = messageDateKey;
  }

  const result = {
    messageId,
    attendanceUpdateId: null,
    incidentId: null,
    taskIds: [],
    replacement: null,
    resolvedTeacherId: senderId || null,
    messageDateKey,
    partnership: detections.partnership || null,
  };

  // ── 6. Сохраняем события ───────────────────────────────────────────────────
  if (detections.attendance) {
    result.attendanceUpdateId = await storeAttendance(
      messageId,
      message.senderName,
      message.source || "whatsapp_green_api",
      detections.attendance,
      messageDateKey
    );
    await createOrchestratorEvent(messageId, "attendance_update", {
      ...detections.attendance,
      dateKey: messageDateKey,
    });
  }

  if (detections.incident) {
    result.incidentId = await storeIncident(
      messageId,
      message.senderName,
      message.source || "whatsapp_green_api",
      detections.incident
    );
    await createOrchestratorEvent(messageId, "incident_created", detections.incident);
  }

  if (detections.tasks.length) {
    result.taskIds = await storeTasks(
      messageId,
      message.senderName,
      message.source || "whatsapp_green_api",
      detections.tasks
    );
    await createOrchestratorEvent(messageId, "tasks_created", {
      count: detections.tasks.length,
    });
  }

  if (parsedAbsence.intent === "teacher_absence" && parsedAbsence.teacherId) {
    const recommendations = recommendReplacements(schoolData, parsedAbsence);
    const saved = await saveChatNote({
      rawText,
      parsedNote: parsedAbsence,
      recommendations,
      messageId,
      source: message.source || "whatsapp_green_api",
    });
    result.replacement = {
      noteId: saved.noteId,
      caseIds: saved.caseIds,
      recommendations,
    };
    await createOrchestratorEvent(messageId, "replacement_suggested", {
      recommendationCount: recommendations.length,
      teacherId: parsedAbsence.teacherId,
      dateKey: messageDateKey,
    });
  }

  return {
    messageId,
    parsedAbsence,
    detections,
    result,
  };
}

module.exports = {
  processIncomingMessage,
  detectAttendance,
  detectIncident,
  detectTasks,
};

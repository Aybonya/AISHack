import "server-only";

import path from "node:path";
import { createRequire } from "node:module";

import { generateTaskSummary } from "@/lib/ai/generateTaskSummary";
import { buildSeedState } from "@/lib/seed";
import { buildCafeteriaSummary } from "@/lib/services/cafeteria";
import type {
  AffectedLesson,
  AppState,
  AttendanceReport,
  CafeteriaSummary,
  Chat,
  Incident,
  IncidentStatus,
  Message,
  MessageCardData,
  ParsedIntent,
  ScheduleEntry,
  SubstitutionSuggestion,
  Task,
  TaskStatus,
  User,
} from "@/lib/types";
import { initials, toIsoDate } from "@/lib/utils";

const repoRequire = createRequire(path.join(process.cwd(), "package.json"));

const DAY_TO_WEEKDAY: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

type SnapshotMode = "live" | "demo";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackendEntity = { [key: string]: any };

type RuntimeModules = {
  schoolDataService: {
    loadCollection: (name: string, options?: Record<string, unknown>) => Promise<BackendEntity[]>;
    loadSchoolData: (options?: Record<string, unknown>) => Promise<{
      teachers: BackendEntity[];
      scheduleEntries: BackendEntity[];
      teacherLoad: BackendEntity[];
      rooms: BackendEntity[];
      classes: BackendEntity[];
    }>;
  };
  directorAiService: {
    processIncomingMessage: (input: {
      message: Record<string, unknown>;
      schoolData: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  chatNoteService: {
    confirmReplacement: (input: {
      caseId: string;
      candidateTeacherId?: string | null;
      approvedBy?: string | null;
    }) => Promise<unknown>;
  };
  managementService: {
    createDirectorTask: (input: Record<string, unknown>) => Promise<unknown>;
    updateDirectorTaskStatus: (input: Record<string, unknown>) => Promise<unknown>;
    updateIncidentCardStatus: (input: Record<string, unknown>) => Promise<unknown>;
  };
  utils: {
    toId: (value: string) => string;
  };
};

export interface LiveSnapshot {
  mode: SnapshotMode;
  state: AppState;
  error?: string | null;
}

function requireFromRepo<T>(relativePath: string): T {
  return repoRequire(path.join(/* turbopackIgnore: true */ process.cwd(), relativePath)) as T;
}

function tryLoadRuntime(): { runtime: RuntimeModules | null; error: string | null } {
  try {
    return {
      runtime: {
        schoolDataService: requireFromRepo("GreenAPI/AISHack/src/services/school-data-service.js"),
        directorAiService: requireFromRepo("GreenAPI/AISHack/src/services/director-ai-service.js"),
        chatNoteService: requireFromRepo("GreenAPI/AISHack/src/services/chat-note-service.js"),
        managementService: requireFromRepo("GreenAPI/AISHack/src/services/management-service.js"),
        utils: requireFromRepo("GreenAPI/AISHack/src/utils.js"),
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backend loading error";
    return { runtime: null, error: message };
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function asString(value: unknown, fallback = "") {
  const text = normalizeText(value);
  return text || fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => asString(item)).filter(Boolean) : [];
}

function toIsoTimestamp(value: unknown, fallback = new Date().toISOString()) {
  if (!value) {
    return fallback;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && value !== null) {
    if ("toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
      const date = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
    }

    if ("seconds" in value && typeof (value as { seconds?: unknown }).seconds === "number") {
      return new Date((value as { seconds: number }).seconds * 1000).toISOString();
    }

    if ("_seconds" in value && typeof (value as { _seconds?: unknown })._seconds === "number") {
      return new Date((value as { _seconds: number })._seconds * 1000).toISOString();
    }
  }

  return fallback;
}

function dayKeyToWeekday(dayKey: unknown) {
  return DAY_TO_WEEKDAY[String(dayKey ?? "").toLowerCase()] ?? 1;
}

function dateFromDayKey(dayKey: unknown) {
  const targetWeekday = dayKeyToWeekday(dayKey);
  const now = new Date();
  const currentWeekday = now.getDay() === 0 ? 7 : now.getDay();
  const offset = targetWeekday >= currentWeekday ? targetWeekday - currentWeekday : 7 - (currentWeekday - targetWeekday);
  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + offset);
  return toIsoDate(nextDate);
}

function taskStatusFromBackend(value: unknown): TaskStatus {
  if (value === "done") {
    return "done";
  }

  if (value === "in_progress") {
    return "in_progress";
  }

  return "new";
}

function incidentStatusFromBackend(value: unknown): IncidentStatus {
  if (value === "resolved" || value === "closed") {
    return "resolved";
  }

  if (value === "in_progress") {
    return "in_progress";
  }

  return "new";
}

function buildFallbackUserId(name: string, runtime: RuntimeModules) {
  const slug = runtime.utils.toId(name);
  return slug ? `user_${slug}` : `user_${Date.now()}`;
}

function ensureUser(
  users: Map<string, User>,
  runtime: RuntimeModules,
  input: {
    id?: string | null;
    name: string;
    role?: User["role"];
    chatId?: string;
    subjects?: string[];
    qualifications?: string[];
  },
) {
  const name = normalizeText(input.name) || "Сотрудник";
  const id = normalizeText(input.id) || buildFallbackUserId(name, runtime);
  const existing = users.get(id);

  if (existing) {
    users.set(id, {
      ...existing,
      name: existing.name || name,
      role: existing.role || input.role || "teacher",
      subjects: existing.subjects.length ? existing.subjects : input.subjects ?? [],
      qualifications: existing.qualifications.length
        ? existing.qualifications
        : input.qualifications ?? [],
      chatId: existing.chatId || input.chatId || "chat-general",
    });
    return id;
  }

  users.set(id, {
    id,
    name,
    role: input.role ?? "teacher",
    avatar: initials(name),
    subjects: input.subjects ?? [],
    qualifications: input.qualifications ?? [],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: input.chatId ?? "chat-general",
  });

  return id;
}

function resolveTaskDueDate(task: BackendEntity) {
  const createdAt = new Date(toIsoTimestamp(task.createdAt));
  const explicit = task.dueAt ?? task.dueDate ?? null;
  if (explicit) {
    return toIsoTimestamp(explicit, createdAt.toISOString());
  }

  const hint = String(task.dueHint ?? "").toLowerCase();
  const dueDate = new Date(createdAt);

  if (hint === "tomorrow") {
    dueDate.setDate(dueDate.getDate() + 1);
    dueDate.setHours(12, 0, 0, 0);
    return dueDate.toISOString();
  }

  if (hint === "before_friday") {
    const weekday = dueDate.getDay() === 0 ? 7 : dueDate.getDay();
    const delta = weekday <= 5 ? 5 - weekday : 5;
    dueDate.setDate(dueDate.getDate() + delta);
    dueDate.setHours(17, 0, 0, 0);
    return dueDate.toISOString();
  }

  if (hint === "next_week") {
    dueDate.setDate(dueDate.getDate() + 7);
    dueDate.setHours(10, 0, 0, 0);
    return dueDate.toISOString();
  }

  if (hint === "today" || hint === "scheduled") {
    dueDate.setHours(17, 0, 0, 0);
    return dueDate.toISOString();
  }

  dueDate.setHours(dueDate.getHours() + 4, 0, 0, 0);
  return dueDate.toISOString();
}

function buildAffectedLesson(entry: ScheduleEntry | undefined, rawCase: BackendEntity): AffectedLesson[] {
  if (entry) {
    return [
      {
        scheduleEntryId: entry.id,
        className: entry.className,
        subject: entry.subject,
        room: entry.room,
        lessonNumber: entry.lessonNumber,
        startTime: entry.startTime,
        endTime: entry.endTime,
      },
    ];
  }

  return [
    {
      scheduleEntryId: String(rawCase.entryId ?? rawCase.id),
      className: String(rawCase.classId ?? "—"),
      subject: String(rawCase.subjectName ?? "Урок"),
      room: "—",
      lessonNumber: Number(rawCase.lessonNumber ?? 0),
      startTime: "08:00",
      endTime: "08:45",
    },
  ];
}

function inferChatId(params: {
  attendance: AttendanceReport[];
  incidents: Incident[];
  tasks: Task[];
  suggestions: SubstitutionSuggestion[];
}, isOfficialTeacher: boolean, isPartnership: boolean) {
  // Неизвестные номера идут в Личные, если только это не важное обращение (партнерство)
  if (!isOfficialTeacher && !isPartnership) {
    return "chat-personal";
  }

  // Если это важная инфа/партнерство от неизвестного (или известного) — кидаем в общий чат, чтобы директор увидел
  if (isPartnership) {
    return "chat-personal"; // Оставляем в личных, но пометим интентом, чтобы фильтр "Важно" подхватил
  }

  if (params.incidents.length > 0) {
    return "chat-facilities"; // 4 группа (завхоз)
  }

  if (params.attendance.length > 0) {
    return "chat-cafeteria"; // 3 группа (столовая)
  }

  if (params.tasks.length > 0) {
    return "chat-curators"; // 1 группа (кураторы)
  }

  if (params.suggestions.length > 0) {
    return "chat-general"; // 2 группа (учителя - расписание/замены)
  }

  // По умолчанию все школьные вопросы в общий чат учителей
  return "chat-general";
}

function buildAttendanceCard(
  messageId: string,
  chatId: string,
  createdAt: string,
  attendance: AttendanceReport,
  summaryState: CafeteriaSummary | undefined,
): Message {
  const summary = summaryState ?? {
    id: `cafeteria-${attendance.date}`,
    date: attendance.date,
    totalMeals: attendance.presentCount,
    totalAbsent: attendance.absentCount,
    reportedClasses: [attendance.className],
    missingClasses: [],
  };

  return {
    id: `${messageId}-ai-attendance`,
    chatId,
    senderId: "ai-assistant",
    senderType: "ai",
    text: "Посещаемость сохранена и включена в сводку питания.",
    createdAt,
    kind: "parsed_card",
    parsedIntent: "attendance",
    metadata: {
      cardType: "attendance",
      title: `Питание: ${attendance.className}`,
      summary: `${attendance.presentCount} на питании, отсутствуют ${attendance.absentCount}.`,
      report: attendance,
      summaryState: summary,
    } satisfies MessageCardData,
  };
}

function buildIncidentCard(
  messageId: string,
  chatId: string,
  createdAt: string,
  incident: Incident,
): Message {
  return {
    id: `${messageId}-ai-incident`,
    chatId,
    senderId: "ai-assistant",
    senderType: "ai",
    text: "Инцидент зарегистрирован и передан в работу.",
    createdAt,
    kind: "parsed_card",
    parsedIntent: "incident",
    metadata: {
      cardType: "incident",
      title: incident.title,
      summary: incident.description,
      incidentId: incident.id,
      location: incident.location,
      priority: incident.priority,
    } satisfies MessageCardData,
  };
}

function buildTaskCard(
  messageId: string,
  chatId: string,
  createdAt: string,
  tasks: Task[],
  users: User[],
): Message {
  return {
    id: `${messageId}-ai-task`,
    chatId,
    senderId: "ai-assistant",
    senderType: "ai",
    text: generateTaskSummary(tasks, users),
    createdAt,
    kind: "parsed_card",
    parsedIntent: "task",
    metadata: {
      cardType: "task",
      title: `${tasks.length} ${tasks.length === 1 ? "задача назначена" : "задачи назначены"}`,
      summary: generateTaskSummary(tasks, users),
      taskIds: tasks.map((task) => task.id),
    } satisfies MessageCardData,
  };
}

function buildSuggestionCard(
  messageId: string,
  chatId: string,
  createdAt: string,
  suggestion: SubstitutionSuggestion,
): Message {
  return {
    id: `${messageId}-ai-substitution`,
    chatId,
    senderId: "ai-assistant",
    senderType: "ai",
    text: suggestion.explanation,
    createdAt,
    kind: "parsed_card",
    parsedIntent: "substitution",
    metadata: {
      cardType: "substitution",
      title: suggestion.status === "confirmed" ? "Замена подтверждена" : "Предлагаю замену",
      summary: suggestion.explanation,
      suggestionId: suggestion.id,
      candidateUserId: suggestion.candidateUserId,
      affectedLessons: suggestion.affectedLessons,
      confirmed: suggestion.status === "confirmed",
    } satisfies MessageCardData,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildGenericAiMessage(messageId: string, chatId: string, createdAt: string): Message {
  return {
    id: `${messageId}-ai-generic`,
    chatId,
    senderId: "ai-assistant",
    senderType: "ai",
    text: "Сообщение сохранено. AISana продолжает следить за контекстом чата.",
    createdAt,
    kind: "text",
    parsedIntent: "generic",
  };
}

const PINNED_CHAT_TEMPLATES: Array<Pick<Chat, "id" | "title" | "type" | "avatar" | "pinned">> = [
  { id: "chat-curators", title: "Кураторы и Директор",  type: "department", avatar: "КД", pinned: true },
  { id: "chat-general",   title: "Учителя и Директор",  type: "group",      avatar: "УД", pinned: true },
  { id: "chat-cafeteria", title: "Столовая и Директор", type: "service",    avatar: "СД", pinned: true },
  { id: "chat-facilities",title: "Завхоз и Директор",  type: "service",    avatar: "ЗД", pinned: true },
];

function buildChats(messages: Message[], participants: string[], seed: AppState): Chat[] {
  const chats: Chat[] = [];

  // —— 1. Закреплённые системные группы сверху ———————————————————
  PINNED_CHAT_TEMPLATES.forEach((template) => {
    const chatMessages = messages.filter((m) => m.chatId === template.id);
    const lastMessageId = chatMessages.at(-1)?.id ?? "";
    const hasImportant = chatMessages.some(
      (m) => m.parsedIntent === "partnership" || m.parsedIntent === "incident"
    );
    const fallbackUnread = seed.chats.find((c) => c.id === template.id)?.unreadCount ?? 0;

    chats.push({
      ...template,
      participants,
      unreadCount: chatMessages.length > 0
        ? Math.min(chatMessages.filter((m) => m.senderType === "teacher").length, 9)
        : fallbackUnread,
      lastMessageId,
      isImportant: hasImportant,
    });
  });

  // —— 2. Индивидуальные чаты для каждого неизвестного номера ———————————
  const personalMessages = messages.filter((m) =>
    !PINNED_CHAT_TEMPLATES.some((t) => t.id === m.chatId)
  );

  // Группируем по chatId (u<phoneNumber>)
  const perPersonChat = new Map<string, Message[]>();
  personalMessages.forEach((m) => {
    const list = perPersonChat.get(m.chatId) ?? [];
    list.push(m);
    perPersonChat.set(m.chatId, list);
  });

  perPersonChat.forEach((msgs, chatId) => {
    const lastMessageId = msgs.at(-1)?.id ?? "";
    const lastMsg = msgs.at(-1);
    const isImportant = msgs.some((m) => m.parsedIntent === "partnership");
    const phone = chatId.replace(/^u-/, "");
    // Получаем имя отправителя из сообщений
    const senderUser = participants.length > 0
      ? null
      : null; // находим через senderId
    const displayName = lastMsg?.text
      ? phone.length > 6 ? `+${phone}` : phone
      : chatId;

    // Имя из первого сообщения senderId
    const senderName = msgs[0]?.senderId ?? displayName;

    const fallbackUnread = seed.chats.find((c) => c.id === chatId)?.unreadCount ?? 0;
    chats.push({
      id: chatId,
      title: senderName,
      type: "direct",
      avatar: senderName.slice(0, 2).toUpperCase(),
      participants,
      unreadCount: Math.min(msgs.filter((m) => m.senderType !== "director" && m.senderType !== "ai").length, 9) || fallbackUnread,
      lastMessageId,
      pinned: false,
      isImportant,
      phoneNumber: phone,
      isUnknown: true,
    });
  });

  return chats;
}

export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const seed = buildSeedState();
  const { runtime, error } = tryLoadRuntime();

  if (!runtime) {
    return {
      mode: "demo",
      state: seed,
      error,
    };
  }

  const [schoolData, rawMessages, rawAttendance, rawIncidents, rawTasks, rawCases, rawAssignments] =
    await Promise.all([
      runtime.schoolDataService.loadSchoolData({ forceRefresh: true }),
      runtime.schoolDataService.loadCollection("chat_messages", { limit: 400, forceRefresh: true }),
      runtime.schoolDataService.loadCollection("attendance_updates", { limit: 400, forceRefresh: true }),
      runtime.schoolDataService.loadCollection("incident_cards", { limit: 400, forceRefresh: true }),
      runtime.schoolDataService.loadCollection("director_tasks", { limit: 400, forceRefresh: true }),
      runtime.schoolDataService.loadCollection("replacement_cases", { limit: 400, forceRefresh: true }),
      runtime.schoolDataService.loadCollection("replacement_assignments", { limit: 400, forceRefresh: true }),
    ]);

  const users = new Map<string, User>();
  seed.users
    .filter((user) => user.role !== "teacher")
    .forEach((user) => {
      users.set(user.id, user);
    });

  schoolData.teachers.forEach((teacher) => {
    const teacherId = asString(teacher.id);
    const teacherName = asString(teacher.shortName || teacher.fullName || teacherId, teacherId);

    users.set(teacherId, {
      id: teacherId,
      name: teacherName,
      role: "teacher",
      avatar: initials(teacherName),
      subjects: asStringArray(teacher.subjectNames),
      qualifications: [...asStringArray(teacher.classIds), ...asStringArray(teacher.baseSubjectIds)],
      isAvailable: teacher.active !== false,
      availabilitySlots: [1, 2, 3, 4, 5, 6],
      chatId: "chat-general",
    });
  });

  const classCatalog = schoolData.classes.map((item) => asString(item.id)).filter(Boolean);
  const assignmentByEntryId = new Map<string, BackendEntity>();
  const assignmentByCaseId = new Map<string, BackendEntity>();
  rawAssignments.forEach((assignment) => {
    const entryId = asString(assignment.entryId);
    const caseId = asString(assignment.caseId);

    if (entryId && !assignmentByEntryId.has(entryId)) {
      assignmentByEntryId.set(entryId, assignment);
    }
    if (caseId && !assignmentByCaseId.has(caseId)) {
      assignmentByCaseId.set(caseId, assignment);
    }

    if (assignment.substituteTeacherId || assignment.substituteTeacherName) {
      ensureUser(users, runtime, {
        id: assignment.substituteTeacherId,
        name: assignment.substituteTeacherName || assignment.substituteTeacherId,
        role: "teacher",
      });
    }
  });

  const scheduleEntries: ScheduleEntry[] = schoolData.scheduleEntries.map((entry) => {
    const teacherIds = asStringArray(entry.teacherIds);
    const teacherNames = asStringArray(entry.teacherNames);
    const _roomIds = asStringArray(entry.roomIds);
    const entryId = asString(entry.id);
    void _roomIds;

    if (teacherIds[0]) {
      ensureUser(users, runtime, {
        id: teacherIds[0],
        name: users.get(teacherIds[0])?.name || teacherNames[0] || teacherIds[0],
        role: "teacher",
      });
    }

    const approvedAssignment = assignmentByEntryId.get(entryId);
    return {
      id: entryId,
      className: asString(entry.classId, "-"),
      subject: entry.baseSubjectName || entry.subjectName || entry.subjectNames?.[0] || "Урок",
      teacherUserId: teacherIds[0] || "ai-assistant",
      room: entry.roomIds?.[0] || entry.rawRoomText || "—",
      weekday: dayKeyToWeekday(entry.dayKey),
      lessonNumber: Number(entry.lessonNumber || 0),
      startTime: entry.timeStart || "08:00",
      endTime: entry.timeEnd || "08:45",
      substituteUserId: approvedAssignment?.substituteTeacherId || undefined,
      substitutionStatus: approvedAssignment ? "confirmed" : undefined,
    };
  });

  const scheduleEntryById = new Map(scheduleEntries.map((entry) => [entry.id, entry]));

  const attendanceReports: AttendanceReport[] = rawAttendance.map((item) => ({
    id: item.id,
    date: item.dateKey || toIsoDate(new Date(toIsoTimestamp(item.createdAt))),
    className: item.classId,
    presentCount: Number(item.presentCount || 0),
    absentCount: Number(item.absentCount || 0),
    sourceMessageId: String(item.messageId || `attendance-${item.id}`),
    confidence: 1,
  }));

  const cafeteriaSummaries = Array.from(new Set(attendanceReports.map((report) => report.date)))
    .sort((left, right) => right.localeCompare(left))
    .map((date) => buildCafeteriaSummary(attendanceReports, classCatalog, date));

  const incidents: Incident[] = rawIncidents.map((item) => ({
    id: item.id,
    title: item.title || "Инцидент",
    description: item.summary || item.description || "Требуется проверка.",
    location: item.roomText || item.location || "Школа",
    priority: item.priority === "high" ? "high" : item.priority === "low" ? "low" : "medium",
    assignedToUserId: item.assigneeId || item.assignedToUserId || "daulet",
    status: incidentStatusFromBackend(item.status),
    sourceMessageId: item.messageId || `incident-${item.id}`,
    createdAt: toIsoTimestamp(item.createdAt),
  }));

  rawTasks.forEach((task) => {
    if (task.assigneeId || task.assigneeName) {
      ensureUser(users, runtime, {
        id: task.assigneeId,
        name: task.assigneeName || users.get(task.assigneeId)?.name || task.assigneeId,
        role: "teacher",
      });
    }
  });

  const tasks: Task[] = rawTasks.map((item) => ({
    id: item.id,
    title: item.title || "Задача",
    description: item.description || "",
    assigneeUserId:
      item.assigneeId ||
      ensureUser(users, runtime, {
        name: item.assigneeName || "Исполнитель",
        role: "teacher",
      }),
    createdBy: "director-janar",
    dueDate: resolveTaskDueDate(item),
    status: taskStatusFromBackend(item.status),
    sourceMessageId: item.messageId || "manual-task",
  }));

  rawCases.forEach((item) => {
    if (item.absentTeacherId) {
      ensureUser(users, runtime, {
        id: item.absentTeacherId,
        name: users.get(item.absentTeacherId)?.name || item.absentTeacherId,
        role: "teacher",
      });
    }

    if (item.candidateTeacherId || item.candidateTeacherName) {
      ensureUser(users, runtime, {
        id: item.candidateTeacherId,
        name: item.candidateTeacherName || item.candidateTeacherId,
        role: "teacher",
      });
    }
  });

  const substitutionSuggestions: SubstitutionSuggestion[] = rawCases.map((item) => {
    const assignment = assignmentByCaseId.get(item.id);
    const entry = scheduleEntryById.get(item.entryId);
    const candidateUserId =
      assignment?.substituteTeacherId ||
      item.candidateTeacherId ||
      ensureUser(users, runtime, {
        name: item.candidateTeacherName || "Кандидат не найден",
        role: "teacher",
      });

    const teacherUserId =
      item.absentTeacherId ||
      entry?.teacherUserId ||
      ensureUser(users, runtime, {
        name: "Учитель",
        role: "teacher",
      });

    const lesson = buildAffectedLesson(entry, item);
    const candidateName = users.get(candidateUserId)?.name ?? item.candidateTeacherName ?? "не найден";
    const subjectName = lesson[0]?.subject ?? item.subjectName ?? "урок";
    const lessonNumber = lesson[0]?.lessonNumber ?? Number(item.lessonNumber ?? 0);
    const className = lesson[0]?.className ?? String(item.classId ?? "класса");

    return {
      id: item.id,
      absenceId: item.chatNoteId || item.id,
      teacherUserId,
      date: dateFromDayKey(item.dayKey),
      affectedLessons: lesson,
      candidateUserId,
      candidateRankings: (Array.isArray(item.candidates) ? (item.candidates as BackendEntity[]) : []).map((candidate) => ({
        userId: String(candidate.teacherId ?? ""),
        score: Number(candidate.score || 0),
        reason: Array.isArray(candidate.reasons) && candidate.reasons.length > 0
          ? candidate.reasons.map((reason) => String(reason)).join(", ")
          : "Рекомендован системой",
      })),
      explanation:
        item.status === "approved"
          ? `Замена для ${className}, ${lessonNumber} урока по предмету "${subjectName}" подтверждена. Исполнитель: ${candidateName}.`
          : item.candidateTeacherId || assignment?.substituteTeacherId
            ? `Для ${className}, ${lessonNumber} урока по предмету "${subjectName}" предлагается ${candidateName}.`
            : `Для ${className}, ${lessonNumber} урока по предмету "${subjectName}" пока нет свободного кандидата.`,
      status: item.status === "approved" ? "confirmed" : "suggested",
    };
  });

  const attendanceByMessageId = new Map<string, AttendanceReport[]>();
  attendanceReports.forEach((report) => {
    const list = attendanceByMessageId.get(report.sourceMessageId) ?? [];
    list.push(report);
    attendanceByMessageId.set(report.sourceMessageId, list);
  });

  const incidentsByMessageId = new Map<string, Incident[]>();
  incidents.forEach((incident) => {
    const list = incidentsByMessageId.get(incident.sourceMessageId) ?? [];
    list.push(incident);
    incidentsByMessageId.set(incident.sourceMessageId, list);
  });

  const tasksByMessageId = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const list = tasksByMessageId.get(task.sourceMessageId) ?? [];
    list.push(task);
    tasksByMessageId.set(task.sourceMessageId, list);
  });

  const suggestionsByMessageId = new Map<string, SubstitutionSuggestion[]>();
  substitutionSuggestions.forEach((suggestion) => {
    const rawCase = rawCases.find((item) => item.id === suggestion.id);
    const key = String(rawCase?.messageId || rawCase?.chatNoteId || "");
    if (!key) {
      return;
    }

    const list = suggestionsByMessageId.get(key) ?? [];
    list.push(suggestion);
    suggestionsByMessageId.set(key, list);
  });

  const summaryByDate = new Map<string, CafeteriaSummary>(
    cafeteriaSummaries.map((summary) => [summary.date, summary]),
  );

  const messages: Message[] = [];
  rawMessages
    .slice()
    .sort((left, right) => toIsoTimestamp(left.createdAt).localeCompare(toIsoTimestamp(right.createdAt)))
    .forEach((item) => {
      const messageId = String(item.id);
      const linkedAttendance = attendanceByMessageId.get(messageId) ?? [];
      const linkedIncidents = incidentsByMessageId.get(messageId) ?? [];
      const linkedTasks = tasksByMessageId.get(messageId) ?? [];
      const linkedSuggestions = suggestionsByMessageId.get(messageId) ?? [];
      const isOfficialTeacher = item.senderRole === "director" || !!item.senderTeacherId;
      // Строим chatId: для известных учителей — системные группы, для неизвестных — персональный чат по номеру
      const rawPhone = String(item.senderPhone || item.sender || "").replace(/[^0-9]/g, "");
      const isPartnership = item.metadata?.partnership != null || item.partnership != null;
      const perPhoneChatId = rawPhone ? `u-${rawPhone}` : `u-${messageId}`;
      const chatId = isOfficialTeacher
        ? inferChatId({
            attendance: linkedAttendance,
            incidents: linkedIncidents,
            tasks: linkedTasks,
            suggestions: linkedSuggestions,
          }, isOfficialTeacher, isPartnership)
        : perPhoneChatId;
      const createdAt = toIsoTimestamp(item.createdAt);
      const senderDisplayName = item.senderName || (rawPhone ? `+${rawPhone}` : "Неизвестный");
      const senderId =
        item.senderRole === "director"
          ? "director-janar"
          : item.senderTeacherId ||
            ensureUser(users, runtime, {
              id: rawPhone ? `u-${rawPhone}` : undefined,
              name: senderDisplayName,
              role: "teacher",
              chatId,
            });

      const parsedIntent: ParsedIntent =
        isPartnership
          ? "partnership"
          : linkedTasks.length > 0
          ? "task"
          : linkedIncidents.length > 0
            ? "incident"
            : linkedSuggestions.length > 0
              ? "substitution"
              : linkedAttendance.length > 0
                ? "attendance"
                : "generic";

      messages.push({
        id: messageId,
        chatId,
        senderId,
        senderType: item.senderRole === "director" ? "director" : "teacher",
        text: item.text || "",
        createdAt,
        kind: "text",
        parsedIntent,
      });

      if (linkedTasks.length > 0) {
        messages.push(buildTaskCard(messageId, chatId, createdAt, linkedTasks, Array.from(users.values())));
        return;
      }

      if (linkedIncidents.length > 0) {
        messages.push(buildIncidentCard(messageId, chatId, createdAt, linkedIncidents[0]));
        return;
      }

      if (linkedSuggestions.length > 0) {
        linkedSuggestions.forEach((suggestion) => {
          messages.push(buildSuggestionCard(`${messageId}-${suggestion.id}`, chatId, createdAt, suggestion));
        });
        return;
      }

      if (linkedAttendance.length > 0) {
        const attendance = linkedAttendance[0];
        messages.push(
          buildAttendanceCard(
            messageId,
            chatId,
            createdAt,
            attendance,
            summaryByDate.get(attendance.date),
          ),
        );
        return;
      }

    });

  const chats = buildChats(messages, Array.from(users.keys()), seed);

  return {
    mode: "live",
    error: null,
    state: {
      ...seed,
      users: Array.from(users.values()),
      chats,
      messages,
      attendanceReports,
      cafeteriaSummaries: cafeteriaSummaries.length > 0 ? cafeteriaSummaries : seed.cafeteriaSummaries,
      incidents,
      tasks,
      teacherAbsences: substitutionSuggestions.map((suggestion) => ({
        id: suggestion.absenceId,
        teacherUserId: suggestion.teacherUserId,
        date: suggestion.date,
        reason: suggestion.explanation,
        sourceMessageId: suggestion.id,
      })),
      scheduleEntries: scheduleEntries.length > 0 ? scheduleEntries : seed.scheduleEntries,
      substitutionSuggestions,
      classCatalog: classCatalog.length > 0 ? classCatalog : seed.classCatalog,
      documentAnswers: [],
    },
  };
}

export async function processLiveMessage(input: {
  chatId: string;
  senderId: string;
  senderType: "teacher" | "director";
  text: string;
  kind?: "text" | "voice";
}) {
  const { runtime, error } = tryLoadRuntime();
  if (!runtime) {
    throw new Error(error || "Live backend is not available");
  }

  const snapshot = await getLiveSnapshot();
  const sender = snapshot.state.users.find((user) => user.id === input.senderId);
  const schoolData = await runtime.schoolDataService.loadSchoolData({ forceRefresh: true });

  await runtime.directorAiService.processIncomingMessage({
    message: {
      text: input.text,
      senderName: sender?.name || input.senderId,
      senderRole: input.senderType === "director" ? "director" : "teacher",
      source: input.kind === "voice" ? "dashboard_voice" : "dashboard_chat",
      chatId: input.chatId,
      externalMessageId: null,
    },
    schoolData,
  });
}

export async function createLiveTask(input: {
  title: string;
  description: string;
  assigneeUserId: string;
  dueDate: string;
}) {
  const { runtime, error } = tryLoadRuntime();
  if (!runtime) {
    throw new Error(error || "Live backend is not available");
  }

  const snapshot = await getLiveSnapshot();
  const assignee = snapshot.state.users.find((user) => user.id === input.assigneeUserId);

  await runtime.managementService.createDirectorTask({
    title: input.title,
    description: input.description,
    assigneeId: input.assigneeUserId,
    assigneeName: assignee?.name || input.assigneeUserId,
    dueAt: input.dueDate,
    createdBy: "director_dashboard",
  });
}

export async function updateLiveTaskStatus(taskId: string, status: TaskStatus) {
  const { runtime, error } = tryLoadRuntime();
  if (!runtime) {
    throw new Error(error || "Live backend is not available");
  }

  await runtime.managementService.updateDirectorTaskStatus({ taskId, status });
}

export async function updateLiveIncidentStatus(incidentId: string, status: IncidentStatus) {
  const { runtime, error } = tryLoadRuntime();
  if (!runtime) {
    throw new Error(error || "Live backend is not available");
  }

  await runtime.managementService.updateIncidentCardStatus({ incidentId, status });
}

export async function confirmLiveSuggestion(caseId: string, candidateTeacherId?: string | null) {
  const { runtime, error } = tryLoadRuntime();
  if (!runtime) {
    throw new Error(error || "Live backend is not available");
  }

  await runtime.chatNoteService.confirmReplacement({
    caseId,
    candidateTeacherId: candidateTeacherId || null,
    approvedBy: "director_dashboard",
  });
}

import type {
  AppState,
  AttendanceReport,
  Chat,
  DocumentChunk,
  Incident,
  Message,
  ScheduleEntry,
  Task,
  TeacherAbsence,
  User,
} from "@/lib/types";
import { createId, getWeekdayIndex, toIsoDate, withTime } from "@/lib/utils";
import { buildCafeteriaSummary } from "@/lib/services/cafeteria";

const today = new Date();
const todayIso = toIsoDate(today);

const classCatalog = ["1А", "2Б", "3В", "4Г", "5А", "5Б", "6А", "7А", "8Б"];

const users: User[] = [
  {
    id: "director-janar",
    name: "Жанар С.",
    role: "director",
    avatar: "ЖС",
    subjects: [],
    qualifications: ["management", "operations"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-general",
  },
  {
    id: "askar",
    name: "Аскар",
    role: "teacher",
    avatar: "А",
    subjects: ["Математика"],
    qualifications: ["5-9 math", "substitution"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5],
    chatId: "chat-general",
  },
  {
    id: "aigerim",
    name: "Айгерим К.",
    role: "teacher",
    avatar: "АК",
    subjects: ["Начальные классы", "Математика"],
    qualifications: ["1-4 primary", "5-6 math"],
    isAvailable: true,
    availabilitySlots: [1, 2, 4, 5, 6],
    chatId: "chat-primary",
  },
  {
    id: "nazken",
    name: "Назкен М.",
    role: "admin",
    avatar: "НМ",
    subjects: [],
    qualifications: ["procurement", "events"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-general",
  },
  {
    id: "daulet",
    name: "Даулет",
    role: "facilities",
    avatar: "Д",
    subjects: [],
    qualifications: ["facilities", "safety"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-facilities",
  },
  {
    id: "aliya",
    name: "Алия",
    role: "teacher",
    avatar: "АЛ",
    subjects: ["Русский язык", "Литература"],
    qualifications: ["5-9 language", "class teacher 3В"],
    isAvailable: true,
    availabilitySlots: [1, 3, 4, 6],
    chatId: "chat-general",
  },
  {
    id: "yerlan",
    name: "Ерлан Б.",
    role: "teacher",
    avatar: "ЕБ",
    subjects: ["Английский язык"],
    qualifications: ["5-11 english"],
    isAvailable: true,
    availabilitySlots: [1, 2, 4, 6],
    chatId: "chat-english",
  },
  {
    id: "saule",
    name: "Сауле Т.",
    role: "teacher",
    avatar: "СТ",
    subjects: ["Казахский язык"],
    qualifications: ["5-11 kazakh"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 5, 6],
    chatId: "chat-general",
  },
  {
    id: "timur",
    name: "Тимур Р.",
    role: "teacher",
    avatar: "ТР",
    subjects: ["История"],
    qualifications: ["5-11 history"],
    isAvailable: true,
    availabilitySlots: [1, 3, 4, 5, 6],
    chatId: "chat-general",
  },
  {
    id: "meruyert",
    name: "Меруерт А.",
    role: "teacher",
    avatar: "МА",
    subjects: ["Биология"],
    qualifications: ["5-11 biology", "science club"],
    isAvailable: true,
    availabilitySlots: [2, 3, 5, 6],
    chatId: "chat-general",
  },
  {
    id: "gaukhar",
    name: "Гаухар Н.",
    role: "teacher",
    avatar: "ГН",
    subjects: ["Химия"],
    qualifications: ["7-11 chemistry"],
    isAvailable: true,
    availabilitySlots: [1, 2, 5, 6],
    chatId: "chat-general",
  },
  {
    id: "arman",
    name: "Арман Д.",
    role: "teacher",
    avatar: "АД",
    subjects: ["Физкультура"],
    qualifications: ["1-11 pe"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-general",
  },
  {
    id: "assel",
    name: "Асель П.",
    role: "teacher",
    avatar: "АП",
    subjects: ["Информатика"],
    qualifications: ["5-11 it", "digital"],
    isAvailable: true,
    availabilitySlots: [2, 4, 5, 6],
    chatId: "chat-general",
  },
  {
    id: "aidana",
    name: "Айдана Ж.",
    role: "psychologist",
    avatar: "АЖ",
    subjects: [],
    qualifications: ["psychology", "student support"],
    isAvailable: true,
    availabilitySlots: [2, 3, 4, 5],
    chatId: "chat-general",
  },
  {
    id: "saltanat",
    name: "Салтанат",
    role: "cafeteria",
    avatar: "С",
    subjects: [],
    qualifications: ["cafeteria"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-cafeteria",
  },
  {
    id: "ai-assistant",
    name: "AISana",
    role: "ai",
    avatar: "AI",
    subjects: [],
    qualifications: ["operations orchestration"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-general",
  },
];

const messages: Message[] = [
  {
    id: "msg-welcome",
    chatId: "chat-general",
    senderId: "ai-assistant",
    senderType: "ai",
    text: "AISana собирает посещаемость, задачи, инциденты и предложения по заменам в одном окне.",
    createdAt: withTime(today, "07:28"),
    kind: "text",
    parsedIntent: "generic",
  },
  {
    id: "msg-att-1a",
    chatId: "chat-primary",
    senderId: "aigerim",
    senderType: "teacher",
    text: "1А - 25 детей, 1 болеет",
    createdAt: withTime(today, "07:36"),
    kind: "text",
    parsedIntent: "attendance",
  },
  {
    id: "msg-att-2b",
    chatId: "chat-primary",
    senderId: "aigerim",
    senderType: "teacher",
    text: "2Б - 24 детей, 0 болеют",
    createdAt: withTime(today, "07:39"),
    kind: "text",
    parsedIntent: "attendance",
  },
  {
    id: "msg-att-3v",
    chatId: "chat-general",
    senderId: "aliya",
    senderType: "teacher",
    text: "3В - 28 детей, 1 болеет",
    createdAt: withTime(today, "07:43"),
    kind: "text",
    parsedIntent: "attendance",
  },
  {
    id: "msg-att-5a",
    chatId: "chat-general",
    senderId: "saule",
    senderType: "teacher",
    text: "5А: 26 присутствуют, 2 отсутствуют",
    createdAt: withTime(today, "07:47"),
    kind: "text",
    parsedIntent: "attendance",
  },
  {
    id: "msg-incident",
    chatId: "chat-facilities",
    senderId: "aliya",
    senderType: "teacher",
    text: "В кабинете 12 сломалась парта",
    createdAt: withTime(today, "08:12"),
    kind: "text",
    parsedIntent: "incident",
  },
  {
    id: "msg-incident-ai",
    chatId: "chat-facilities",
    senderId: "ai-assistant",
    senderType: "ai",
    text: "Создала карточку инцидента и поставила Даулета ответственным.",
    createdAt: withTime(today, "08:13"),
    kind: "parsed_card",
    parsedIntent: "incident",
    metadata: {
      cardType: "incident",
      title: "Инцидент зарегистрирован",
      summary: "Парта в кабинете 12 требует ремонта сегодня.",
      incidentId: "incident-desk-12",
      location: "Кабинет 12",
      priority: "medium",
    },
  },
  {
    id: "msg-command",
    chatId: "chat-general",
    senderId: "director-janar",
    senderType: "director",
    text: "Айгерим, подготовь актовый зал. Назкен, закажи воду и бейджи",
    createdAt: withTime(today, "08:26"),
    kind: "text",
    parsedIntent: "task",
  },
  {
    id: "msg-command-ai",
    chatId: "chat-general",
    senderId: "ai-assistant",
    senderType: "ai",
    text: "Разбила поручение на две задачи и назначила ответственных.",
    createdAt: withTime(today, "08:27"),
    kind: "parsed_card",
    parsedIntent: "task",
    metadata: {
      cardType: "task",
      title: "2 задачи созданы",
      summary: "Айгерим отвечает за актовый зал, Назкен за воду и бейджи.",
      taskIds: ["task-hall", "task-badges"],
    },
  },
  {
    id: "msg-cafeteria",
    chatId: "chat-cafeteria",
    senderId: "saltanat",
    senderType: "teacher",
    text: "Жду итог по питанию до 09:00.",
    createdAt: withTime(today, "08:33"),
    kind: "text",
    parsedIntent: "generic",
  },
  {
    id: "msg-english",
    chatId: "chat-english",
    senderId: "yerlan",
    senderType: "teacher",
    text: "У 7А перенос контрольной по английскому на завтра.",
    createdAt: withTime(today, "08:41"),
    kind: "text",
    parsedIntent: "generic",
  },
];

const attendanceReports: AttendanceReport[] = [
  {
    id: "attendance-1a",
    date: todayIso,
    className: "1А",
    presentCount: 24,
    absentCount: 1,
    sourceMessageId: "msg-att-1a",
    confidence: 0.97,
  },
  {
    id: "attendance-2b",
    date: todayIso,
    className: "2Б",
    presentCount: 24,
    absentCount: 0,
    sourceMessageId: "msg-att-2b",
    confidence: 0.99,
  },
  {
    id: "attendance-3v",
    date: todayIso,
    className: "3В",
    presentCount: 27,
    absentCount: 1,
    sourceMessageId: "msg-att-3v",
    confidence: 0.95,
  },
  {
    id: "attendance-5a",
    date: todayIso,
    className: "5А",
    presentCount: 26,
    absentCount: 2,
    sourceMessageId: "msg-att-5a",
    confidence: 0.93,
  },
];

const incidents: Incident[] = [
  {
    id: "incident-desk-12",
    title: "Сломалась парта",
    description: "В кабинете 12 требуется ремонт парты до начала 3 урока.",
    location: "Кабинет 12",
    priority: "medium",
    assignedToUserId: "daulet",
    status: "new",
    sourceMessageId: "msg-incident",
    createdAt: withTime(today, "08:12"),
  },
];

const tasks: Task[] = [
  {
    id: "task-hall",
    title: "Подготовить актовый зал",
    description: "Подготовить посадку, проектор и микрофоны к 14:00.",
    assigneeUserId: "aigerim",
    createdBy: "director-janar",
    dueDate: withTime(today, "14:00"),
    status: "in_progress",
    sourceMessageId: "msg-command",
  },
  {
    id: "task-badges",
    title: "Заказать воду и бейджи",
    description: "Согласовать поставку воды и распечатать бейджи для гостей.",
    assigneeUserId: "nazken",
    createdBy: "director-janar",
    dueDate: withTime(today, "13:00"),
    status: "new",
    sourceMessageId: "msg-command",
  },
  {
    id: "task-hall-sound",
    title: "Проверить звук в актовом зале",
    description: "Тест микрофонов перед встречей с родителями.",
    assigneeUserId: "daulet",
    createdBy: "director-janar",
    dueDate: withTime(today, "12:30"),
    status: "done",
    sourceMessageId: "msg-command",
  },
];

const teacherAbsences: TeacherAbsence[] = [];

const documentChunks: DocumentChunk[] = [
  {
    id: "doc-130-1",
    docTitle: "Приказ МОН РК №130",
    sectionTitle: "Ведение документации",
    content:
      "Учитель обязан своевременно фиксировать посещаемость, темы уроков и выставленные оценки в утвержденной форме без пропусков и задним числом.",
    tags: ["документы", "журнал", "посещаемость"],
  },
  {
    id: "doc-130-2",
    docTitle: "Приказ МОН РК №130",
    sectionTitle: "Коммуникация с администрацией",
    content:
      "Если возникают отклонения по посещаемости, инциденты или необходимость переноса занятий, педагог сообщает администрации в день события с кратким описанием и ответственным лицом.",
    tags: ["администрация", "сообщение", "инциденты"],
  },
  {
    id: "doc-sub-1",
    docTitle: "Приказ о замещении уроков",
    sectionTitle: "Кто может замещать",
    content:
      "Замещение урока допускается только педагогом, который имеет соответствующую предметную квалификацию либо подтвержденную возможность вести этот класс по внутреннему приказу директора.",
    tags: ["замена", "уроки", "квалификация"],
  },
  {
    id: "doc-sub-2",
    docTitle: "Приказ о замещении уроков",
    sectionTitle: "Ограничения",
    content:
      "Нельзя ставить замену педагогу, у которого в это же время собственный урок, дежурство или подтвержденное отсутствие. Приоритет отдается свободному учителю по тому же предмету.",
    tags: ["замена", "расписание", "конфликт"],
  },
  {
    id: "doc-att-1",
    docTitle: "Внутренний регламент посещаемости",
    sectionTitle: "Ежедневная сводка",
    content:
      "Классные руководители и учителя начального блока передают число присутствующих и отсутствующих до 08:45, чтобы школа успела сформировать сводку для столовой.",
    tags: ["посещаемость", "столовая", "сводка"],
  },
  {
    id: "doc-att-2",
    docTitle: "Внутренний регламент посещаемости",
    sectionTitle: "Что важно указывать",
    content:
      "В сообщении нужно указать класс, число присутствующих либо общее количество детей и число отсутствующих. Если данные неполные, администрация запрашивает уточнение.",
    tags: ["посещаемость", "формат", "данные"],
  },
];

function buildWeekSchedule(): ScheduleEntry[] {
  const currentWeekday = getWeekdayIndex(todayIso);
  const lessons = [
    ["08:00", "08:45"],
    ["08:55", "09:40"],
    ["09:55", "10:40"],
    ["10:50", "11:35"],
    ["11:45", "12:30"],
    ["12:40", "13:25"],
  ];

  const templates = [
    { className: "5А", subject: "Математика", teacherUserId: "askar", room: "21", lessonNumber: 1 },
    { className: "3В", subject: "Математика", teacherUserId: "askar", room: "22", lessonNumber: 2 },
    { className: "3В", subject: "Русский язык", teacherUserId: "aliya", room: "12", lessonNumber: 3 },
    { className: "1А", subject: "Начальные классы", teacherUserId: "aigerim", room: "5", lessonNumber: 4 },
    { className: "2Б", subject: "Английский", teacherUserId: "yerlan", room: "17", lessonNumber: 5 },
    { className: "5Б", subject: "Английский", teacherUserId: "yerlan", room: "18", lessonNumber: 3 },
    { className: "7А", subject: "История", teacherUserId: "timur", room: "19", lessonNumber: 4 },
    { className: "8Б", subject: "Информатика", teacherUserId: "assel", room: "26", lessonNumber: 5 },
    { className: "6А", subject: "Казахский язык", teacherUserId: "saule", room: "15", lessonNumber: 4 },
    { className: "7А", subject: "Биология", teacherUserId: "meruyert", room: "14", lessonNumber: 5 },
    { className: "8Б", subject: "Химия", teacherUserId: "gaukhar", room: "24", lessonNumber: 6 },
    { className: "5А", subject: "Физкультура", teacherUserId: "arman", room: "Спортзал", lessonNumber: 6 },
  ];

  const entries: ScheduleEntry[] = [];
  const weekdays = Array.from(new Set([1, 2, 3, 4, 5, ...(currentWeekday > 5 ? [currentWeekday] : [])]));

  for (const weekday of weekdays) {
    templates.forEach((template) => {
      const [startTime, endTime] = lessons[template.lessonNumber - 1];
      const isShowcaseSubstitution =
        weekday === 5 &&
        template.className === "3В" &&
        template.subject === "Математика";

      entries.push({
        id: createId(`schedule-${weekday}`),
        className: template.className,
        subject: template.subject,
        teacherUserId: template.teacherUserId,
        room: template.room,
        weekday,
        lessonNumber: template.lessonNumber,
        startTime,
        endTime,
        substituteUserId: isShowcaseSubstitution ? "aigerim" : undefined,
        substitutionStatus: isShowcaseSubstitution ? "confirmed" : undefined,
      });
    });
  }

  return entries;
}
const scheduleEntries = buildWeekSchedule();

const chats: Chat[] = [
  {
    id: "chat-general",
    title: "Общий чат учителей",
    type: "group",
    participants: [
      "director-janar",
      "askar",
      "aigerim",
      "nazken",
      "aliya",
      "saule",
      "timur",
      "ai-assistant",
    ],
    avatar: "ОЧ",
    unreadCount: 3,
    lastMessageId: "msg-command-ai",
  },
  {
    id: "chat-primary",
    title: "Начальные классы",
    type: "department",
    participants: ["aigerim", "director-janar", "ai-assistant"],
    avatar: "НК",
    unreadCount: 1,
    lastMessageId: "msg-att-2b",
  },
  {
    id: "chat-english",
    title: "Английский язык",
    type: "department",
    participants: ["yerlan", "director-janar"],
    avatar: "EN",
    unreadCount: 0,
    lastMessageId: "msg-english",
  },
  {
    id: "chat-facilities",
    title: "Завхоз",
    type: "service",
    participants: ["daulet", "director-janar", "ai-assistant"],
    avatar: "ZH",
    unreadCount: 1,
    lastMessageId: "msg-incident-ai",
  },
  {
    id: "chat-cafeteria",
    title: "Столовая",
    type: "service",
    participants: ["saltanat", "director-janar", "ai-assistant"],
    avatar: "СТ",
    unreadCount: 0,
    lastMessageId: "msg-cafeteria",
  },
];

export function buildSeedState(): AppState {
  const cafeteriaSummary = buildCafeteriaSummary(attendanceReports, classCatalog, todayIso);

  return {
    users,
    chats,
    messages,
    attendanceReports,
    cafeteriaSummaries: [cafeteriaSummary],
    incidents,
    tasks,
    teacherAbsences,
    scheduleEntries,
    documentChunks,
    documentAnswers: [],
    substitutionSuggestions: [],
    classCatalog,
  };
}


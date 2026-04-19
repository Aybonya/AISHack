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
    id: "77086187050@c.us",
    name: "Назкен М.",
    role: "admin",
    avatar: "НМ",
    subjects: [],
    qualifications: ["procurement", "events"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-curators",
  },
  {
    id: "77713364671@c.us",
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
    id: "77479609925@c.us",
    name: "Ақырап А.",
    role: "teacher",
    avatar: "АА",
    subjects: ["English", "IELTS"],
    qualifications: ["Senior English Teacher", "IELTS Examiner"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-english",
  },
  {
    id: "77088908028@c.us",
    name: "Алимбекова У.",
    role: "teacher",
    avatar: "АУ",
    subjects: ["English", "IELTS"],
    qualifications: ["English Teacher", "IELTS Coach"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-english",
  },
  {
    id: "tanatar-m",
    name: "Таңатар М.",
    role: "teacher",
    avatar: "ТМ",
    subjects: ["English", "IELTS"],
    qualifications: ["English Teacher"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-english",
  },
  {
    id: "77786938964@c.us",
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
    id: "77475924170@c.us",
    name: "Арман (Гость)",
    role: "teacher",
    avatar: "АГ",
    subjects: [],
    qualifications: ["external"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-general",
  },
  {
    id: "ai-assistant",
    name: "Ассистент",
    role: "ai",
    avatar: "AI",
    subjects: [],
    qualifications: ["operations orchestration"],
    isAvailable: true,
    availabilitySlots: [1, 2, 3, 4, 5, 6],
    chatId: "chat-aisana",
  },
];

const messages: Message[] = [
  {
    id: "msg-aisana-welcome",
    chatId: "chat-aisana",
    senderId: "ai-assistant",
    senderType: "ai",
    text: "Я AISana. Можешь писать мне как в ChatGPT или отправлять длинные голосовые сообщения, а я превращу их в задачи, сообщения, переходы по разделам и остальные доступные действия внутри системы.",
    createdAt: withTime(today, "00:24"),
    kind: "text",
    parsedIntent: "generic",
  },
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
    assignedToUserId: "77713364671@c.us",
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
    id: "doc-76-1",
    docTitle: "Приказ МОН РК №76",
    sectionTitle: "Организация внутришкольных приказов",
    content:
      "Во внутреннем приказе школы обязательно указываются основание, цель, список ответственных лиц, сроки исполнения и форма итогового контроля со стороны администрации.",
    tags: ["приказ 76", "внутренний приказ", "ответственные", "контроль"],
  },
  {
    id: "doc-76-2",
    docTitle: "Приказ МОН РК №76",
    sectionTitle: "Командирование и поручения",
    content:
      "Если приказ связан с выездом, сопровождением или особым поручением, необходимо зафиксировать даты, маршрут или место проведения, состав участников, ответственного сопровождающего и меры безопасности.",
    tags: ["приказ 76", "выезд", "сопровождение", "безопасность"],
  },
  {
    id: "doc-110-1",
    docTitle: "Приказ МОН РК №110",
    sectionTitle: "Отчетная форма",
    content:
      "Для отчетов по утвержденной форме сначала собираются основание отчета, период, ответственные исполнители, численные показатели и краткий аналитический вывод о результате или проблеме.",
    tags: ["приказ 110", "отчет", "форма", "показатели"],
  },
  {
    id: "doc-110-2",
    docTitle: "Приказ МОН РК №110",
    sectionTitle: "Язык и структура",
    content:
      "Официальный отчет оформляется в деловом стиле: вводная часть, фактические данные, принятые меры, выводы и предложения. При нехватке данных допускается запрос уточнений перед финальной редакцией.",
    tags: ["приказ 110", "деловой стиль", "выводы", "уточнения"],
  },
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
  {
    id: "doc-order-1",
    docTitle: "Шаблон приказа по школе",
    sectionTitle: "Обязательные блоки",
    content:
      "В проекте приказа должны быть шапка организации, дата и номер, заголовок, основание, распорядительная часть с формулировкой 'ПРИКАЗЫВАЮ', список исполнителей, сроки и контроль исполнения.",
    tags: ["шаблон приказа", "приказ", "проект", "распорядительная часть"],
  },
  {
    id: "doc-order-2",
    docTitle: "Шаблон приказа по школе",
    sectionTitle: "Назначение ответственных",
    content:
      "При назначении на особое задание важно прямо указать ФИО, должность, суть поручения, срок исполнения, формат результата и лицо, осуществляющее контроль выполнения.",
    tags: ["назначение", "ответственный", "особое задание", "контроль"],
  },
];

function buildWeekSchedule(): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  days.forEach((day) => {
    // Ольга П. (Russian Department) - Плотное расписание
    entries.push(
      { id: `sch-olga-1-${day}`, teacherId: "77479609925@c.us", subject: "Русский язык", classId: "10A", day, slot: 2, room: "215" },
      { id: `sch-olga-2-${day}`, teacherId: "77479609925@c.us", subject: "Русский язык", classId: "11B", day, slot: 3, room: "215" },
      { id: `sch-olga-3-${day}`, teacherId: "77479609925@c.us", subject: "Литература", classId: "9V", day, slot: 4, room: "215" }
    );

    // Ирина С. (Russian Department) - Свободна на 2 и 3 уроки, занята на 4
    entries.push(
      { id: `sch-irina-1-${day}`, teacherId: "77088908028@c.us", subject: "Русский язык", classId: "5А", day, slot: 1, room: "302" },
      { id: `sch-irina-2-${day}`, teacherId: "77088908028@c.us", subject: "Русский язык", classId: "6Б", day, slot: 4, room: "302" }
    );

    // Алия (Russian Department) - Занята на 2 урок, свободна на 3 и 4
    entries.push(
      { id: `sch-aliya-1-${day}`, teacherId: "aliya", subject: "Литература", classId: "8А", day, slot: 2, room: "305" },
      { id: `sch-aliya-2-${day}`, teacherId: "aliya", subject: "Русский язык", classId: "7Г", day, slot: 5, room: "305" }
    );
  });

  return entries;
}

const scheduleEntries = buildWeekSchedule();

const chats: Chat[] = [
  {
    id: "chat-aisana",
    title: "Ассистент",
    type: "direct",
    participants: ["director-janar", "ai-assistant"],
    avatar: "AI",
    unreadCount: 0,
    lastMessageId: "msg-aisana-welcome",
  },
  {
    id: "chat-general",
    title: "Учителя и Директор",
    type: "group",
    participants: [
      "director-janar",
      "askar",
      "aigerim",
      "77086187050@c.us",
      "aliya",
      "saule",
      "timur",
      "77479609925@c.us",
      "77088908028@c.us",
      "77475924170@c.us",
      "ai-assistant",
    ],
    avatar: "УД",
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
    id: "chat-admin",
    title: "Администрация",
    type: "group",
    participants: ["director-janar", "ai-assistant"],
    avatar: "АД",
    unreadCount: 0,
    lastMessageId: "",
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

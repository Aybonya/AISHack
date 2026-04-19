export type UserRole =
  | "director"
  | "teacher"
  | "admin"
  | "facilities"
  | "cafeteria"
  | "psychologist"
  | "ai";

export type ChatType = "group" | "department" | "service" | "direct";

export type SenderType = "teacher" | "director" | "ai" | "system";

export type MessageKind = "text" | "voice" | "parsed_card" | "system_event";

export type ParsedIntent =
  | "attendance"
  | "incident"
  | "task"
  | "task_update"
  | "substitution"
  | "partnership"
  | "generic";

export type IncidentPriority = "low" | "medium" | "high";

export type IncidentStatus = "new" | "in_progress" | "resolved";

export type TaskStatus = "new" | "in_progress" | "done";

export type SubstitutionStatus = "suggested" | "confirmed";

export type MessageCardType =
  | "attendance"
  | "incident"
  | "task"
  | "substitution"
  | "document"
  | "cafeteria"
  | "generic";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  subjects: string[];
  qualifications: string[];
  isAvailable: boolean;
  availabilitySlots: number[];
  chatId: string;
}

export interface Chat {
  id: string;
  title: string;
  type: ChatType;
  participants: string[];
  avatar: string;
  unreadCount: number;
  lastMessageId: string;
  pinned?: boolean;
  isImportant?: boolean;
  phoneNumber?: string;
  isUnknown?: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  chatName?: string;
  senderId: string;
  senderType: SenderType;
  text: string;
  createdAt: string;
  kind: MessageKind;
  parsedIntent?: ParsedIntent;
  metadata?: MessageCardData | Record<string, unknown>;
}

export interface AttendanceReport {
  id: string;
  date: string;
  className: string;
  presentCount: number;
  absentCount: number;
  sourceMessageId: string;
  confidence: number;
}

export interface CafeteriaSummary {
  id: string;
  date: string;
  totalMeals: number;
  totalAbsent: number;
  reportedClasses: string[];
  missingClasses: string[];
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  location: string;
  priority: IncidentPriority;
  assignedToUserId: string;
  status: IncidentStatus;
  sourceMessageId: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeUserId: string;
  createdBy: string;
  dueDate: string;
  status: TaskStatus;
  sourceMessageId: string;
}

export interface TeacherAbsence {
  id: string;
  teacherUserId: string;
  date: string;
  reason: string;
  sourceMessageId: string;
}

export interface ScheduleEntry {
  id: string;
  entryType?: "lesson" | "event";
  date?: string;
  className: string;
  subject: string;
  teacherUserId: string;
  room: string;
  weekday: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  substituteUserId?: string;
  substitutionStatus?: SubstitutionStatus;
  notes?: string;
  createdBy?: string;
}

export interface DocumentChunk {
  id: string;
  docTitle: string;
  sectionTitle: string;
  content: string;
  tags: string[];
}

export interface CandidateScore {
  userId: string;
  score: number;
  reason: string;
}

export interface AffectedLesson {
  scheduleEntryId: string;
  className: string;
  subject: string;
  room: string;
  lessonNumber: number;
  startTime: string;
  endTime: string;
}

export interface SubstitutionSuggestion {
  id: string;
  absenceId: string;
  teacherUserId: string;
  date: string;
  affectedLessons: AffectedLesson[];
  candidateUserId: string;
  candidateRankings: CandidateScore[];
  explanation: string;
  status: SubstitutionStatus;
}

export interface DocumentAnswer {
  id: string;
  query: string;
  docTitle: string;
  bullets: string[];
  relevantChunkIds: string[];
  createdAt: string;
  source?: "explain" | "workspace";
  summary?: string;
  fileName?: string;
  originalText?: string;
}

export interface AttendanceExtraction {
  className: string;
  presentCount: number;
  absentCount: number;
  totalMeals: number;
  confidence: number;
}

export interface IncidentExtraction {
  type: string;
  location: string;
  description: string;
  priority: IncidentPriority;
  responsibleRole: UserRole;
  status: IncidentStatus;
}

export interface ParsedTaskDraft {
  assignee: string;
  title: string;
  description: string;
  dueDate: string;
}

export interface AbsenceExtraction {
  teacherName: string;
  teacherUserId?: string;
  date: string;
  reason: string;
  subject?: string;
}

export interface BaseMessageCard {
  cardType: MessageCardType;
  title: string;
  summary: string;
}

export interface AttendanceCardData extends BaseMessageCard {
  cardType: "attendance";
  report: AttendanceReport;
  summaryState: CafeteriaSummary;
}

export interface IncidentCardData extends BaseMessageCard {
  cardType: "incident";
  incidentId: string;
  location: string;
  priority: IncidentPriority;
}

export interface TaskCardData extends BaseMessageCard {
  cardType: "task";
  taskIds: string[];
}

export interface SubstitutionCardData extends BaseMessageCard {
  cardType: "substitution";
  suggestionId: string;
  candidateUserId: string;
  affectedLessons: AffectedLesson[];
  confirmed: boolean;
}

export interface DocumentCardData extends BaseMessageCard {
  cardType: "document";
  answerId: string;
  bullets: string[];
  docTitle: string;
}

export interface CafeteriaCardData extends BaseMessageCard {
  cardType: "cafeteria";
  summaryState: CafeteriaSummary;
}

export interface GenericCardData extends BaseMessageCard {
  cardType: "generic";
}

export type MessageCardData =
  | AttendanceCardData
  | IncidentCardData
  | TaskCardData
  | SubstitutionCardData
  | DocumentCardData
  | CafeteriaCardData
  | GenericCardData;

export interface AppState {
  users: User[];
  chats: Chat[];
  messages: Message[];
  attendanceReports: AttendanceReport[];
  cafeteriaSummaries: CafeteriaSummary[];
  incidents: Incident[];
  tasks: Task[];
  teacherAbsences: TeacherAbsence[];
  scheduleEntries: ScheduleEntry[];
  documentChunks: DocumentChunk[];
  documentAnswers: DocumentAnswer[];
  substitutionSuggestions: SubstitutionSuggestion[];
  classCatalog: string[];
}

export interface SendMessageInput {
  chatId: string;
  senderId: string;
  senderType: SenderType;
  text: string;
  kind?: MessageKind;
  metadata?: Message["metadata"];
}

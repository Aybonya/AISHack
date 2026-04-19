"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { explainDocument } from "@/lib/ai/explainDocument";
import { buildSeedState } from "@/lib/seed";
import { retrieveRelevantChunks } from "@/lib/services/documents";
import { buildCafeteriaSummary, upsertCafeteriaSummary } from "@/lib/services/cafeteria";
import { processChatMessage } from "@/lib/services/chatPipeline";
import { confirmSubstitution } from "@/lib/services/substitution";
import type { AssistantChatPlan, AssistantCommandPlan } from "@/lib/assistant/command-types";
import type { AssistantWorkspaceDocument } from "@/lib/assistant/command-types";
import type {
  AppState,
  DocumentAnswer,
  IncidentStatus,
  Message,
  ScheduleEntry,
  SendMessageInput,
  Task,
  TaskStatus,
} from "@/lib/types";
import { createId, normalizeText, toIsoDate } from "@/lib/utils";

interface AppContextValue {
  state: AppState;
  hydrated: boolean;
  backendMode: "demo" | "live";
  backendError: string | null;
  sendMessage: (input: SendMessageInput) => void;
  markChatRead: (chatId: string) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  createTask: (input: {
    title: string;
    description: string;
    assigneeUserId: string;
    dueDate: string;
  }) => void;
  createScheduleEvent: (input: {
    title: string;
    description?: string;
    eventDate: string;
    startTime: string;
    endTime: string;
    room?: string;
  }) => void;
  updateIncidentStatus: (incidentId: string, status: IncidentStatus) => void;
  confirmSuggestion: (suggestionId: string, chatId?: string) => void;
  sendCafeteriaSummary: () => void;
  askDocument: (query: string) => DocumentAnswer;
  saveWorkspaceToHistory: (workspace: AssistantWorkspaceDocument) => DocumentAnswer;
  uploadDocumentFile: (fileName: string, content: string) => void;
  deleteDocumentFile: (docTitle: string) => void;
  deleteDocumentHistoryEntry: (id: string) => void;
  runAISanaConversation: (input: {
    chatId: string;
    text: string;
    kind?: "text" | "voice";
    bureaucraticMode?: boolean;
  }) => Promise<{ reply: string; navigateTo: string | null; needsClarification: boolean }>;
  resetDemo: () => void;
  clearScheduleEvents: () => void;
}

type RemoteSnapshot = {
  mode: "demo" | "live";
  state: AppState;
  error?: string | null;
};

const AppStateContext = createContext<AppContextValue | null>(null);
const LIVE_SYNC_INTERVAL_MS = 15_000;
const LOCAL_STATE_STORAGE_KEY = "aisana-app-state-v1";
const AISANA_CHAT_ID = "chat-aisana";
const AISANA_USER_ID = "ai-assistant";
const seedState = buildSeedState();
const seedAISanaChat = seedState.chats.find((chat) => chat.id === AISANA_CHAT_ID);
const seedAISanaMessages = seedState.messages.filter((message) => message.chatId === AISANA_CHAT_ID);
const seedAISanaUser = seedState.users.find((user) => user.id === AISANA_USER_ID);

function buildEmptyState(): AppState {
  return {
    users: [],
    chats: [],
    messages: [],
    attendanceReports: [],
    cafeteriaSummaries: [],
    incidents: [],
    tasks: [],
    teacherAbsences: [],
    scheduleEntries: [],
    documentChunks: [],
    documentAnswers: [],
    substitutionSuggestions: [],
    classCatalog: [],
  };
}

function appendMessages(state: AppState, chatId: string, newMessages: Message[]) {
  const lastMessageId =
    newMessages[newMessages.length - 1]?.id ??
    state.chats.find((chat) => chat.id === chatId)?.lastMessageId ??
    "";

  return {
    ...state,
    messages: [...state.messages, ...newMessages],
    chats: state.chats.map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            lastMessageId,
          }
        : chat,
    ),
  };
}

function loadPersistedState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedState = window.localStorage.getItem(LOCAL_STATE_STORAGE_KEY);

    if (!storedState) {
      return null;
    }

    return ensureAISanaState(JSON.parse(storedState) as AppState);
  } catch {
    return null;
  }
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]) {
  const merged = new Map<string, T>();

  for (const item of secondary) {
    merged.set(item.id, item);
  }

  for (const item of primary) {
    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

function sortMessages(messages: Message[]) {
  return [...messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function buildPlainMessage(input: SendMessageInput): Message {
  return {
    id: createId("msg"),
    chatId: input.chatId,
    senderId: input.senderId,
    senderType: input.senderType,
    text: input.text.trim(),
    createdAt: new Date().toISOString(),
    kind: input.kind ?? "text",
    parsedIntent: "generic",
    metadata: input.metadata,
  };
}

function ensureAISanaState(state: AppState, previousState?: AppState) {
  if (!seedAISanaChat || !seedAISanaUser) {
    return state;
  }

  const hasAISanaUser = state.users.some((user) => user.id === AISANA_USER_ID);
  const users = hasAISanaUser ? state.users : [...state.users, seedAISanaUser];

  const currentAISanaMessages = state.messages.filter((message) => message.chatId === AISANA_CHAT_ID);
  const previousAISanaMessages = previousState?.messages.filter((message) => message.chatId === AISANA_CHAT_ID) ?? [];
  const aisanaMessages =
    currentAISanaMessages.length > 0
      ? currentAISanaMessages
      : previousAISanaMessages.length > 0
        ? previousAISanaMessages
        : seedAISanaMessages;

  const messages = [
    ...state.messages.filter((message) => message.chatId !== AISANA_CHAT_ID),
    ...aisanaMessages,
  ];

  const lastMessageId = aisanaMessages[aisanaMessages.length - 1]?.id ?? seedAISanaChat.lastMessageId;

  const chats = state.chats.some((chat) => chat.id === AISANA_CHAT_ID)
    ? state.chats.map((chat) =>
        chat.id === AISANA_CHAT_ID
          ? {
              ...chat,
              lastMessageId,
            }
          : chat,
      )
    : [{ ...seedAISanaChat, lastMessageId }, ...state.chats];

  return {
    ...state,
    users,
    chats,
    messages,
  };
}

function summarizeStateForAssistant(state: AppState) {
  return {
    users: state.users.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      subjects: user.subjects,
      isAvailable: user.isAvailable,
      chatId: user.chatId,
    })),
    chats: state.chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      type: chat.type,
    })),
    tasks: state.tasks.slice(0, 40).map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      assigneeUserId: task.assigneeUserId,
      dueDate: task.dueDate,
      status: task.status,
    })),
    incidents: state.incidents.slice(0, 40).map((incident) => ({
      id: incident.id,
      title: incident.title,
      description: incident.description,
      location: incident.location,
      priority: incident.priority,
      status: incident.status,
    })),
    substitutionSuggestions: state.substitutionSuggestions.slice(0, 20).map((suggestion) => ({
      id: suggestion.id,
      candidateUserId: suggestion.candidateUserId,
      status: suggestion.status,
      explanation: suggestion.explanation,
    })),
    documents: Array.from(new Set(state.documentChunks.map((chunk) => chunk.docTitle))).slice(0, 20),
    scheduleEntries: state.scheduleEntries.slice(0, 40).map((entry) => ({
      id: entry.id,
      entryType: entry.entryType ?? "lesson",
      date: entry.date ?? null,
      className: entry.className,
      subject: entry.subject,
      teacherUserId: entry.teacherUserId,
      room: entry.room,
      weekday: entry.weekday,
      lessonNumber: entry.lessonNumber,
      startTime: entry.startTime,
      endTime: entry.endTime,
      notes: entry.notes ?? null,
    })),
  };
}

function extractPlainTextFromHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildWorkspaceBullets(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Новый документ";
}

function buildDocumentChunksFromUpload(fileName: string, content: string) {
  const docTitle = titleFromFileName(fileName);
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const sections = normalized
    .split(/\n\s*\n+/)
    .map((section) => section.trim())
    .filter(Boolean);

  const baseSections = (sections.length > 0 ? sections : [normalized]).slice(0, 12);

  return baseSections.map((section, index) => ({
    id: createId("doc-upload"),
    docTitle,
    sectionTitle: `Раздел ${index + 1}`,
    content: section,
    tags: [normalizeText(docTitle)],
  }));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(buildEmptyState);
  const [hydrated, setHydrated] = useState(false);
  const [backendMode, setBackendMode] = useState<"demo" | "live">("demo");
  const [backendError, setBackendError] = useState<string | null>(null);
  const readChatIdsRef = useRef(new Set<string>());

  function mergeSnapshot(snapshot: RemoteSnapshot, currentState: AppState) {
    const mergedState = ensureAISanaState(
      {
        ...snapshot.state,
        // Live backend is the source of truth for operational data.
        users: snapshot.state.users,
        chats: snapshot.state.chats,
        messages: sortMessages(snapshot.state.messages),
        attendanceReports: snapshot.state.attendanceReports,
        cafeteriaSummaries: snapshot.state.cafeteriaSummaries,
        incidents: snapshot.state.incidents,
        tasks: snapshot.state.tasks,
        teacherAbsences: snapshot.state.teacherAbsences,
        scheduleEntries: snapshot.state.scheduleEntries,
        documentChunks: mergeById(snapshot.state.documentChunks, currentState.documentChunks),
        documentAnswers: mergeById(snapshot.state.documentAnswers, currentState.documentAnswers),
        substitutionSuggestions: snapshot.state.substitutionSuggestions,
        classCatalog: snapshot.state.classCatalog,
      },
      currentState,
    );

    return {
      ...mergedState,
      chats: mergedState.chats.map((chat) =>
        readChatIdsRef.current.has(chat.id)
          ? {
              ...chat,
              unreadCount: 0,
            }
          : chat,
      ),
    };
  }

  function applySnapshot(snapshot: RemoteSnapshot) {
    setHydrated(true);
    setBackendMode(snapshot.mode);
    setBackendError(snapshot.error ?? null);
    setState((current) => mergeSnapshot(snapshot, current));
  }

  async function fetchSnapshot() {
    const response = await fetch("/api/live/state", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`State sync failed with ${response.status}`);
    }

    return (await response.json()) as RemoteSnapshot;
  }

  async function mutateSnapshot(url: string, init: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Mutation failed with ${response.status}`);
    }

    return (await response.json()) as RemoteSnapshot;
  }

  function fallbackToLocal(error: unknown, updater: (current: AppState) => AppState) {
    setHydrated(true);
    setBackendMode("demo");
    setBackendError(error instanceof Error ? error.message : "Live backend is unavailable");
    setState((current) => updater(current));
  }

  useEffect(() => {
    const persistedState = loadPersistedState();
    let restoreTimeoutId: number | null = null;

    if (persistedState) {
      // We intentionally restore persisted client state after mount to avoid SSR/client markup mismatch.
      restoreTimeoutId = window.setTimeout(() => {
        setState(persistedState);
        setHydrated(true);
      }, 0);
    }

    let active = true;

    async function sync() {
      try {
        const snapshot = await fetchSnapshot();
        if (!active) {
          return;
        }
        applySnapshot(snapshot);
      } catch (error) {
        if (!active) {
          return;
        }
        setHydrated(true);
        setBackendMode("demo");
        setBackendError(error instanceof Error ? error.message : "Live sync failed");
      }
    }

    void sync();
    const intervalId = window.setInterval(() => {
      void sync();
    }, LIVE_SYNC_INTERVAL_MS);

    return () => {
      active = false;
      if (restoreTimeoutId !== null) {
        window.clearTimeout(restoreTimeoutId);
      }
      window.clearInterval(intervalId);
    };
  // The sync lifecycle intentionally mounts once; state setters are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    try {
      window.localStorage.setItem(LOCAL_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore persistence failures in private mode / storage-restricted browsers.
    }
  }, [hydrated, state]);

  function sendMessage(input: SendMessageInput) {
    if (!hydrated) {
      return;
    }

    const plainMessage = buildPlainMessage(input);
    const shouldAppendLocally =
      input.chatId === AISANA_CHAT_ID || input.senderType === "ai" || input.senderType === "system";

    if (shouldAppendLocally) {
      setState((current) => appendMessages(current, input.chatId, [plainMessage]));
      return;
    }

    if (backendMode === "live") {
      void mutateSnapshot("/api/live/messages", {
        method: "POST",
        body: JSON.stringify(input),
      })
        .then(applySnapshot)
        .catch((error) => fallbackToLocal(error, (current) => processChatMessage(current, input)));
      return;
    }

    setState((current) => processChatMessage(current, input));
  }

  function markChatRead(chatId: string) {
    readChatIdsRef.current.add(chatId);
    setState((current) => ({
      ...current,
      chats: current.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              unreadCount: 0,
            }
          : chat,
      ),
    }));
  }

  function updateTaskStatus(taskId: string, status: TaskStatus) {
    if (!hydrated) {
      return;
    }

    if (backendMode === "live") {
      void mutateSnapshot(`/api/live/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
        .then(applySnapshot)
        .catch((error) =>
          fallbackToLocal(error, (current) => ({
            ...current,
            tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
          })),
        );
      return;
    }

    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
    }));
  }

  function createTask(input: {
    title: string;
    description: string;
    assigneeUserId: string;
    dueDate: string;
  }) {
    if (!hydrated) {
      return;
    }

    if (backendMode === "live") {
      void mutateSnapshot("/api/live/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      })
        .then(applySnapshot)
        .catch((error) =>
          fallbackToLocal(error, (current) => {
            const newTask: Task = {
              id: createId("task"),
              title: input.title,
              description: input.description,
              assigneeUserId: input.assigneeUserId,
              createdBy: "director-janar",
              dueDate: input.dueDate,
              status: "new",
              sourceMessageId: "manual-task",
            };

            return {
              ...current,
              tasks: [newTask, ...current.tasks],
            };
          }),
        );
      return;
    }

    setState((current) => {
      const newTask: Task = {
        id: createId("task"),
        title: input.title,
        description: input.description,
        assigneeUserId: input.assigneeUserId,
        createdBy: "director-janar",
        dueDate: input.dueDate,
        status: "new",
        sourceMessageId: "manual-task",
      };

      return {
        ...current,
        tasks: [newTask, ...current.tasks],
      };
    });
  }

  function updateIncidentStatus(incidentId: string, status: IncidentStatus) {
    if (!hydrated) {
      return;
    }

    if (backendMode === "live") {
      void mutateSnapshot(`/api/live/incidents/${incidentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
        .then(applySnapshot)
        .catch((error) =>
          fallbackToLocal(error, (current) => ({
            ...current,
            incidents: current.incidents.map((incident) =>
              incident.id === incidentId ? { ...incident, status } : incident,
            ),
          })),
        );
      return;
    }

    setState((current) => ({
      ...current,
      incidents: current.incidents.map((incident) =>
        incident.id === incidentId ? { ...incident, status } : incident,
      ),
    }));
  }

  function confirmSuggestion(suggestionId: string, chatId = "chat-general") {
    if (!hydrated) {
      return;
    }

    if (backendMode === "live") {
      const suggestion = state.substitutionSuggestions.find((item) => item.id === suggestionId);

      void mutateSnapshot(`/api/live/replacements/${suggestionId}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          candidateTeacherId: suggestion?.candidateUserId ?? null,
        }),
      })
        .then(applySnapshot)
        .catch((error) =>
          fallbackToLocal(error, (current) => {
            const suggestionItem = current.substitutionSuggestions.find((item) => item.id === suggestionId);
            if (!suggestionItem) {
              return current;
            }

            const nextState = confirmSubstitution(current, suggestionId);
            const candidate = nextState.users.find((user) => user.id === suggestionItem.candidateUserId);
            const confirmationMessage: Message = {
              id: createId("msg"),
              chatId,
              senderId: "ai-assistant",
              senderType: "ai",
              text: `${candidate?.name ?? "Замещающий учитель"} подтверждена на замену. Расписание обновлено.`,
              createdAt: new Date().toISOString(),
              kind: "system_event",
              parsedIntent: "substitution",
              metadata: {
                cardType: "generic",
                title: "Замена подтверждена",
                summary: `${candidate?.name ?? "Учитель"} уже отмечена в сегодняшнем расписании.`,
              },
            };

            return appendMessages(nextState, chatId, [confirmationMessage]);
          }),
        );
      return;
    }

    setState((current) => {
      const suggestion = current.substitutionSuggestions.find((item) => item.id === suggestionId);
      if (!suggestion) {
        return current;
      }

      const nextState = confirmSubstitution(current, suggestionId);
      const candidate = nextState.users.find((user) => user.id === suggestion.candidateUserId);
      const confirmationMessage: Message = {
        id: createId("msg"),
        chatId,
        senderId: "ai-assistant",
        senderType: "ai",
        text: `${candidate?.name ?? "Замещающий учитель"} подтверждена на замену. Расписание обновлено.`,
        createdAt: new Date().toISOString(),
        kind: "system_event",
        parsedIntent: "substitution",
        metadata: {
          cardType: "generic",
          title: "Замена подтверждена",
          summary: `${candidate?.name ?? "Учитель"} уже отмечена в сегодняшнем расписании.`,
        },
      };

      return appendMessages(nextState, chatId, [confirmationMessage]);
    });
  }

  function sendCafeteriaSummary() {
    if (!hydrated) {
      return;
    }

    setState((current) => {
      const date = toIsoDate(new Date());
      const summary =
        current.cafeteriaSummaries.find((item) => item.date === date) ??
        buildCafeteriaSummary(current.attendanceReports, current.classCatalog, date);

      const directorMessage: Message = {
        id: createId("msg"),
        chatId: "chat-cafeteria",
        senderId: "director-janar",
        senderType: "director",
        text: `Сводка на питание: ${summary.totalMeals} порций, отсутствуют ${summary.totalAbsent}, классы отчитались: ${summary.reportedClasses.join(", ")}.`,
        createdAt: new Date().toISOString(),
        kind: "text",
        parsedIntent: "attendance",
      };

      const aiMessage: Message = {
        id: createId("msg"),
        chatId: "chat-cafeteria",
        senderId: "ai-assistant",
        senderType: "ai",
        text: "Сводка отправлена в столовую и сохранена в истории дня.",
        createdAt: new Date().toISOString(),
        kind: "parsed_card",
        parsedIntent: "attendance",
        metadata: {
          cardType: "cafeteria",
          title: "Сводка отправлена",
          summary: `${summary.totalMeals} порций на сегодня.`,
          summaryState: summary,
        },
      };

      return appendMessages(
        {
          ...current,
          cafeteriaSummaries: upsertCafeteriaSummary(current.cafeteriaSummaries, summary),
        },
        "chat-cafeteria",
        [directorMessage, aiMessage],
      );
    });
  }

  function askDocument(query: string) {
    if (!hydrated) {
      return explainDocument(query, []);
    }

    const answer = explainDocument(query, state.documentChunks);

    setState((current) => ({
      ...current,
      documentAnswers: [answer, ...current.documentAnswers],
    }));

    return answer;
  }

  function saveWorkspaceToHistory(workspace: AssistantWorkspaceDocument) {
    const originalText = extractPlainTextFromHtml(workspace.html);
    const bullets = buildWorkspaceBullets(originalText);

    const existing =
      state.documentAnswers.find(
        (item) =>
          item.source === "workspace" &&
          item.docTitle === workspace.title &&
          item.fileName === workspace.fileName &&
          (item.originalText ?? "") === originalText,
      ) ?? null;

    if (existing) {
      return existing;
    }

    const answer: DocumentAnswer = {
      id: createId("doc-history"),
      query: `Сохранённый документ: ${workspace.title}`,
      docTitle: workspace.title,
      bullets,
      relevantChunkIds: [],
      createdAt: new Date().toISOString(),
      source: "workspace",
      summary: workspace.summary,
      fileName: workspace.fileName,
      originalText,
    };

    setState((current) => ({
      ...current,
      documentAnswers: [answer, ...current.documentAnswers],
    }));

    return answer;
  }

  function uploadDocumentFile(fileName: string, content: string) {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    const docTitle = titleFromFileName(fileName);
    const chunks = buildDocumentChunksFromUpload(fileName, trimmedContent);

    setState((current) => ({
      ...current,
      documentChunks: [
        ...current.documentChunks.filter((chunk) => chunk.docTitle !== docTitle),
        ...chunks,
      ],
    }));
  }

  function createScheduleEvent(input: {
    title: string;
    description?: string;
    eventDate: string;
    startTime: string;
    endTime: string;
    room?: string;
  }) {
    if (!hydrated) {
      return;
    }

    const eventDate = input.eventDate.trim();
    const startTime = input.startTime.trim();
    const endTime = input.endTime.trim();

    if (!eventDate || !startTime || !endTime || !input.title.trim()) {
      return;
    }

    const date = new Date(`${eventDate}T12:00:00`);
    const day = date.getDay();
    const weekday = day === 0 ? 7 : day;

    const newEntry: ScheduleEntry = {
      id: createId("schedule-event"),
      entryType: "event",
      date: eventDate,
      className: "Директор",
      subject: input.title.trim(),
      teacherUserId: "director-janar",
      room: input.room?.trim() || "Уточняется",
      weekday,
      lessonNumber: 0,
      startTime,
      endTime,
      notes: input.description?.trim() || "",
      createdBy: "director-janar",
    };

    setState((current) => ({
      ...current,
      scheduleEntries: [newEntry, ...current.scheduleEntries],
    }));
  }

  function clearScheduleEvents() {
    setState((current) => ({
      ...current,
      scheduleEntries: current.scheduleEntries.filter((e) => e.entryType !== "event"),
    }));
  }

  function deleteDocumentFile(docTitle: string) {
    setState((current) => ({
      ...current,
      documentChunks: current.documentChunks.filter((chunk) => chunk.docTitle !== docTitle),
    }));
  }

  function deleteDocumentHistoryEntry(id: string) {
    setState((current) => ({
      ...current,
      documentAnswers: current.documentAnswers.filter((answer) => answer.id !== id),
    }));
  }

  function summarizeChatHistory(chatId: string) {
    return state.messages
      .filter((message) => message.chatId === chatId)
      .slice(-14)
      .map((message) => {
        const sender = state.users.find((user) => user.id === message.senderId);

        return {
          id: message.id,
          senderId: message.senderId,
          senderName: sender?.name ?? message.senderId,
          senderType: message.senderType,
          kind: message.kind,
          text: message.text,
          createdAt: message.createdAt,
        };
      });
  }

  function executeAssistantActions(actions: AssistantCommandPlan["actions"]) {
    let navigateTo: string | null = null;

    for (const action of actions) {
      if (action.type === "create_task") {
        if (action.title && action.assigneeUserId && action.dueDate) {
          createTask({
            title: action.title,
            description: action.description ?? "",
            assigneeUserId: action.assigneeUserId,
            dueDate: action.dueDate,
          });
        }
        continue;
      }

      if (action.type === "create_schedule_event") {
        if (action.title && action.eventDate && action.startTime && action.endTime) {
          createScheduleEvent({
            title: action.title,
            description: action.description ?? "",
            eventDate: action.eventDate,
            startTime: action.startTime,
            endTime: action.endTime,
            room: action.room ?? "",
          });
          if (!navigateTo) {
            navigateTo = "/schedule";
          }
        }
        continue;
      }

      if (action.type === "update_task_status") {
        if (action.taskId && action.taskStatus) {
          updateTaskStatus(action.taskId, action.taskStatus);
        }
        continue;
      }

      if (action.type === "update_incident_status") {
        if (action.incidentId && action.incidentStatus) {
          updateIncidentStatus(action.incidentId, action.incidentStatus);
        }
        continue;
      }

      if (action.type === "confirm_suggestion") {
        if (action.suggestionId) {
          confirmSuggestion(action.suggestionId, action.chatId);
        }
        continue;
      }

      if (action.type === "send_cafeteria_summary") {
        sendCafeteriaSummary();
        continue;
      }

      if (action.type === "send_message") {
        if (action.chatId && action.text) {
          sendMessage({
            chatId: action.chatId,
            senderId: "director-janar",
            senderType: "director",
            text: action.text,
            kind: action.kind ?? "text",
          });
          markChatRead(action.chatId);
          if (!navigateTo) {
            navigateTo = `/chats/${action.chatId}`;
          }
        }
        continue;
      }

      if (action.type === "mark_chat_read") {
        if (action.chatId) {
          markChatRead(action.chatId);
          if (!navigateTo) {
            navigateTo = `/chats/${action.chatId}`;
          }
        }
        continue;
      }

      if (action.type === "reset_demo") {
        resetDemo();
        continue;
      }

      if (action.type === "navigate" && action.path) {
        navigateTo = action.path;
      }
    }

    return navigateTo;
  }

  async function runAssistantCommand(command: string) {
    const trimmedCommand = command.trim();

    if (!trimmedCommand) {
      return { reply: "", navigateTo: null };
    }

    const response = await fetch("/api/assistant/command", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: trimmedCommand,
        state: summarizeStateForAssistant(state),
      }),
    });

    const payload = (await response.json()) as AssistantCommandPlan | { error?: string };

    if (!response.ok || !("reply" in payload)) {
      throw new Error(("error" in payload && payload.error) || "Assistant command failed.");
    }

    return { reply: payload.reply, navigateTo: executeAssistantActions(payload.actions) };
  }

  async function runAISanaConversation(input: {
    chatId: string;
    text: string;
    kind?: "text" | "voice";
    bureaucraticMode?: boolean;
  }) {
    const trimmedText = input.text.trim();

    if (!trimmedText) {
      return { reply: "", navigateTo: null, needsClarification: false };
    }

    const response = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: trimmedText,
        kind: input.kind ?? "text",
        bureaucraticMode: input.bureaucraticMode ?? false,
        chatId: input.chatId,
        history: summarizeChatHistory(input.chatId),
        ragContext: input.bureaucraticMode
          ? retrieveRelevantChunks(state.documentChunks, trimmedText, 8).map((chunk) => ({
              docTitle: chunk.docTitle,
              sectionTitle: chunk.sectionTitle,
              content: chunk.content,
              tags: chunk.tags,
            }))
          : [],
        state: summarizeStateForAssistant(state),
      }),
    });

    const payload = (await response.json()) as AssistantChatPlan | { error?: string };

    if (!response.ok || !("reply" in payload)) {
      throw new Error(("error" in payload && payload.error) || "AISana chat request failed.");
    }

    const navigateTo = executeAssistantActions(payload.actions);

    const clarificationReply =
      payload.needsClarification && payload.clarification
        ? [payload.clarification.intro, payload.clarification.question].filter(Boolean).join(" ")
        : "";
    const messageText = (clarificationReply || payload.reply).trim();

    if (messageText) {
      sendMessage({
        chatId: input.chatId,
        senderId: AISANA_USER_ID,
        senderType: "ai",
        text: messageText,
        kind: payload.needsClarification ? "system_event" : "text",
        metadata: payload.needsClarification
          ? {
              cardType: "generic",
              title: "Нужно уточнение",
              summary: "AISana ждёт несколько деталей, чтобы собрать документ без ошибок.",
              clarification: payload.clarification,
            }
          : payload.workspace
            ? {
                workspace: payload.workspace,
              }
            : undefined,
      });
    }

    return {
      reply: payload.reply,
      navigateTo,
      needsClarification: payload.needsClarification,
    };
  }

  function resetDemo() {
    readChatIdsRef.current.clear();
    try {
      window.localStorage.removeItem(LOCAL_STATE_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }

    if (backendMode === "live") {
      void fetchSnapshot()
        .then(applySnapshot)
        .catch((error) => fallbackToLocal(error, () => buildSeedState()));
      return;
    }

    setState(buildSeedState());
  }

  return (
    <AppStateContext.Provider
      value={{
        state,
        hydrated,
        backendMode,
        backendError,
        sendMessage,
        markChatRead,
        updateTaskStatus,
        createTask,
        createScheduleEvent,
        updateIncidentStatus,
        confirmSuggestion,
        sendCafeteriaSummary,
        askDocument,
        saveWorkspaceToHistory,
        uploadDocumentFile,
        deleteDocumentFile,
        deleteDocumentHistoryEntry,
        runAssistantCommand,
        runAISanaConversation,
        resetDemo,
        clearScheduleEvents,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used inside AppProvider");
  }

  return context;
}

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
import { buildCafeteriaSummary, upsertCafeteriaSummary } from "@/lib/services/cafeteria";
import { processChatMessage } from "@/lib/services/chatPipeline";
import { confirmSubstitution } from "@/lib/services/substitution";
import type {
  AppState,
  DocumentAnswer,
  IncidentStatus,
  Message,
  SendMessageInput,
  Task,
  TaskStatus,
} from "@/lib/types";
import { createId, toIsoDate } from "@/lib/utils";

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
  updateIncidentStatus: (incidentId: string, status: IncidentStatus) => void;
  confirmSuggestion: (suggestionId: string, chatId?: string) => void;
  sendCafeteriaSummary: () => void;
  askDocument: (query: string) => DocumentAnswer;
  resetDemo: () => void;
}

type RemoteSnapshot = {
  mode: "demo" | "live";
  state: AppState;
  error?: string | null;
};

const AppStateContext = createContext<AppContextValue | null>(null);
const LIVE_SYNC_INTERVAL_MS = 15_000;

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

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(buildEmptyState);
  const [hydrated, setHydrated] = useState(false);
  const [backendMode, setBackendMode] = useState<"demo" | "live">("demo");
  const [backendError, setBackendError] = useState<string | null>(null);
  const readChatIdsRef = useRef(new Set<string>());

  function mergeSnapshot(snapshot: RemoteSnapshot, currentState: AppState) {
    const mergedState: AppState = {
      ...snapshot.state,
      documentAnswers: currentState.documentAnswers,
    };

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
      window.clearInterval(intervalId);
    };
  // The sync lifecycle intentionally mounts once; state setters are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sendMessage(input: SendMessageInput) {
    if (!hydrated) {
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

  function resetDemo() {
    readChatIdsRef.current.clear();

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
        updateIncidentStatus,
        confirmSuggestion,
        sendCafeteriaSummary,
        askDocument,
        resetDemo,
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

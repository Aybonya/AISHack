import { explainDocument } from "@/lib/ai/explainDocument";
import { generateTaskSummary } from "@/lib/ai/generateTaskSummary";
import { classifyMessage } from "@/lib/parser/classifyMessage";
import { extractAbsence } from "@/lib/parser/extractAbsence";
import { extractAttendance } from "@/lib/parser/extractAttendance";
import { extractIncident } from "@/lib/parser/extractIncident";
import { extractTaskUpdate } from "@/lib/parser/extractTaskUpdate";
import { extractTasks } from "@/lib/parser/extractTasks";
import { buildCafeteriaSummary, upsertAttendanceReport, upsertCafeteriaSummary } from "@/lib/services/cafeteria";
import { retrieveRelevantChunks } from "@/lib/services/documents";
import { createIncidentFromExtraction } from "@/lib/services/incidents";
import { buildSubstitutionSuggestion, createTeacherAbsence } from "@/lib/services/substitution";
import { createTasksFromDrafts } from "@/lib/services/tasks";
import type {
  AppState,
  AttendanceReport,
  DocumentAnswer,
  Message,
  SendMessageInput,
} from "@/lib/types";
import { createId, toIsoDate } from "@/lib/utils";

const AISANA_CHAT_ID = "chat-aisana";

function buildAiMessage(message: Omit<Message, "id" | "createdAt" | "senderId" | "senderType" | "kind">) {
  return {
    id: createId("msg"),
    senderId: "ai-assistant",
    senderType: "ai" as const,
    createdAt: new Date().toISOString(),
    kind: "parsed_card" as const,
    ...message,
  };
}

function updateChatMeta(state: AppState, chatId: string, lastMessageId: string, incrementUnread: boolean) {
  return state.chats.map((chat) =>
    chat.id === chatId
      ? {
          ...chat,
          lastMessageId,
          unreadCount: incrementUnread ? chat.unreadCount + 1 : chat.unreadCount,
        }
      : chat,
  );
}

function appendMessages(state: AppState, chatId: string, newMessages: Message[], incrementUnread: boolean) {
  const lastMessageId = newMessages[newMessages.length - 1]?.id ?? state.chats.find((chat) => chat.id === chatId)?.lastMessageId ?? "";

  return {
    ...state,
    messages: [...state.messages, ...newMessages],
    chats: updateChatMeta(state, chatId, lastMessageId, incrementUnread),
  };
}

export function processChatMessage(state: AppState, input: SendMessageInput): AppState {
  const baseMessage: Message = {
    id: createId("msg"),
    chatId: input.chatId,
    senderId: input.senderId,
    senderType: input.senderType,
    text: input.text.trim(),
    createdAt: new Date().toISOString(),
    kind: input.kind ?? "text",
    parsedIntent: "generic",
  };

  if (!baseMessage.text) {
    return state;
  }

  const intent = classifyMessage(baseMessage.text, state.users);
  const userMessage = { ...baseMessage, parsedIntent: intent };
  let nextState = appendMessages(state, input.chatId, [userMessage], input.senderType === "teacher");

  // Если это не прямой чат с ИИ, то ответы ИИ отправляем в приватный чат ассистента, чтобы не флудить в группах
  const responseChatId = input.chatId.startsWith("chat-") && input.chatId !== AISANA_CHAT_ID 
    ? AISANA_CHAT_ID 
    : input.chatId;

  if (intent === "attendance") {
    const extraction = extractAttendance(baseMessage.text);
    if (!extraction) {
      return nextState;
    }

    const report: AttendanceReport = {
      id: createId("attendance"),
      date: toIsoDate(new Date(baseMessage.createdAt)),
      className: extraction.className,
      presentCount: extraction.presentCount,
      absentCount: extraction.absentCount,
      sourceMessageId: userMessage.id,
      confidence: extraction.confidence,
    };

    const attendanceReports = upsertAttendanceReport(nextState.attendanceReports, report);
    const summary = buildCafeteriaSummary(attendanceReports, nextState.classCatalog, report.date);
    nextState = {
      ...nextState,
      attendanceReports,
      cafeteriaSummaries: upsertCafeteriaSummary(nextState.cafeteriaSummaries, summary),
    };

    return appendMessages(
      nextState,
      responseChatId,
      [
        buildAiMessage({
          chatId: responseChatId,
          text: `Посещаемость ${report.className} добавлена в сводку питания.`,
          parsedIntent: "attendance",
          metadata: {
            cardType: "attendance",
            title: `Питание: ${report.className}`,
            summary: `${report.presentCount} на питание, отсутствуют ${report.absentCount}.`,
            report,
            summaryState: summary,
          },
        }),
      ],
      responseChatId === AISANA_CHAT_ID,
    );
  }

  if (intent === "incident") {
    const extraction = extractIncident(baseMessage.text);
    if (!extraction) {
      return nextState;
    }

    const incident = createIncidentFromExtraction(extraction, userMessage.id, nextState.users);
    nextState = {
      ...nextState,
      incidents: [incident, ...nextState.incidents],
    };

    return appendMessages(
      nextState,
      responseChatId,
      [
        buildAiMessage({
          chatId: responseChatId,
          text: "Инцидент зарегистрирован и поставлен в работу.",
          parsedIntent: "incident",
          metadata: {
            cardType: "incident",
            title: incident.title,
            summary: `${incident.location}. Ответственный уже назначен.`,
            incidentId: incident.id,
            location: incident.location,
            priority: incident.priority,
          },
        }),
      ],
      responseChatId === AISANA_CHAT_ID,
    );
  }

  if (intent === "task") {
    const drafts = extractTasks(baseMessage.text, nextState.users);
    const createdTasks = createTasksFromDrafts(drafts, nextState.users, userMessage.id, input.senderId);
    nextState = {
      ...nextState,
      tasks: [...createdTasks, ...nextState.tasks],
    };

    return appendMessages(
      nextState,
      responseChatId,
      [
        buildAiMessage({
          chatId: responseChatId,
          text: generateTaskSummary(createdTasks, nextState.users),
          parsedIntent: "task",
          metadata: {
            cardType: "task",
            title: `${createdTasks.length} ${createdTasks.length === 1 ? "задача" : "задачи"} назначены`,
            summary: generateTaskSummary(createdTasks, nextState.users),
            taskIds: createdTasks.map((task) => task.id),
          },
        }),
      ],
      responseChatId === AISANA_CHAT_ID,
    );
  }

  if (intent === "task_update") {
    const update = extractTaskUpdate(baseMessage.text);
    if (update && update.status === "done") {
      // Находим последнюю задачу, назначенную на этого пользователя, которая еще не выполнена
      const taskIndex = nextState.tasks.findIndex(t => t.assigneeUserId === input.senderId && t.status !== "done");
      if (taskIndex !== -1) {
        const task = nextState.tasks[taskIndex];
        const updatedTasks = [...nextState.tasks];
        updatedTasks[taskIndex] = { ...task, status: "done" };
        nextState = { ...nextState, tasks: updatedTasks };

        return appendMessages(
          nextState,
          responseChatId,
          [
            buildAiMessage({
              chatId: responseChatId,
              text: `Задача "${task.title}" отмечена как выполненная.`,
              parsedIntent: "task_update",
              metadata: {
                cardType: "generic",
                title: "Задача выполнена",
                summary: `Исполнитель ${state.users.find(u => u.id === input.senderId)?.name} завершил работу над задачей.`,
              },
            }),
          ],
          responseChatId === AISANA_CHAT_ID,
        );
      }
    }
  }

  if (intent === "substitution") {
    const extraction = extractAbsence(baseMessage.text, nextState.users);
    if (!extraction) {
      return nextState;
    }

    const absence = createTeacherAbsence(extraction, userMessage.id);
    const teacherAbsences = [...nextState.teacherAbsences, absence];
    const suggestion = buildSubstitutionSuggestion(
      absence,
      nextState.users,
      nextState.scheduleEntries,
      teacherAbsences,
    );

    nextState = {
      ...nextState,
      teacherAbsences,
      substitutionSuggestions: suggestion
        ? [suggestion, ...nextState.substitutionSuggestions]
        : nextState.substitutionSuggestions,
    };

    const aiMessage = suggestion
      ? buildAiMessage({
          chatId: responseChatId,
          text: suggestion.explanation,
          parsedIntent: "substitution",
          metadata: {
            cardType: "substitution",
            title: "Предлагаю замену",
            summary: suggestion.explanation,
            suggestionId: suggestion.id,
            candidateUserId: suggestion.candidateUserId,
            affectedLessons: suggestion.affectedLessons,
            confirmed: false,
          },
        })
      : buildAiMessage({
          chatId: responseChatId,
          text: "Отсутствие отмечено, но уроков на сегодня не найдено.",
          parsedIntent: "substitution",
          metadata: {
            cardType: "generic",
            title: "Отсутствие отмечено",
            summary: "На текущий день замена не требуется.",
          },
        });

    return appendMessages(nextState, responseChatId, [aiMessage], responseChatId === AISANA_CHAT_ID);
  }

  if (baseMessage.text.toLowerCase().includes("приказ") || baseMessage.text.toLowerCase().includes("регламент")) {
    const relevantChunks = retrieveRelevantChunks(nextState.documentChunks, baseMessage.text, 3);
    const answer: DocumentAnswer = explainDocument(baseMessage.text, relevantChunks);
    nextState = {
      ...nextState,
      documentAnswers: [answer, ...nextState.documentAnswers],
    };

    return appendMessages(
      nextState,
      responseChatId,
      [
        buildAiMessage({
          chatId: responseChatId,
          text: answer.bullets.join(" "),
          parsedIntent: "generic",
          metadata: {
            cardType: "document",
            title: answer.docTitle,
            summary: "Объяснение документа простыми словами.",
            answerId: answer.id,
            bullets: answer.bullets,
            docTitle: answer.docTitle,
          },
        }),
      ],
      responseChatId === AISANA_CHAT_ID,
    );
  }

  return nextState;
}

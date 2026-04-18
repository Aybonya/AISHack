"use client";

import {
  BadgeCheck,
  Mic,
  MoreVertical,
  Phone,
  Plus,
  Search,
  SendHorizontal,
  SmilePlus,
  Video,
} from "lucide-react";
import { type KeyboardEvent, useState, useTransition } from "react";

import { MessageBubble } from "@/components/message-bubble";
import { useAppState } from "@/components/providers/app-provider";
import { classifyMessage } from "@/lib/parser/classifyMessage";
import { extractAbsence } from "@/lib/parser/extractAbsence";
import { extractAttendance } from "@/lib/parser/extractAttendance";
import { cn, normalizeText } from "@/lib/utils";

export function ConversationView({ chatId }: { chatId: string }) {
  const { state, sendMessage, hydrated, backendError } = useAppState();
  const chat = state.chats.find((item) => item.id === chatId) ?? state.chats[0];
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<"text" | "voice">("text");
  const [isPending, startTransition] = useTransition();

  if (!hydrated && !chat) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[#0b141a] px-6 text-center">
        <div className="max-w-md rounded-[2rem] border border-white/[0.08] bg-[#111b21] px-8 py-10">
          <div className="text-lg font-medium text-white">Подключаем сообщения из GreenAPI</div>
          <div className="mt-2 text-sm leading-6 text-[#9fb0b6]">
            Дизайн уже открыт. Ждём реальную историю чатов, задачи и события из backend.
          </div>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[#0b141a] px-6 text-center">
        <div className="max-w-md rounded-[2rem] border border-white/[0.08] bg-[#111b21] px-8 py-10">
          <div className="text-lg font-medium text-white">Нет live-данных для чатов</div>
          <div className="mt-2 text-sm leading-6 text-[#9fb0b6]">
            {backendError ?? "Backend не вернул список чатов. Проверю это соединение следующим шагом."}
          </div>
        </div>
      </div>
    );
  }

  const participants = state.users.filter((user) => chat.participants.includes(user.id));
  const teacherParticipants = participants.filter((user) => user.role === "teacher");

  const messages = state.messages
    .filter((message) => message.chatId === chat.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  const headerTitle = chat.id === "chat-general" ? "Общение AISana" : chat.title;
  const headerSubtitle =
    chat.id === "chat-general"
      ? "Жанар С., Аскар, Айгерим К., Назкен М. и ещё 8 участников"
      : `${participants.length} участников`;

  function inferTeacherSenderId(text: string) {
    const normalized = normalizeText(text);
    const byMention = teacherParticipants.find(
      (teacher) =>
        normalized.includes(normalizeText(teacher.name)) ||
        normalized.includes(normalizeText(teacher.name.split(" ")[0] ?? "")),
    );

    if (byMention) {
      return byMention.id;
    }

    const attendance = extractAttendance(text);
    if (attendance) {
      const grade = Number(attendance.className.match(/\d+/)?.[0] ?? 0);
      const classTeacher = teacherParticipants.find((teacher) =>
        teacher.qualifications.some((qualification) =>
          normalizeText(qualification).includes(normalizeText(attendance.className)),
        ),
      );

      if (classTeacher) {
        return classTeacher.id;
      }

      if (grade <= 4) {
        const primaryTeacher = teacherParticipants.find((teacher) =>
          teacher.subjects.some((subject) => normalizeText(subject).includes("началь")),
        );

        if (primaryTeacher) {
          return primaryTeacher.id;
        }
      }
    }

    const absence = extractAbsence(text, state.users);
    if (absence) {
      const availableTeacher = teacherParticipants.find((teacher) => teacher.id !== absence.teacherUserId);
      if (availableTeacher) {
        return availableTeacher.id;
      }
    }

    return teacherParticipants[0]?.id ?? "aigerim";
  }

  function handleSend() {
    if (!draft.trim()) {
      return;
    }

    const intent = classifyMessage(draft, state.users);
    const inferredSenderType = intent === "task" || intent === "generic" ? "director" : "teacher";
    const inferredSenderId =
      inferredSenderType === "director" ? "director-janar" : inferTeacherSenderId(draft);

    startTransition(() => {
      sendMessage({
        chatId: chat.id,
        senderId: inferredSenderId,
        senderType: inferredSenderType,
        text: draft,
        kind,
      });
      setDraft("");
      setKind("text");
    });
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b141a]">
      <div className="flex h-[72px] items-center justify-between border-b border-white/[0.06] bg-[#202c33] px-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#1f9b55] text-base font-semibold text-white">
            {chat.id === "chat-general" ? "AI" : chat.avatar}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-[1.18rem] font-medium text-white">{headerTitle}</div>
              {chat.id === "chat-general" ? (
                <BadgeCheck className="size-4 shrink-0 text-[#25d366]" fill="currentColor" />
              ) : null}
            </div>
            <div className="truncate text-sm text-[#a7b5ba]">{headerSubtitle}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#d3dde0]">
          <button className="rounded-full p-2 transition hover:bg-white/[0.06] hover:text-white" type="button">
            <Video className="size-5" />
          </button>
          <button
            className="hidden items-center gap-2 rounded-full border border-white/[0.09] px-4 py-2 text-base text-white transition hover:bg-white/[0.04] 2xl:inline-flex"
            type="button"
          >
            <Phone className="size-4" />
            Позвонить
          </button>
          <button className="rounded-full p-2 transition hover:bg-white/[0.06] hover:text-white" type="button">
            <Search className="size-5" />
          </button>
          <button className="rounded-full p-2 transition hover:bg-white/[0.06] hover:text-white" type="button">
            <MoreVertical className="size-5" />
          </button>
        </div>
      </div>

      <div className="aisana-chat-bg flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto mb-6 w-fit rounded-full bg-[#1f2c34] px-4 py-1.5 text-sm text-[#e9edef]">
          Сегодня
        </div>

        <div className="space-y-4">
          {messages.map((message) => (
            <div
              className={cn(
                "flex",
                message.senderType === "director" ? "justify-end" : "justify-start",
              )}
              key={message.id}
            >
              <MessageBubble message={message} />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-[#202c33] px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-[#d3dde0] transition hover:bg-white/[0.06] hover:text-white"
            type="button"
          >
            <Plus className="size-6" strokeWidth={2.2} />
          </button>

          <div className="flex h-14 flex-1 items-center gap-2 rounded-full bg-[#2a3942] px-4">
            <button
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#cfd8dc] transition hover:bg-white/[0.06] hover:text-white"
              type="button"
            >
              <SmilePlus className="size-5" />
            </button>
            <input
              className="h-full flex-1 bg-transparent text-[1.02rem] text-white outline-none placeholder:text-[#9badb3]"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Введите сообщение"
              type="text"
              value={draft}
            />
            <button
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full transition",
                draft.trim()
                  ? "bg-[#00a884] text-[#091319] hover:brightness-105"
                  : "text-[#cfd8dc] hover:bg-white/[0.06] hover:text-white",
              )}
              disabled={isPending}
              onClick={draft.trim() ? handleSend : () => setKind(kind === "voice" ? "text" : "voice")}
              type="button"
            >
              {draft.trim() ? (
                <SendHorizontal className="size-5" />
              ) : (
                <Mic className={cn("size-5", kind === "voice" ? "text-[#25d366]" : "")} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

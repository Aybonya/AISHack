"use client";

import { CalendarClock, MessageSquareText, Sparkles, User2, X } from "lucide-react";

import { useAppState } from "@/components/providers/app-provider";
import type { Task } from "@/lib/types";
import { formatDateLabel, formatTime } from "@/lib/utils";

function sourceLabel(task: Task) {
  return task.sourceMessageId === "manual-task" ? "Вручную" : "AISana";
}

export function TaskDetailModal({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const { state, updateTaskStatus } = useAppState();
  const assignee = state.users.find((user) => user.id === task.assigneeUserId);
  const sourceMessage = state.messages.find((message) => message.id === task.sourceMessageId);
  const sourceChat = state.chats.find((chat) => chat.id === sourceMessage?.chatId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[30px] bg-[#10181d] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.42)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#10271f] px-2.5 py-1 text-[11px] text-[#88efbb]">
              <Sparkles className="size-3" />
              {sourceLabel(task)}
            </div>
            <div className="mt-4 text-2xl font-semibold leading-tight text-white">{task.title}</div>
            {task.description ? (
              <div className="mt-3 text-sm leading-7 text-[#8ea0a7]">{task.description}</div>
            ) : null}
          </div>

          <button
            className="flex size-10 items-center justify-center rounded-full bg-white/[0.04] text-[#c8d4d8] transition hover:bg-white/[0.08] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-[22px] bg-[#121d22] px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
              <User2 className="size-4 text-[#73dba5]" />
              Исполнитель
            </div>
            <div className="mt-2 text-base text-white">{assignee?.name ?? "Не назначено"}</div>
          </div>

          <div className="rounded-[22px] bg-[#121d22] px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
              <CalendarClock className="size-4 text-[#73dba5]" />
              Срок
            </div>
            <div className="mt-2 text-base text-white">
              {formatDateLabel(task.dueDate)}, {formatTime(task.dueDate)}
            </div>
          </div>

          <div className="rounded-[22px] bg-[#121d22] px-4 py-4">
            <div className="text-sm text-[#8ea0a7]">Статус</div>
            <div className="mt-2 text-base text-white">
              {task.status === "new" ? "Сегодня" : task.status === "in_progress" ? "В процессе" : "Готово"}
            </div>
          </div>

          <div className="rounded-[22px] bg-[#121d22] px-4 py-4">
            <div className="text-sm text-[#8ea0a7]">Источник</div>
            <div className="mt-2 text-base text-white">{sourceLabel(task)}</div>
          </div>
        </div>

        <div className="mt-3 rounded-[22px] bg-[#121d22] px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
            <MessageSquareText className="size-4 text-[#73dba5]" />
            Связанный контекст
          </div>
          <div className="mt-2 text-sm leading-7 text-[#d7e0e3]">
            {sourceChat ? `${sourceChat.title}` : "Без связанного чата"}
          </div>
          <div className="mt-2 text-sm leading-7 text-[#8ea0a7]">
            {sourceMessage?.text ?? "Задача создана вручную директором."}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            className="rounded-full bg-white/[0.05] px-4 py-2.5 text-sm text-[#d7e0e3] transition hover:bg-white/[0.08]"
            onClick={() => updateTaskStatus(task.id, "new")}
            type="button"
          >
            Вернуть в Сегодня
          </button>
          <button
            className="rounded-full bg-[#10271f] px-4 py-2.5 text-sm text-[#bdf6d7] transition hover:bg-[#133025]"
            onClick={() => updateTaskStatus(task.id, "in_progress")}
            type="button"
          >
            В работу
          </button>
          <button
            className="rounded-full bg-[#103529] px-4 py-2.5 text-sm text-[#d8fff0] transition hover:bg-[#134232]"
            onClick={() => updateTaskStatus(task.id, "done")}
            type="button"
          >
            Завершить
          </button>
        </div>
      </div>
    </div>
  );
}

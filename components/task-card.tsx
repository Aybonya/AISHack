"use client";

import { CalendarClock, Check, RotateCcw, Sparkles } from "lucide-react";

import { useAppState } from "@/components/providers/app-provider";
import type { Task } from "@/lib/types";
import { cn, formatDateLabel, formatTime } from "@/lib/utils";

function isUrgent(task: Task) {
  return task.status !== "done" && new Date(task.dueDate).getTime() <= Date.now() + 6 * 60 * 60 * 1000;
}

function formatDueLabel(value: string) {
  return `${formatDateLabel(value)}, ${formatTime(value)}`;
}

export function TaskCard({
  task,
  onOpen,
}: {
  task: Task;
  onOpen?: (task: Task) => void;
}) {
  const { state, updateTaskStatus } = useAppState();
  const assignee = state.users.find((user) => user.id === task.assigneeUserId);
  const urgent = isUrgent(task);
  const createdByAi = task.sourceMessageId !== "manual-task";

  const primaryAction =
    task.status === "new"
      ? { label: "В работу", next: "in_progress" as const }
      : task.status === "in_progress"
        ? { label: "Завершить", next: "done" as const }
        : { label: "Вернуть", next: "in_progress" as const };

  return (
    <div
      className={cn(
        "group cursor-pointer rounded-[22px] bg-[#121c21] px-5 py-4 text-left transition hover:bg-[#152129]",
        urgent && "bg-[#161d18]",
      )}
      onClick={() => onOpen?.(task)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-[#9eb0b6]">
            <span className="truncate">{assignee?.name ?? "Не назначено"}</span>
            {createdByAi ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#10271f] px-2 py-1 text-[11px] text-[#89efbb]">
                <Sparkles className="size-3" />
                AISana
              </span>
            ) : null}
            {urgent ? <span className="size-1.5 rounded-full bg-[#8cbf6d]" /> : null}
          </div>

          <div className="mt-3 text-[1.05rem] font-semibold leading-6 text-white">{task.title}</div>

          {task.description ? (
            <div className="mt-2 line-clamp-2 text-sm leading-6 text-[#8ea0a7]">{task.description}</div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-[#9fb1b7]">
        <CalendarClock className="size-4 text-[#6fd9a0]" />
        <span>{formatDueLabel(task.dueDate)}</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.18em] text-[#61747b]">
          {task.status === "new" ? "Сегодня" : task.status === "in_progress" ? "В процессе" : "Готово"}
        </div>

        <div className="flex items-center gap-2">
          {task.status === "done" ? (
            <button
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-2 text-sm text-[#d4dee2] transition hover:bg-white/[0.08]"
              onClick={(event) => {
                event.stopPropagation();
                updateTaskStatus(task.id, "in_progress");
              }}
              type="button"
            >
              <RotateCcw className="size-3.5" />
              Вернуть
            </button>
          ) : (
            <button
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition",
                task.status === "new"
                  ? "bg-[#103529] text-[#d8fff0] hover:bg-[#134232]"
                  : "bg-[#10271f] text-[#bdf6d7] hover:bg-[#123125]",
              )}
              onClick={(event) => {
                event.stopPropagation();
                updateTaskStatus(task.id, primaryAction.next);
              }}
              type="button"
            >
              <Check className="size-3.5" />
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

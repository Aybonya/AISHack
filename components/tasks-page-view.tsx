"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { TaskBoard } from "@/components/task-board";
import { TaskDetailModal } from "@/components/task-detail-modal";
import { useAppState } from "@/components/providers/app-provider";
import { TaskSummaryRow } from "@/components/task-summary-row";
import type { Task } from "@/lib/types";

function isUrgent(task: Task) {
  return task.status !== "done" && new Date(task.dueDate).getTime() <= Date.now() + 6 * 60 * 60 * 1000;
}

function toDatetimeLocalValue(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function defaultDueDateValue() {
  return toDatetimeLocalValue(new Date(Date.now() + 2 * 60 * 60 * 1000));
}

function CreateTaskModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { state, createTask } = useAppState();
  const assignees = state.users.filter((user) => user.role !== "ai");
  const defaultAssignee = assignees[0]?.id ?? "";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState(defaultAssignee);
  const [dueDate, setDueDate] = useState(defaultDueDateValue);

  function handleSubmit() {
    if (!title.trim() || !assigneeUserId || !dueDate) {
      return;
    }

    createTask({
      title: title.trim(),
      description: description.trim(),
      assigneeUserId,
      dueDate: new Date(dueDate).toISOString(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[30px] bg-[#10181d] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.42)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">Новая задача</div>
            <div className="mt-2 text-2xl font-semibold text-white">Добавить поручение</div>
          </div>
          <button
            className="flex size-10 items-center justify-center rounded-full bg-white/[0.04] text-[#c8d4d8] transition hover:bg-white/[0.08] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm text-[#8ea0a7]">Название</span>
            <input
              className="rounded-[20px] bg-[#121d22] px-4 py-3 text-white outline-none placeholder:text-[#64767d]"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, Подготовить актовый зал"
              value={title}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[#8ea0a7]">Описание</span>
            <textarea
              className="min-h-[110px] rounded-[20px] bg-[#121d22] px-4 py-3 text-white outline-none placeholder:text-[#64767d]"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Короткая заметка или контекст"
              value={description}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-[#8ea0a7]">Исполнитель</span>
              <select
                className="rounded-[20px] bg-[#121d22] px-4 py-3 text-white outline-none"
                onChange={(event) => setAssigneeUserId(event.target.value)}
                value={assigneeUserId}
              >
                {assignees.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-[#8ea0a7]">Срок</span>
              <input
                className="rounded-[20px] bg-[#121d22] px-4 py-3 text-white outline-none"
                onChange={(event) => setDueDate(event.target.value)}
                type="datetime-local"
                value={dueDate}
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            className="rounded-full bg-white/[0.05] px-4 py-2.5 text-sm text-[#d7e0e3] transition hover:bg-white/[0.08]"
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button
            className="rounded-full bg-[#103529] px-4 py-2.5 text-sm text-[#d8fff0] transition hover:bg-[#134232]"
            onClick={handleSubmit}
            type="button"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}

export function TasksPageView() {
  const { state } = useAppState();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const summary = useMemo(
    () => ({
      total: state.tasks.length,
      urgent: state.tasks.filter(isUrgent).length,
      completed: state.tasks.filter((task) => task.status === "done").length,
    }),
    [state.tasks],
  );

  return (
    <>
      <div className="h-full overflow-auto">
        <div className="space-y-6 px-4 py-5 xl:px-6 xl:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">AISana</div>
              <h1 className="mt-2 text-[2.4rem] font-semibold tracking-tight text-white">Задачи</h1>
              <div className="mt-2 text-sm text-[#8ea0a7]">Управление поручениями школы</div>
            </div>

            <button
              className="inline-flex items-center gap-2 rounded-full bg-[#103529] px-4 py-2.5 text-sm text-[#d8fff0] transition hover:bg-[#134232]"
              onClick={() => setIsCreateOpen(true)}
              type="button"
            >
              <Plus className="size-4" />
              Новая задача
            </button>
          </div>

          <TaskSummaryRow
            completed={summary.completed}
            total={summary.total}
            urgent={summary.urgent}
          />

          <TaskBoard onOpenTask={setSelectedTask} tasks={state.tasks} />
        </div>
      </div>

      {selectedTask ? <TaskDetailModal onClose={() => setSelectedTask(null)} task={selectedTask} /> : null}
      {isCreateOpen ? <CreateTaskModal onClose={() => setIsCreateOpen(false)} /> : null}
    </>
  );
}


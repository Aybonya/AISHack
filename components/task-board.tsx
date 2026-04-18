"use client";

import type { Task } from "@/lib/types";

import { TaskColumn } from "@/components/task-column";

const columns = [
  { key: "new", title: "Сегодня", emptyText: "Нет задач" },
  { key: "in_progress", title: "В процессе", emptyText: "Нет задач" },
  { key: "done", title: "Готово", emptyText: "Нет задач" },
] as const;

export function TaskBoard({
  tasks,
  onOpenTask,
}: {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1040px] gap-5 xl:min-w-0 xl:grid-cols-3">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.key);

          return (
            <TaskColumn
              count={columnTasks.length}
              emptyText={column.emptyText}
              key={column.key}
              onOpenTask={onOpenTask}
              tasks={columnTasks}
              title={column.title}
            />
          );
        })}
      </div>
    </div>
  );
}

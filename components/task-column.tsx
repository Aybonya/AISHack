"use client";

import type { Task } from "@/lib/types";

import { TaskCard } from "@/components/task-card";

export function TaskColumn({
  title,
  count,
  tasks,
  emptyText,
  onOpenTask,
}: {
  title: string;
  count: number;
  tasks: Task[];
  emptyText: string;
  onOpenTask: (task: Task) => void;
}) {
  return (
    <section className="min-w-[320px] rounded-[28px] bg-[#0f171c] px-4 py-4 xl:min-w-0">
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="text-lg font-semibold text-white">{title}</div>
        <div className="rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-[#9aaeb4]">
          {count}
        </div>
      </div>

      <div className="mt-4 h-px bg-white/[0.04]" />

      <div className="mt-4 space-y-3">
        {tasks.length > 0 ? (
          tasks.map((task) => <TaskCard key={task.id} onOpen={onOpenTask} task={task} />)
        ) : (
          <div className="px-2 py-10 text-sm text-[#61757d]">{emptyText}</div>
        )}
      </div>
    </section>
  );
}

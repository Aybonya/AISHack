import type { Task, User } from "@/lib/types";

export function generateTaskSummary(tasks: Task[], users: User[]) {
  if (tasks.length === 0) {
    return "Команда обработана, но задачи не удалось выделить уверенно.";
  }

  const names = tasks
    .map((task) => {
      const assignee = users.find((user) => user.id === task.assigneeUserId);
      return `${assignee?.name ?? "сотрудник"}: ${task.title.toLowerCase()}`;
    })
    .join("; ");

  return `${tasks.length} ${tasks.length === 1 ? "задача создана" : "задачи созданы"}: ${names}.`;
}

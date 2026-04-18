import type { ParsedTaskDraft, Task, User } from "@/lib/types";
import { createId, normalizeText } from "@/lib/utils";

export function matchUserByName(users: User[], assignee: string) {
  const normalizedAssignee = normalizeText(assignee);

  return (
    users.find((user) => normalizeText(user.name) === normalizedAssignee) ??
    users.find((user) =>
      normalizeText(user.name).includes(normalizedAssignee) ||
      normalizedAssignee.includes(normalizeText(user.name.split(" ")[0] ?? "")),
    )
  );
}

export function createTasksFromDrafts(
  drafts: ParsedTaskDraft[],
  users: User[],
  sourceMessageId: string,
  createdBy: string,
): Task[] {
  return drafts.flatMap((draft) => {
    const assignee = matchUserByName(users, draft.assignee);
    if (!assignee) {
      return [];
    }

    return [
      {
        id: createId("task"),
        title: draft.title,
        description: draft.description,
        assigneeUserId: assignee.id,
        createdBy,
        dueDate: draft.dueDate,
        status: "new",
        sourceMessageId,
      },
    ];
  });
}

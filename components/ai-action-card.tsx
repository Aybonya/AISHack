"use client";

import Link from "next/link";
import { ArrowRightLeft, BookOpenText, Check, ClipboardList, MapPin, Soup } from "lucide-react";

import { useAppState } from "@/components/providers/app-provider";
import type { MessageCardData } from "@/lib/types";
import { formatTime } from "@/lib/utils";

function CardShell({
  children,
  accent = "border-[#00a884]",
}: {
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={`rounded-[0.9rem] bg-[#202c33] px-4 py-3 shadow-[0_10px_20px_rgba(0,0,0,0.14)]`}>
      <div className={`border-l-4 ${accent} pl-3`}>{children}</div>
    </div>
  );
}

export function AIActionCard({
  card,
  chatId,
}: {
  card: MessageCardData;
  chatId: string;
}) {
  const { state, confirmSuggestion } = useAppState();

  if (card.cardType === "attendance") {
    return (
      <CardShell accent="border-[#25d366]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-medium text-[#25d366]">Сводка по питанию</div>
            <div className="mt-1 text-sm text-[#d5dee2]">{card.summary}</div>
          </div>
          <Soup className="size-4 text-[#25d366]" />
        </div>
        <div className="mt-3 flex gap-4 text-sm text-[#9fb0b7]">
          <div>{card.summaryState.totalMeals} порций</div>
          <div>{card.summaryState.totalAbsent} отсутствуют</div>
        </div>
      </CardShell>
    );
  }

  if (card.cardType === "incident") {
    return (
      <CardShell accent="border-[#ffb340]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-medium text-white">{card.title}</div>
            <div className="mt-1 text-sm text-[#d5dee2]">{card.summary}</div>
          </div>
          <MapPin className="size-4 text-[#ffb340]" />
        </div>
        <Link className="mt-3 inline-flex text-sm text-[#25d366] hover:text-[#61e394]" href="/incidents">
          Открыть инциденты
        </Link>
      </CardShell>
    );
  }

  if (card.cardType === "task") {
    const tasks = state.tasks.filter((task) => card.taskIds.includes(task.id));

    return (
      <CardShell accent="border-[#25d366]">
        <div className="flex items-start justify-between gap-3">
          <div className="text-base font-medium text-white">Задачи созданы:</div>
          <ClipboardList className="size-4 text-[#25d366]" />
        </div>
        <div className="mt-3 space-y-3">
          {tasks.map((task, index) => {
            const assignee = state.users.find((user) => user.id === task.assigneeUserId);
            return (
              <div className="flex gap-3" key={task.id}>
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-xs font-semibold text-[#081319]">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-base text-white">{assignee?.name ?? "Сотрудник"}</div>
                  <div className="mt-1 text-base text-[#dbe5e8]">{task.title}</div>
                  <div className="mt-1 text-sm text-[#9aacb5]">Срок: {formatTime(task.dueDate)}</div>
                </div>
              </div>
            );
          })}
        </div>
        <Link className="mt-4 inline-flex text-sm text-[#25d366] hover:text-[#61e394]" href="/tasks">
          Открыть задачи
        </Link>
      </CardShell>
    );
  }

  if (card.cardType === "substitution") {
    const candidate = state.users.find((user) => user.id === card.candidateUserId);

    return (
      <CardShell accent="border-[#25d366]">
        <div className="flex items-start justify-between gap-3">
          <div className="text-base font-medium text-[#25d366]">Найдена замена</div>
          <ArrowRightLeft className="size-4 text-[#25d366]" />
        </div>
        <div className="mt-3 space-y-2 text-sm text-[#d5dee2]">
          {card.affectedLessons.map((lesson) => (
            <div key={lesson.scheduleEntryId}>
              {lesson.className} класс • {lesson.subject} • {lesson.lessonNumber} урок
            </div>
          ))}
          <div>Замещающий: {candidate?.name ?? "Не найден"}</div>
          <div>Квалификация: {card.affectedLessons[0]?.subject ?? "Не указана"}</div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="rounded-[0.8rem] border border-white/[0.08] bg-[#111b21] px-4 py-2 text-sm text-white transition hover:bg-[#162127]"
            type="button"
          >
            Выбрать другую
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-[0.8rem] bg-[#1c9b50] px-4 py-2 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60"
            disabled={card.confirmed}
            onClick={() => confirmSuggestion(card.suggestionId, chatId)}
            type="button"
          >
            <Check className="size-4" />
            {card.confirmed ? "Подтверждено" : "Подтвердить"}
          </button>
        </div>
      </CardShell>
    );
  }

  if (card.cardType === "document") {
    return (
      <CardShell accent="border-[#25d366]">
        <div className="flex items-start justify-between gap-3">
          <div className="text-base font-medium text-white">{card.docTitle}</div>
          <BookOpenText className="size-4 text-[#25d366]" />
        </div>
        <div className="mt-3 space-y-2">
          {card.bullets.map((bullet) => (
            <div className="flex gap-2 text-sm text-[#d5dee2]" key={bullet}>
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#25d366]" />
              <span>{bullet}</span>
            </div>
          ))}
        </div>
      </CardShell>
    );
  }

  if (card.cardType === "cafeteria") {
    return (
      <CardShell accent="border-[#25d366]">
        <div className="text-base font-medium text-white">{card.title}</div>
        <div className="mt-1 text-sm text-[#d5dee2]">{card.summary}</div>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <div className="text-base font-medium text-white">{card.title}</div>
      <div className="mt-1 text-sm text-[#d5dee2]">{card.summary}</div>
    </CardShell>
  );
}

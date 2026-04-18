"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRightLeft,
  ClipboardList,
  MessageSquareText,
  Soup,
} from "lucide-react";

import { Panel } from "@/components/panel";
import { useAppState } from "@/components/providers/app-provider";
import { StatWidget } from "@/components/stat-widget";
import { TopBar } from "@/components/top-bar";
import { VoiceCommandInput } from "@/components/voice-command-input";
import { cn, formatTime, toIsoDate } from "@/lib/utils";

export function DashboardHome() {
  const { state, backendMode, backendError } = useAppState();
  const today = toIsoDate(new Date());
  const summary =
    state.cafeteriaSummaries.find((item) => item.date === today) ?? state.cafeteriaSummaries[0];
  const openIncidents = state.incidents.filter((incident) => incident.status !== "resolved");
  const activeTasks = state.tasks.filter((task) => task.status !== "done");
  const pendingSuggestions = state.substitutionSuggestions.filter(
    (suggestion) => suggestion.status === "suggested",
  );
  const feed = [...state.messages]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <TopBar
        action={
          <>
            <Link
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-foreground/80 transition hover:border-accent/30 hover:text-accent"
              href="/chats"
            >
              Открыть чат-центр
            </Link>
            <div
              className="rounded-full border border-accent/20 bg-accent-soft px-4 py-2 text-sm text-accent"
              title={backendError ?? undefined}
            >
              {backendMode === "live" ? "Live GreenAPI" : "Demo fallback"}
            </div>
          </>
        }
        subtitle="AI-вице-директор собирает сигналы из учительских чатов, превращает их в действия и держит директора в одном рабочем ритме."
        title="AISana — операционная панель директора"
      />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <StatWidget
          detail={`${summary?.reportedClasses.length ?? 0} классов уже отчитались`}
          icon={Soup}
          title="Питание сегодня"
          value={`${summary?.totalMeals ?? 0}`}
        />
        <StatWidget
          detail="Требуют внимания завхоза или администрации"
          icon={AlertTriangle}
          title="Активные инциденты"
          value={`${openIncidents.length}`}
        />
        <StatWidget
          detail="Новые и выполняемые поручения"
          icon={ClipboardList}
          title="Задачи в контуре"
          value={`${activeTasks.length}`}
        />
        <StatWidget
          detail="Ожидают подтверждения директора"
          icon={ArrowRightLeft}
          title="Замены на уроках"
          value={`${pendingSuggestions.length}`}
        />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="space-y-4">
          <VoiceCommandInput />
          <Panel className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Живой operational feed</div>
                <div className="text-sm text-muted">
                  Последние сообщения, подтверждения AISana и изменения по школе.
                </div>
              </div>
              <MessageSquareText className="size-5 text-accent" />
            </div>
            <div className="space-y-3">
              {feed.map((message) => {
                const sender = state.users.find((user) => user.id === message.senderId);
                return (
                  <div
                    className="rounded-[1.25rem] border border-white/6 bg-white/[0.03] px-4 py-3"
                    key={message.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-white">
                        {sender?.name ?? (message.senderType === "ai" ? "AISana" : "Система")}
                      </div>
                      <div className="text-xs text-muted">{formatTime(message.createdAt)}</div>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-foreground/80">{message.text}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <div
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                          message.senderType === "ai"
                            ? "bg-accent-soft text-accent"
                            : "bg-white/[0.05] text-muted",
                        )}
                      >
                        {message.parsedIntent === "substitution"
                          ? "замена"
                          : message.parsedIntent === "attendance"
                            ? "питание"
                            : message.parsedIntent === "incident"
                              ? "инцидент"
                              : message.parsedIntent === "task"
                                ? "задача"
                                : "контекст"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="space-y-4">
            <div>
              <div className="text-sm font-medium text-white">Что требует решения сейчас</div>
              <div className="text-sm text-muted">
                Короткий список вещей, которые AISana уже подняла наверх.
              </div>
            </div>

            <div className="space-y-3">
              {pendingSuggestions.length > 0 ? (
                pendingSuggestions.map((suggestion) => {
                  const teacher = state.users.find((user) => user.id === suggestion.teacherUserId);
                  const candidate = state.users.find((user) => user.id === suggestion.candidateUserId);

                  return (
                    <div
                      className="rounded-[1.25rem] border border-accent/20 bg-accent-soft/60 px-4 py-3"
                      key={suggestion.id}
                    >
                      <div className="text-sm font-medium text-white">
                        Замена для {teacher?.name ?? "учителя"}
                      </div>
                      <div className="mt-1 text-sm text-foreground/80">{suggestion.explanation}</div>
                      <div className="mt-2 text-xs text-accent">
                        Кандидат: {candidate?.name ?? "не найден"}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[1.25rem] border border-white/6 bg-white/[0.03] px-4 py-3 text-sm text-muted">
                  Пока нет активных предложений по заменам. Отсутствия будут обработаны прямо из чата.
                </div>
              )}

              {openIncidents.slice(0, 2).map((incident) => (
                <div
                  className="rounded-[1.25rem] border border-amber-500/10 bg-amber-500/5 px-4 py-3"
                  key={incident.id}
                >
                  <div className="text-sm font-medium text-white">{incident.title}</div>
                  <div className="mt-1 text-sm text-foreground/80">{incident.location}</div>
                </div>
              ))}

              <div className="rounded-[1.25rem] border border-white/6 bg-white/[0.03] px-4 py-3">
                <div className="text-sm font-medium text-white">Питание</div>
                <div className="mt-1 text-sm text-foreground/80">
                  Не хватает отчетов от классов: {summary?.missingClasses.join(", ") || "все сдали"}.
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="space-y-3">
            <div className="text-sm font-medium text-white">Быстрые маршруты</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                className="rounded-[1.25rem] border border-white/6 bg-white/[0.03] px-4 py-4 text-sm text-foreground/80 transition hover:border-accent/30 hover:text-accent"
                href="/tasks"
              >
                Задачи и исполнители
              </Link>
              <Link
                className="rounded-[1.25rem] border border-white/6 bg-white/[0.03] px-4 py-4 text-sm text-foreground/80 transition hover:border-accent/30 hover:text-accent"
                href="/incidents"
              >
                Инциденты и статус ремонта
              </Link>
              <Link
                className="rounded-[1.25rem] border border-white/6 bg-white/[0.03] px-4 py-4 text-sm text-foreground/80 transition hover:border-accent/30 hover:text-accent"
                href="/schedule"
              >
                Расписание и замены
              </Link>
              <Link
                className="rounded-[1.25rem] border border-white/6 bg-white/[0.03] px-4 py-4 text-sm text-foreground/80 transition hover:border-accent/30 hover:text-accent"
                href="/documents"
              >
                Документы и приказы
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

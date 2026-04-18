"use client";

import Link from "next/link";
import { AlertTriangle, ClipboardList, FileText, Soup } from "lucide-react";
import { useTransition } from "react";

import { useAppState } from "@/components/providers/app-provider";
import { getWeekdayIndex, toIsoDate } from "@/lib/utils";

export function InsightsRail() {
  const { state, sendCafeteriaSummary, askDocument } = useAppState();
  const [isPending, startTransition] = useTransition();
  const today = toIsoDate(new Date());
  const weekday = getWeekdayIndex(today);
  const todaySummary =
    state.cafeteriaSummaries.find((item) => item.date === today) ?? state.cafeteriaSummaries[0];
  const openIncidents = state.incidents.filter((incident) => incident.status !== "resolved");
  const todayTasks = state.tasks.filter((task) => task.dueDate.slice(0, 10) === today);
  const todaySchedule = state.scheduleEntries
    .filter((entry) => entry.weekday === weekday)
    .sort((left, right) => left.lessonNumber - right.lessonNumber)
    .slice(0, 4);
  const latestDocAnswer = state.documentAnswers[0] ?? null;

  return (
    <div className="flex h-full flex-col bg-[#111b21]">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <div className="text-[1.4rem] font-medium text-white">Сведения</div>
        <div className="mt-1 text-sm text-[#9db0b6]">Операционный сайдбар директора</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          <div className="rounded-2xl bg-[#202c33] p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-[#25d366]">
                <Soup className="size-5" />
              </div>
              <div>
                <div className="text-sm text-[#a8b6bb]">Питание</div>
                <div className="mt-2 flex items-end gap-6">
                  <div>
                    <div className="text-[2rem] font-semibold leading-none text-white">
                      {todaySummary?.totalMeals ?? 0}
                    </div>
                    <div className="mt-1 text-sm text-[#9aacb5]">порций</div>
                  </div>
                  <div>
                    <div className="text-[2rem] font-semibold leading-none text-white">
                      {todaySummary?.totalAbsent ?? 0}
                    </div>
                    <div className="mt-1 text-sm text-[#9aacb5]">отсутствуют</div>
                  </div>
                </div>
                <button
                  className="mt-4 text-sm text-[#25d366] transition hover:text-[#63e091]"
                  onClick={sendCafeteriaSummary}
                  type="button"
                >
                  Отправить в столовую
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#202c33] p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-[#ffb340]">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <div className="text-[2rem] font-semibold leading-none text-white">{openIncidents.length}</div>
                <div className="mt-1 text-base text-white">Инциденты требуют внимания</div>
                <Link className="mt-3 inline-flex text-sm text-[#25d366] hover:text-[#63e091]" href="/incidents">
                  Посмотреть
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#202c33] p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-[#25d366]">
                <ClipboardList className="size-5" />
              </div>
              <div>
                <div className="text-[2rem] font-semibold leading-none text-white">{todayTasks.length}</div>
                <div className="mt-1 text-base text-white">Задачи на сегодня</div>
                <Link className="mt-3 inline-flex text-sm text-[#25d366] hover:text-[#63e091]" href="/tasks">
                  Открыть список
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#202c33] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-medium text-white">Расписание</div>
              <Link className="text-sm text-[#25d366] hover:text-[#63e091]" href="/schedule">
                Открыть
              </Link>
            </div>
            <div className="space-y-3">
              {todaySchedule.map((entry) => (
                <div className="border-b border-white/[0.06] pb-3 last:border-b-0 last:pb-0" key={entry.id}>
                  <div className="text-sm text-white">{entry.lessonNumber} урок</div>
                  <div className="mt-1 text-base text-[#dbe4e7]">
                    {entry.className} {entry.subject}
                  </div>
                  <div className="mt-1 text-sm text-[#9aacb5]">
                    {entry.startTime} - {entry.endTime}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#202c33] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-medium text-white">Документы и приказы</div>
              <Link className="text-sm text-[#25d366] hover:text-[#63e091]" href="/documents">
                Спросить AI
              </Link>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 text-[#25d366]">
                <FileText className="size-5" />
              </div>
              <div>
                <div className="text-base font-medium text-white">Приказ МОН РК №130</div>
                <div className="mt-1 text-sm text-[#9aacb5]">Объяснение простыми словами</div>
              </div>
            </div>

            {latestDocAnswer ? (
              <div className="mt-4 space-y-2">
                {latestDocAnswer.bullets.slice(0, 2).map((bullet) => (
                  <div className="flex gap-2 text-sm text-[#d5dee2]" key={bullet}>
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#25d366]" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <button
              className="mt-4 w-full rounded-[0.85rem] bg-[#2a3942] px-4 py-3 text-base text-white transition hover:bg-[#33454f] disabled:opacity-60"
              disabled={isPending}
              onClick={() =>
                startTransition(() => {
                  askDocument("Объясни приказ простыми словами");
                })
              }
              type="button"
            >
              {isPending ? "Обрабатываю..." : "Объяснить простыми словами"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

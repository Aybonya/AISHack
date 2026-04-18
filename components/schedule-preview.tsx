"use client";

import { ArrowRightLeft, Clock3 } from "lucide-react";

import { Panel } from "@/components/panel";
import { useAppState } from "@/components/providers/app-provider";
import { getWeekdayIndex } from "@/lib/utils";

export function SchedulePreview() {
  const { state } = useAppState();
  const weekday = getWeekdayIndex(new Date().toISOString().slice(0, 10));
  const entries = state.scheduleEntries
    .filter((entry) => entry.weekday === weekday)
    .sort((left, right) => left.lessonNumber - right.lessonNumber)
    .slice(0, 5);

  return (
    <Panel className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-white">Расписание на сегодня</div>
          <div className="text-sm text-muted">Текущие уроки и замены</div>
        </div>
        <div className="rounded-full border border-border px-3 py-1 text-xs text-muted">
          {entries.length} уроков
        </div>
      </div>
      <div className="space-y-3">
        {entries.map((entry) => {
          const teacher = state.users.find((user) => user.id === entry.teacherUserId);
          const substitute = state.users.find((user) => user.id === entry.substituteUserId);
          return (
            <div
              className="rounded-2xl border border-white/6 bg-white/[0.03] p-3"
              key={entry.id}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-white">
                  {entry.className} • {entry.subject}
                </div>
                <div className="text-xs text-muted">
                  {entry.startTime} – {entry.endTime}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-sm text-foreground/75">
                <div className="inline-flex items-center gap-2">
                  <Clock3 className="size-4 text-accent" />
                  {teacher?.name ?? "Без учителя"}
                </div>
                {substitute ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs text-accent">
                    <ArrowRightLeft className="size-3.5" />
                    Замена: {substitute.name}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

"use client";

import { CalendarRange } from "lucide-react";

import { Panel } from "@/components/panel";
import { useAppState } from "@/components/providers/app-provider";
import { WEEKDAY_LABELS, getWeekdayIndex } from "@/lib/utils";

export function ScheduleBoard() {
  const { state } = useAppState();
  const todayWeekday = getWeekdayIndex(new Date().toISOString().slice(0, 10));

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, index) => index + 1).map((weekday) => {
        const entries = state.scheduleEntries
          .filter((entry) => entry.weekday === weekday)
          .sort((left, right) => left.lessonNumber - right.lessonNumber);

        return (
          <Panel
            className={weekday === todayWeekday ? "border-accent/30 bg-[#0d171a]" : undefined}
            key={weekday}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-white">{WEEKDAY_LABELS[weekday - 1]}</div>
                <div className="text-sm text-muted">{entries.length} уроков</div>
              </div>
              <CalendarRange className="size-5 text-accent" />
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
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {entry.lessonNumber} урок • {entry.className}
                        </div>
                        <div className="mt-1 text-sm text-foreground/80">{entry.subject}</div>
                      </div>
                      <div className="text-xs text-muted">
                        {entry.startTime} – {entry.endTime}
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-muted">
                      {substitute ? (
                        <span className="text-accent">
                          {teacher?.name} → {substitute.name}
                        </span>
                      ) : (
                        teacher?.name ?? "Не назначено"
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted">Кабинет {entry.room}</div>
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

"use client";

import { ChevronLeft, ChevronRight, Clock3, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useAppState } from "@/components/providers/app-provider";
import type { AppState } from "@/lib/types";
import { cn } from "@/lib/utils";

const START_HOUR = 7;
const END_HOUR = 18;
const HOUR_HEIGHT = 72;

const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WEEKDAY_LONG = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

type CalendarEventKind = "lesson" | "substitution" | "meeting";

type CalendarEvent = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  teacher: string;
  className: string;
  room: string;
  weekday: number;
  startTime: string;
  endTime: string;
  kind: CalendarEventKind;
  badge?: string;
};

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function shortTeacherName(name: string) {
  return name.split(" ")[0] ?? name;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function buildWeekDates(anchorDate: Date) {
  const weekStart = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function buildCalendarEvents(state: AppState): CalendarEvent[] {
  const picks = [
    { weekday: 1, className: "3В", subject: "Математика" },
    { weekday: 2, className: "2Б", subject: "Английский" },
    { weekday: 3, className: "1А", subject: "Начальные классы" },
    { weekday: 4, className: "7А", subject: "История" },
    { weekday: 5, className: "3В", subject: "Математика" },
  ];

  const events: CalendarEvent[] = picks
    .map((pick) =>
      state.scheduleEntries.find(
        (entry) =>
          entry.weekday === pick.weekday &&
          entry.className === pick.className &&
          entry.subject === pick.subject,
      ),
    )
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => {
      const teacher = state.users.find((user) => user.id === entry.teacherUserId);
      const substitute = state.users.find((user) => user.id === entry.substituteUserId);
      const isSubstitution = Boolean(substitute && entry.substitutionStatus === "confirmed");

      return {
        id: entry.id,
        title: entry.className,
        detail: entry.subject,
        meta: isSubstitution
          ? `Замещает ${shortTeacherName(substitute?.name ?? "учитель")}`
          : shortTeacherName(teacher?.name ?? "Учитель"),
        teacher: isSubstitution
          ? `${teacher?.name ?? "Учитель"} -> ${substitute?.name ?? "замещает"}`
          : teacher?.name ?? "Преподаватель не назначен",
        className: entry.className,
        room: entry.room,
        weekday: entry.weekday,
        startTime: entry.startTime,
        endTime: entry.endTime,
        kind: isSubstitution ? "substitution" : "lesson",
        badge: isSubstitution ? "Замена" : undefined,
      };
    });

  const director = state.users.find((user) => user.role === "director");
  events.push({
    id: "calendar-meeting",
    title: "Собрание",
    detail: "Директор и кураторы",
    meta: "Администрация",
    teacher: director?.name ?? "Жанар С.",
    className: "Администрация",
    room: "Переговорная",
    weekday: 4,
    startTime: "15:00",
    endTime: "15:45",
    kind: "meeting",
  });

  const weekendEntry = state.scheduleEntries.find(
    (entry) => entry.weekday > 5 && entry.className === "8Б" && entry.subject === "Информатика",
  );

  if (weekendEntry) {
    const teacher = state.users.find((user) => user.id === weekendEntry.teacherUserId);
    events.push({
      id: weekendEntry.id,
      title: weekendEntry.className,
      detail: weekendEntry.subject,
      meta: shortTeacherName(teacher?.name ?? "Учитель"),
      teacher: teacher?.name ?? "Преподаватель",
      className: weekendEntry.className,
      room: weekendEntry.room,
      weekday: weekendEntry.weekday,
      startTime: weekendEntry.startTime,
      endTime: weekendEntry.endTime,
      kind: "lesson",
    });
  }

  return events.sort((left, right) => {
    if (left.weekday !== right.weekday) {
      return left.weekday - right.weekday;
    }

    return timeToMinutes(left.startTime) - timeToMinutes(right.startTime);
  });
}

function CalendarMiniMonth({
  anchorDate,
  weekDates,
  selectedDate,
  onSelectDate,
  onShiftMonth,
}: {
  anchorDate: Date;
  weekDates: Date[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onShiftMonth: (direction: number) => void;
}) {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const monthOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const totalCells = Math.ceil((monthOffset + monthEnd.getDate()) / 7) * 7;
  const weekKeys = new Set(weekDates.map(toLocalDateKey));
  const selectedKey = toLocalDateKey(selectedDate);
  const todayKey = toLocalDateKey(new Date());

  return (
    <div className="flex h-full flex-col gap-5 border-r border-white/[0.06] px-5 py-5">
      <div className="rounded-[24px] border border-white/[0.05] bg-[#10181d] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">Календарь</div>
            <div className="mt-2 text-[1.75rem] font-semibold leading-[1.08] text-white">
              {formatMonthLabel(anchorDate)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex size-10 items-center justify-center rounded-full border border-white/[0.06] bg-[#0d1519] text-[#9aaeb4] transition hover:border-white/[0.1] hover:text-white"
              onClick={() => onShiftMonth(-1)}
              type="button"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              className="flex size-10 items-center justify-center rounded-full border border-white/[0.06] bg-[#0d1519] text-[#9aaeb4] transition hover:border-white/[0.1] hover:text-white"
              onClick={() => onShiftMonth(1)}
              type="button"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 mb-4 grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.16em] text-[#6d7c82]">
          {WEEKDAY_SHORT.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: totalCells }, (_, index) => {
            const cellDate = addDays(monthStart, index - monthOffset);
            const cellKey = toLocalDateKey(cellDate);
            const isCurrentMonth = cellDate.getMonth() === anchorDate.getMonth();
            const isSelected = cellKey === selectedKey;
            const isToday = cellKey === todayKey;
            const isInWeek = weekKeys.has(cellKey);

            return (
              <button
                className={cn(
                  "flex aspect-square items-center justify-center rounded-full text-sm transition",
                  !isCurrentMonth && "text-[#435158]",
                  isCurrentMonth && "text-[#cbd5d9]",
                  isInWeek && "bg-[#0f1b17]",
                  isToday && "border border-[#25d366]/40",
                  isSelected && "bg-[#123125] text-white shadow-[0_0_0_1px_rgba(37,211,102,0.25)]",
                )}
                key={cellKey}
                onClick={() => onSelectDate(cellDate)}
                type="button"
              >
                {cellDate.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
          <div className="text-sm text-[#8fa2a8]">{formatDayLabel(new Date())}</div>
          <button
            className="rounded-full border border-[#1a4a38] bg-[#10271f] px-3 py-1.5 text-sm text-[#d8fff0] transition hover:bg-[#123125]"
            onClick={() => onSelectDate(new Date())}
            type="button"
          >
            Сегодня
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarEventModal({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const styleMap = {
    lesson: "border-[#20483a] bg-[#13211c]",
    substitution: "border-[#1d7b59] bg-[#113328]",
    meeting: "border-[#2a5561] bg-[#132129]",
  } satisfies Record<CalendarEventKind, string>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div
        className={cn(
          "w-full max-w-md rounded-[28px] border p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
          styleMap[event.kind],
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#8fb9aa]">Детали события</div>
            <div className="mt-2 text-2xl font-semibold text-white">{event.title}</div>
            <div className="mt-2 text-base text-[#c6d3d8]">{event.detail}</div>
          </div>
          <button
            className="flex size-10 items-center justify-center rounded-full bg-white/[0.05] text-[#d7e3e7] transition hover:bg-white/[0.08] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 space-y-3 text-sm text-[#c6d3d8]">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-[#25d366]" />
            {event.startTime} - {event.endTime}
          </div>
          <div>Класс: {event.className}</div>
          <div>Учитель: {event.teacher}</div>
          <div>Кабинет: {event.room}</div>
          <div className="text-[#95aaae]">{event.meta}</div>
        </div>
      </div>
    </div>
  );
}

export function CalendarWeekView() {
  const { state } = useAppState();
  const today = new Date();
  const [anchorDate, setAnchorDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const weekDates = useMemo(() => buildWeekDates(anchorDate), [anchorDate]);
  const events = useMemo(() => buildCalendarEvents(state), [state]);
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);
  const dayHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const selectedKey = toLocalDateKey(selectedDate);
  const todayKey = toLocalDateKey(today);

  function selectDate(date: Date) {
    setAnchorDate(date);
    setSelectedDate(date);
  }

  function shiftWeek(direction: number) {
    setAnchorDate((current) => addDays(current, direction * 7));
    setSelectedDate((current) => addDays(current, direction * 7));
  }

  function shiftMonth(direction: number) {
    setAnchorDate((current) => addMonths(current, direction));
    setSelectedDate((current) => addMonths(current, direction));
  }

  return (
    <>
      <div className="flex h-full min-h-0 bg-[#0b141a]">
        <aside className="hidden w-[320px] shrink-0 2xl:block">
          <CalendarMiniMonth
            anchorDate={anchorDate}
            onSelectDate={selectDate}
            onShiftMonth={shiftMonth}
            selectedDate={selectedDate}
            weekDates={weekDates}
          />
        </aside>

        <section className="min-w-0 flex-1 overflow-auto px-4 py-5 xl:px-6 xl:py-6">
          <div className="min-w-[980px] rounded-[30px] border border-white/[0.05] bg-[#10181d]">
            <div className="grid grid-cols-[72px_repeat(7,minmax(140px,1fr))] border-b border-white/[0.05]">
              <div className="border-r border-white/[0.05] px-3 py-4 text-[11px] uppercase tracking-[0.24em] text-[#607277]">
                <div className="flex items-center justify-between gap-2">
                  <span>Week</span>
                  <div className="flex items-center gap-1">
                    <button
                      className="flex size-8 items-center justify-center rounded-full text-[#8ea1a7] transition hover:bg-white/[0.04] hover:text-white"
                      onClick={() => shiftWeek(-1)}
                      type="button"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      className="flex size-8 items-center justify-center rounded-full text-[#8ea1a7] transition hover:bg-white/[0.04] hover:text-white"
                      onClick={() => shiftWeek(1)}
                      type="button"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              </div>

              {weekDates.map((date, index) => {
                const dateKey = toLocalDateKey(date);
                const isSelected = dateKey === selectedKey;
                const isToday = dateKey === todayKey;

                return (
                  <div
                    className={cn(
                      "border-r border-white/[0.05] px-4 py-4 last:border-r-0",
                      isSelected && "bg-[#0f1b17]",
                      !isSelected && isToday && "bg-[#0d1714]",
                    )}
                    key={dateKey}
                  >
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#6d7c82]">
                      {WEEKDAY_LONG[index]}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">{date.getDate()}</div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-[72px_1fr]">
              <div className="relative border-r border-white/[0.05]" style={{ height: dayHeight }}>
                {hours.map((hour) => (
                  <div
                    className="absolute inset-x-0 -translate-y-1/2 px-3 text-xs text-[#5f6f75]"
                    key={hour}
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                  >
                    {`${hour}:00`}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {weekDates.map((date, index) => {
                  const dateKey = toLocalDateKey(date);
                  const isSelected = dateKey === selectedKey;
                  const isToday = dateKey === todayKey;
                  const dayEvents = events.filter((event) => event.weekday === index + 1);

                  return (
                    <div
                      className={cn(
                        "relative border-r border-white/[0.05] last:border-r-0",
                        isSelected && "bg-[#0d1815]",
                        !isSelected && isToday && "bg-[#0c1512]",
                      )}
                      key={dateKey}
                      style={{ height: dayHeight }}
                    >
                      {hours.map((hour) => (
                        <div
                          className="absolute inset-x-0 border-t border-white/[0.035]"
                          key={hour}
                          style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                        />
                      ))}

                      {dayEvents.map((event) => {
                        const startMinutes = timeToMinutes(event.startTime);
                        const endMinutes = timeToMinutes(event.endTime);
                        const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT + 10;
                        const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT - 18, 84);
                        const cardStyles = {
                          lesson: "border-[#214536] bg-[#122019] hover:bg-[#162a21]",
                          substitution: "border-[#1f7c59] bg-[#123226] hover:bg-[#184034]",
                          meeting: "border-[#31596b] bg-[#15242d] hover:bg-[#1a2d38]",
                        } satisfies Record<CalendarEventKind, string>;

                        return (
                          <button
                            className={cn(
                              "absolute left-2.5 right-2.5 flex flex-col overflow-hidden rounded-[18px] border px-4 py-3 text-left shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition",
                              cardStyles[event.kind],
                            )}
                            key={event.id}
                            onClick={() => setSelectedEvent(event)}
                            style={{ height, top }}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-[15px] font-semibold leading-5 text-white">{event.title}</div>
                              {event.badge ? (
                                <span className="rounded-full border border-[#2aa573]/40 bg-[#0d241c] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#81f0bf]">
                                  {event.badge}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-[13px] leading-5 text-[#ebf1f3]">{event.detail}</div>
                            <div className="mt-auto pt-3 text-xs font-medium text-[#d0dadd]">
                              {event.startTime} - {event.endTime}
                            </div>
                            <div className="mt-1 truncate text-xs leading-5 text-[#9fb3b9]">{event.meta}</div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      {selectedEvent ? <CalendarEventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} /> : null}
    </>
  );
}

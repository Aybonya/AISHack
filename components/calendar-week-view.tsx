"use client";

import { CalendarPlus2, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, X, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useAppState } from "@/components/providers/app-provider";
import type { AppState } from "@/lib/types";
import { cn } from "@/lib/utils";

const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_HEIGHT = 72;

const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WEEKDAY_LONG = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

type CalendarEventKind = "lesson" | "substitution" | "director_event";

type CalendarEvent = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  owner: string;
  room: string;
  startTime: string;
  endTime: string;
  kind: CalendarEventKind;
  dateKey: string;
  badge?: string;
  notes?: string;
};

type NewEventForm = {
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  room: string;
  description: string;
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

function buildWeekDates(anchorDate: Date) {
  const weekStart = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function shortTeacherName(name: string) {
  return name.split(" ")[0] ?? name;
}

function buildDefaultEventForm(date: Date): NewEventForm {
  return {
    title: "",
    eventDate: toLocalDateKey(date),
    startTime: "10:00",
    endTime: "10:45",
    room: "",
    description: "",
  };
}

function buildCalendarEvents(state: AppState, weekDates: Date[]): CalendarEvent[] {
  const weekKeys = new Set(weekDates.map(toLocalDateKey));
  const weekdayToDateKey = new Map<number, string>();

  weekDates.forEach((date, index) => {
    weekdayToDateKey.set(index + 1, toLocalDateKey(date));
  });

  const lessonEvents: CalendarEvent[] = [];

  const directorEvents = state.scheduleEntries
    .filter((entry) => entry.entryType === "event" && entry.date && weekKeys.has(entry.date))
    .map((entry) => ({
      id: entry.id,
      title: entry.subject,
      detail: entry.notes?.trim() || "Событие директора",
      meta: "Личное расписание директора",
      owner: "Директор",
      room: entry.room || "Уточняется",
      startTime: entry.startTime,
      endTime: entry.endTime,
      kind: "director_event" as const,
      dateKey: entry.date!,
      badge: "В расписании",
      notes: entry.notes,
    }));

  return [...lessonEvents, ...directorEvents].sort((left, right) => {
    if (left.dateKey !== right.dateKey) {
      return left.dateKey.localeCompare(right.dateKey);
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
  onCreateEvent,
}: {
  anchorDate: Date;
  weekDates: Date[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onShiftMonth: (direction: number) => void;
  onCreateEvent: () => void;
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
            <div className="mt-2 text-[1.75rem] font-semibold leading-[1.08] text-white">{formatMonthLabel(anchorDate)}</div>
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

        <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.05] pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-[#8fa2a8]">{formatDayLabel(new Date())}</div>
            <button
              className="rounded-full border border-[#1a4a38] bg-[#10271f] px-3 py-1.5 text-sm text-[#d8fff0] transition hover:bg-[#123125]"
              onClick={() => onSelectDate(new Date())}
              type="button"
            >
              Сегодня
            </button>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#5d46d8]/30 bg-[#191127] px-4 py-2.5 text-sm font-medium text-[#efe8ff] transition hover:border-[#7d63ff]/40 hover:bg-[#211538]"
            onClick={onCreateEvent}
            type="button"
          >
            <Plus className="size-4" />
            Добавить директору
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
    director_event: "border-[#6f4cff] bg-[#1a1330]",
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
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#b7a8ff]">Детали события</div>
            <div className="mt-2 text-2xl font-semibold text-white">{event.title}</div>
            <div className="mt-2 text-base text-[#d6d1ec]">{event.detail}</div>
          </div>
          <button
            className="flex size-10 items-center justify-center rounded-full bg-white/[0.05] text-[#d7e3e7] transition hover:bg-white/[0.08] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 space-y-3 text-sm text-[#d6d1ec]">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-[#9a7cff]" />
            {event.startTime} - {event.endTime}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-[#9a7cff]" />
            {event.room}
          </div>
          <div>Ответственный: {event.owner}</div>
          <div className="text-[#b9acd9]">{event.meta}</div>
          {event.notes ? <div className="rounded-2xl bg-white/[0.05] px-4 py-3 text-[#efe8ff]">{event.notes}</div> : null}
        </div>
      </div>
    </div>
  );
}

function CreateEventModal({
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  form: NewEventForm;
  onChange: (patch: Partial<NewEventForm>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[30px] border border-[#7257ff]/25 bg-[#130f1f] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#9c8fe0]">Личное расписание директора</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Добавить событие</h2>
            <p className="mt-2 text-sm text-[#bfb4df]">
              Это событие появится в календаре директора и будет доступно для дальнейшей работы через AISana.
            </p>
          </div>
          <button
            className="flex size-10 items-center justify-center rounded-full bg-white/[0.05] text-[#ddd2ff] transition hover:bg-white/[0.08] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm text-[#d6cfff]">Название</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-[#1b1530] px-4 py-3 text-white outline-none transition placeholder:text-[#7d72a4] focus:border-[#8f76ff]"
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="Например: встреча с родителями 7А"
              type="text"
              value={form.title}
            />
          </label>

          <label>
            <span className="mb-2 block text-sm text-[#d6cfff]">Дата</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-[#1b1530] px-4 py-3 text-white outline-none transition focus:border-[#8f76ff]"
              onChange={(event) => onChange({ eventDate: event.target.value })}
              type="date"
              value={form.eventDate}
            />
          </label>

          <label>
            <span className="mb-2 block text-sm text-[#d6cfff]">Место</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-[#1b1530] px-4 py-3 text-white outline-none transition placeholder:text-[#7d72a4] focus:border-[#8f76ff]"
              onChange={(event) => onChange({ room: event.target.value })}
              placeholder="Кабинет директора / Zoom / актовый зал"
              type="text"
              value={form.room}
            />
          </label>

          <label>
            <span className="mb-2 block text-sm text-[#d6cfff]">Начало</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-[#1b1530] px-4 py-3 text-white outline-none transition focus:border-[#8f76ff]"
              onChange={(event) => onChange({ startTime: event.target.value })}
              type="time"
              value={form.startTime}
            />
          </label>

          <label>
            <span className="mb-2 block text-sm text-[#d6cfff]">Конец</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-[#1b1530] px-4 py-3 text-white outline-none transition focus:border-[#8f76ff]"
              onChange={(event) => onChange({ endTime: event.target.value })}
              type="time"
              value={form.endTime}
            />
          </label>

          <label className="md:col-span-2">
            <span className="mb-2 block text-sm text-[#d6cfff]">Описание</span>
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-[#1b1530] px-4 py-3 text-white outline-none transition placeholder:text-[#7d72a4] focus:border-[#8f76ff]"
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder="Можно добавить, что именно нужно обсудить или подготовить."
              value={form.description}
            />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-[#d2caef] transition hover:border-white/20 hover:text-white"
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[#7d63ff]/35 bg-[#6a4fff] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#765cff]"
            onClick={onSubmit}
            type="button"
          >
            <CalendarPlus2 className="size-4" />
            Добавить в расписание
          </button>
        </div>
      </div>
    </div>
  );
}

export function CalendarWeekView() {
  const { state, createScheduleEvent, clearScheduleEvents } = useAppState();
  const today = new Date();
  const [anchorDate, setAnchorDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newEventForm, setNewEventForm] = useState<NewEventForm>(() => buildDefaultEventForm(today));

  const weekDates = useMemo(() => buildWeekDates(anchorDate), [anchorDate]);
  const events = useMemo(() => buildCalendarEvents(state, weekDates), [state, weekDates]);
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);
  const dayHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const selectedKey = toLocalDateKey(selectedDate);
  const todayKey = toLocalDateKey(today);

  function selectDate(date: Date) {
    setAnchorDate(date);
    setSelectedDate(date);
    setNewEventForm((current) => ({
      ...current,
      eventDate: toLocalDateKey(date),
    }));
  }

  function shiftWeek(direction: number) {
    setAnchorDate((current) => addDays(current, direction * 7));
    setSelectedDate((current) => addDays(current, direction * 7));
  }

  function shiftMonth(direction: number) {
    setAnchorDate((current) => addMonths(current, direction));
    setSelectedDate((current) => addMonths(current, direction));
  }

  function openCreateModal(date = selectedDate) {
    setNewEventForm(buildDefaultEventForm(date));
    setIsCreateOpen(true);
  }

  function handleCreateEvent() {
    if (!newEventForm.title.trim()) {
      return;
    }

    createScheduleEvent({
      title: newEventForm.title,
      description: newEventForm.description,
      eventDate: newEventForm.eventDate,
      startTime: newEventForm.startTime,
      endTime: newEventForm.endTime,
      room: newEventForm.room,
    });

    setSelectedDate(new Date(`${newEventForm.eventDate}T12:00:00`));
    setAnchorDate(new Date(`${newEventForm.eventDate}T12:00:00`));
    setIsCreateOpen(false);
  }

  return (
    <>
      <div className="flex h-full min-h-0 bg-[#0b141a]">
        <aside className="hidden w-[320px] shrink-0 2xl:block">
          <CalendarMiniMonth
            anchorDate={anchorDate}
            onCreateEvent={() => openCreateModal(selectedDate)}
            onSelectDate={selectDate}
            onShiftMonth={shiftMonth}
            selectedDate={selectedDate}
            weekDates={weekDates}
          />
        </aside>

        <section className="min-w-0 flex-1 overflow-auto px-4 py-5 xl:px-6 xl:py-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">Расписание директора</div>
              <h1 className="mt-2 text-3xl font-semibold text-white">Календарь недели</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-transparent px-4 py-2.5 text-sm font-medium text-[#9fb0b6] transition hover:border-white/[0.15] hover:bg-white/[0.04] hover:text-white"
                onClick={() => {
                  if (confirm("Вы уверены, что хотите очистить все личные события в этом календаре?")) {
                    clearScheduleEvents();
                  }
                }}
                type="button"
              >
                <Trash2 className="size-4" />
                Очистить календарь
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[#7d63ff]/30 bg-[#171129] px-4 py-2.5 text-sm font-medium text-[#efe8ff] transition hover:border-[#9a86ff]/45 hover:bg-[#21183a]"
                onClick={() => openCreateModal(selectedDate)}
                type="button"
              >
                <Plus className="size-4" />
                Добавить в расписание
              </button>
            </div>
          </div>

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
                  <button
                    className={cn(
                      "border-r border-white/[0.05] px-4 py-4 text-left transition last:border-r-0",
                      isSelected && "bg-[#0f1b17]",
                      !isSelected && isToday && "bg-[#0d1714]",
                    )}
                    key={dateKey}
                    onClick={() => selectDate(date)}
                    type="button"
                  >
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#6d7c82]">{WEEKDAY_LONG[index]}</div>
                    <div className="mt-2 text-lg font-semibold text-white">{date.getDate()}</div>
                  </button>
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
                {weekDates.map((date) => {
                  const dateKey = toLocalDateKey(date);
                  const isSelected = dateKey === selectedKey;
                  const isToday = dateKey === todayKey;
                  const dayEvents = events.filter((event) => event.dateKey === dateKey);

                  return (
                    <div
                      className={cn(
                        "relative border-r border-white/[0.05] text-left last:border-r-0",
                        isSelected && "bg-[#0d1815]",
                        !isSelected && isToday && "bg-[#0c1512]",
                      )}
                      key={dateKey}
                      onClick={() => selectDate(date)}
                      style={{ height: dayHeight }}
                    >
                      {hours.map((hour) => (
                        <div
                          className="pointer-events-none absolute inset-x-0 border-t border-white/[0.035]"
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
                          director_event: "border-[#7759ff] bg-[#1f1738] hover:bg-[#271d45]",
                        } satisfies Record<CalendarEventKind, string>;

                        return (
                          <button
                            className={cn(
                              "absolute left-2.5 right-2.5 flex flex-col overflow-hidden rounded-[18px] border px-4 py-3 text-left shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition",
                              cardStyles[event.kind],
                            )}
                            key={event.id}
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation();
                              setSelectedEvent(event);
                            }}
                            style={{ height, top }}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-[15px] font-semibold leading-5 text-white">{event.title}</div>
                              {event.badge ? (
                                <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#f4efff]">
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
      {isCreateOpen ? (
        <CreateEventModal
          form={newEventForm}
          onChange={(patch) => setNewEventForm((current) => ({ ...current, ...patch }))}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={handleCreateEvent}
        />
      ) : null}
    </>
  );
}

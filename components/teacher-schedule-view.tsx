"use client";

import { useMemo, useState } from "react";
import {
  Users,
  CalendarRange,
  Clock3,
  Hash,
  Type,
  MapPin,
  UserCircle2,
  ArrowRight,
  ListTodo,
  Tag,
  LayoutList,
  Users2
} from "lucide-react";

import { useAppState } from "@/components/providers/app-provider";
import { getWeekdayIndex, WEEKDAY_LABELS } from "@/lib/utils";

export function TeacherScheduleView() {
  const { state } = useAppState();
  const [selectedWeekday, setSelectedWeekday] = useState(() => {
    const today = getWeekdayIndex(new Date().toISOString().slice(0, 10));
    return today > 5 ? 1 : today;
  });
  const [groupBy, setGroupBy] = useState<"time" | "teacher">("time");

  const entriesForDay = useMemo(() => {
    return state.scheduleEntries
      .filter(e => e.weekday === selectedWeekday)
      .sort((a, b) => a.lessonNumber - b.lessonNumber);
  }, [state.scheduleEntries, selectedWeekday]);

  return (
    <div className="flex h-full flex-col bg-[#191919] font-sans text-[#EBEBEB]">
      {/* Notion-like Header */}
      <div className="px-12 py-8 max-w-7xl mx-auto w-full flex-shrink-0">
        <div className="text-[40px] font-bold leading-tight flex items-center gap-4">
          <span></span> Расписание учителей
        </div>

        {/* Notion-like Tabs and Controls */}
        <div className="mt-8 flex items-center justify-between border-b border-[#2F2F2F]">
          <div className="flex gap-1">
            {Array.from({ length: 5 }, (_, i) => i + 1).map(day => (
              <button
                key={day}
                onClick={() => setSelectedWeekday(day)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${selectedWeekday === day
                    ? "border-white text-white"
                    : "border-transparent text-[#9B9A97] hover:bg-[#2F2F2F] hover:text-[#EBEBEB] rounded-t-md"
                  }`}
              >
                {WEEKDAY_LABELS[day - 1]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pb-2">
            <span className="text-xs text-[#9B9A97] uppercase tracking-wider mr-2">Группировка:</span>
            <button
              onClick={() => setGroupBy("time")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${groupBy === "time" ? "bg-[#2F2F2F] text-white" : "text-[#9B9A97] hover:bg-[#2F2F2F] hover:text-[#EBEBEB]"
                }`}
            >
              <LayoutList className="size-3.5" /> По времени
            </button>
            <button
              onClick={() => setGroupBy("teacher")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${groupBy === "teacher" ? "bg-[#2F2F2F] text-white" : "text-[#9B9A97] hover:bg-[#2F2F2F] hover:text-[#EBEBEB]"
                }`}
            >
              <Users2 className="size-3.5" /> По учителю
            </button>
          </div>
        </div>
      </div>

      {/* Notion-like Database Table */}
      <div className="flex-1 overflow-auto px-12 pb-12">
        <div className="max-w-7xl mx-auto w-full">

          {groupBy === "time" ? (
            <div className="space-y-6">
              {/* Group by lesson number */}
              {Array.from(new Set(entriesForDay.map(e => e.lessonNumber)))
                .sort((a, b) => a - b)
                .map(lessonNumber => {
                  const timeGroup = entriesForDay.filter(e => e.lessonNumber === lessonNumber);
                  if (timeGroup.length === 0) return null;
                  const first = timeGroup[0];

                  return (
                    <div key={lessonNumber} className="flex gap-6 items-start">
                      {/* Левый блок с временем */}
                      <div className="w-40 shrink-0 border border-[#2F2F2F] rounded-xl bg-[#202020] p-4 flex flex-col justify-center items-center text-center sticky top-0">
                        <div className="text-2xl font-bold text-white mb-1">{first.lessonNumber} урок</div>
                        <div className="text-sm text-[#9B9A97] bg-[#2F2F2F] px-2 py-1 rounded-md mt-2 flex items-center gap-1.5">
                          <Clock3 className="size-3.5" />
                          {first.startTime} - {first.endTime}
                        </div>
                      </div>

                      {/* Правый блок с учителями */}
                      <div className="flex-1 border border-[#2F2F2F] rounded-xl overflow-hidden bg-[#191919] shadow-sm">
                        <ScheduleTable entries={timeGroup} state={state} hideTimeColumn />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="space-y-8">
              {Array.from(new Set(entriesForDay.flatMap(e => [e.teacherUserId, e.substituteUserId]).filter(Boolean))).map(teacherId => {
                const teacher = state.users.find(u => u.id === teacherId);
                if (!teacher) return null;

                const teacherEntries = entriesForDay.filter(e => e.teacherUserId === teacher.id || (e.substituteUserId === teacher.id && e.substitutionStatus === "confirmed"));
                if (teacherEntries.length === 0) return null;

                return (
                  <div key={teacher.id} className="bg-[#191919]">
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <div className="size-6 rounded-full bg-[#5C5C5C] flex items-center justify-center text-[12px] font-bold text-white">
                        {teacher.name.slice(0, 1)}
                      </div>
                      <h2 className="text-lg font-semibold text-white">{teacher.name}</h2>
                      <span className="ml-2 text-xs text-[#9B9A97] bg-[#2F2F2F] px-2 py-0.5 rounded-full">
                        Уроков: {teacherEntries.length}
                      </span>
                    </div>
                    <div className="border border-[#2F2F2F] rounded-lg overflow-hidden">
                      <ScheduleTable entries={teacherEntries} state={state} hideTeacherColumn />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// Вынесли саму таблицу в отдельный компонент для переиспользования
function ScheduleTable({ entries, state, hideTeacherColumn = false, hideTimeColumn = false }: { entries: any[], state: any, hideTeacherColumn?: boolean, hideTimeColumn?: boolean }) {
  return (
    <table className="w-full text-sm text-left border-collapse">
      <thead>
        <tr className="border-b border-[#2F2F2F] text-[#9B9A97] bg-[#1E1E1E]">
          {!hideTimeColumn && (
            <th className="py-2.5 px-3 font-normal min-w-[60px]">
              <div className="flex items-center gap-1.5"><Hash className="size-3.5" /> Урок</div>
            </th>
          )}
          {!hideTimeColumn && (
            <th className="py-2.5 px-3 font-normal min-w-[120px]">
              <div className="flex items-center gap-1.5"><Clock3 className="size-3.5" /> Время</div>
            </th>
          )}
          {!hideTeacherColumn && (
            <th className="py-2.5 px-3 font-normal min-w-[200px]">
              <div className="flex items-center gap-1.5"><UserCircle2 className="size-3.5" /> Учитель</div>
            </th>
          )}
          <th className="py-2.5 px-3 font-normal min-w-[200px]">
            <div className="flex items-center gap-1.5"><Type className="size-3.5" /> Предмет</div>
          </th>
          <th className="py-2.5 px-3 font-normal min-w-[100px]">
            <div className="flex items-center gap-1.5"><Tag className="size-3.5" /> Класс</div>
          </th>
          <th className="py-2.5 px-3 font-normal min-w-[120px]">
            <div className="flex items-center gap-1.5"><MapPin className="size-3.5" /> Кабинет</div>
          </th>
          <th className="py-2.5 px-3 font-normal min-w-[220px]">
            <div className="flex items-center gap-1.5"><ListTodo className="size-3.5" /> Статус / Замена</div>
          </th>
        </tr>
      </thead>
      <tbody className="text-[#EBEBEB]">
        {entries.map((lesson: any) => {
          const isSubstituteHere = lesson.substituteUserId && lesson.substitutionStatus === "confirmed";
          const teacher = state.users.find((u: any) => u.id === lesson.teacherUserId);
          const subTeacher = state.users.find((u: any) => u.id === lesson.substituteUserId);

          return (
            <tr
              key={lesson.id}
              className="border-b border-[#2F2F2F] hover:bg-[#2F2F2F]/50 transition-colors group last:border-b-0"
            >
              {/* Урок */}
              {!hideTimeColumn && (
                <td className="py-3 px-3 border-r border-[#2F2F2F] font-medium text-[#9B9A97]">
                  {lesson.lessonNumber}
                </td>
              )}

              {/* Время */}
              {!hideTimeColumn && (
                <td className="py-3 px-3 border-r border-[#2F2F2F]">
                  {lesson.startTime} → {lesson.endTime}
                </td>
              )}

              {/* Учитель */}
              {!hideTeacherColumn && (
                <td className="py-3 px-3 border-r border-[#2F2F2F]">
                  <div className="flex items-center gap-2">
                    <div className="size-5 rounded-full bg-[#5C5C5C] flex items-center justify-center text-[10px] font-medium">
                      {teacher?.name?.slice(0, 1) || "?"}
                    </div>
                    <span className={isSubstituteHere ? "line-through text-[#9B9A97]" : ""}>
                      {teacher?.name || "Не назначен"}
                    </span>
                  </div>
                </td>
              )}

              {/* Предмет */}
              <td className="py-3 px-3 border-r border-[#2F2F2F] font-medium text-[#EBEBEB]">
                {lesson.subject}
              </td>

              {/* Класс */}
              <td className="py-3 px-3 border-r border-[#2F2F2F]">
                <span className="inline-flex items-center rounded bg-[#4B4B4B] px-2 py-0.5 text-xs text-[#EBEBEB]">
                  {lesson.className}
                </span>
              </td>

              {/* Кабинет */}
              <td className="py-3 px-3 border-r border-[#2F2F2F] text-[#9B9A97]">
                {lesson.room || "—"}
              </td>

              {/* Статус / Замена */}
              <td className="py-3 px-3 border-r border-[#2F2F2F] w-[260px]">
                {isSubstituteHere ? (
                  <div className="flex items-center gap-2 text-[#E255A1]">
                    <span className="inline-flex items-center rounded bg-[#E255A1]/20 px-1.5 py-0.5 text-xs font-medium text-[#E255A1]">
                      Замена
                    </span>
                    <ArrowRight className="size-3" />
                    <div className="flex items-center gap-1.5">
                      <div className="size-4 rounded-full bg-[#E255A1] flex items-center justify-center text-[8px] font-bold text-white">
                        {subTeacher?.name?.slice(0, 1) || "?"}
                      </div>
                      <span className="text-sm">{subTeacher?.name}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-[#9B9A97] text-sm flex items-center gap-2">
                    <span className="inline-flex items-center rounded bg-[#467B54]/30 px-1.5 py-0.5 text-xs font-medium text-[#467B54]">
                      По расписанию
                    </span>
                  </span>
                )}
              </td>
            </tr>
          );
        })}

        {/* Пустая строка в конце */}
        <tr className="hover:bg-[#2F2F2F]/50 transition-colors cursor-pointer text-[#9B9A97] bg-[#1E1E1E]">
          <td colSpan={10} className="py-2 px-3 text-xs flex items-center gap-2">
            <span className="text-[#5C5C5C]">+</span> New entry
          </td>
        </tr>
      </tbody>
    </table>
  );
}

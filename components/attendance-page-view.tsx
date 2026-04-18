"use client";

import { useMemo } from "react";
import { Users, GraduationCap, UserMinus, UserCheck, Activity } from "lucide-react";

import { useAppState } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";

export function AttendancePageView() {
  const { state } = useAppState();

  // Группируем последние отчеты по каждому классу (чтобы не учитывать старые дубликаты за другие даты)
  const latestReportsByClass = useMemo(() => {
    const map = new Map();
    // Сортируем от старых к новым, чтобы последние перезаписывали старые
    const sorted = [...state.attendanceReports].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    for (const report of sorted) {
      if (report.className) {
        map.set(report.className, report);
      }
    }
    return map;
  }, [state.attendanceReports]);

  // Считаем общую статистику
  const stats = useMemo(() => {
    let totalPresent = 0;
    let totalAbsent = 0;
    const reports = Array.from(latestReportsByClass.values());
    
    for (const r of reports) {
      totalPresent += r.presentCount || 0;
      totalAbsent += r.absentCount || 0;
    }

    const totalStudents = totalPresent + totalAbsent;
    const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

    return {
      totalPresent,
      totalAbsent,
      totalStudents,
      attendanceRate,
      classesReported: reports.length,
    };
  }, [latestReportsByClass]);

  // Получаем список всех классов из расписания, чтобы показать, какие классы еще не сдали отчет
  const allClasses = useMemo(() => {
    const classes = new Set<string>();
    for (const entry of state.scheduleEntries) {
      if (entry.className) classes.add(entry.className);
    }
    return Array.from(classes).sort();
  }, [state.scheduleEntries]);

  const missingClasses = allClasses.filter(c => !latestReportsByClass.has(c));

  return (
    <div className="h-full overflow-auto px-4 py-5 xl:px-6 xl:py-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">AISana</div>
            <h1 className="mt-2 text-[2.4rem] font-semibold tracking-tight text-white">
              Общее положение школы
            </h1>
            <div className="mt-2 text-sm text-[#8ea0a7]">
              Сводная информация по количеству учащихся и посещаемости на основе данных из чатов.
            </div>
          </div>

          <div className="rounded-full bg-[#103529] px-4 py-2.5 text-sm text-[#d8fff0]">
            Сдали отчет: {stats.classesReported} / {allClasses.length} классов
          </div>
        </div>

        {/* Карточки KPI */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-[22px] bg-[#10181d] px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
              <Users className="size-4 text-[#73dba5]" />
              Всего учеников (по отчетам)
            </div>
            <div className="mt-3 text-[1.85rem] font-semibold leading-none text-white">{stats.totalStudents}</div>
          </div>

          <div className="rounded-[22px] bg-[#10181d] px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
              <UserCheck className="size-4 text-[#73dba5]" />
              Присутствуют
            </div>
            <div className="mt-3 text-[1.85rem] font-semibold leading-none text-[#00a884]">{stats.totalPresent}</div>
          </div>

          <div className="rounded-[22px] bg-[#10181d] px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
              <UserMinus className="size-4 text-[#ff4d5e]" />
              Отсутствуют
            </div>
            <div className="mt-3 text-[1.85rem] font-semibold leading-none text-[#ff4d5e]">{stats.totalAbsent}</div>
          </div>

          <div className="rounded-[22px] bg-[#10181d] px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
              <Activity className="size-4 text-[#73dba5]" />
              Явка
            </div>
            <div className="mt-3 text-[1.85rem] font-semibold leading-none text-white">{stats.attendanceRate}%</div>
          </div>
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Таблица по классам */}
          <section className="rounded-[28px] bg-[#0f171c] p-6 shadow-xl border border-white/[0.04]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Статистика по классам</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#8ea0a7]">
                <thead className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-[#6f8b82]">
                  <tr>
                    <th className="pb-3 pl-2 font-medium">Класс</th>
                    <th className="pb-3 font-medium">Всего</th>
                    <th className="pb-3 font-medium text-[#00a884]">Присутствуют</th>
                    <th className="pb-3 font-medium text-[#ff4d5e]">Отсутствуют</th>
                    <th className="pb-3 font-medium">Достоверность ИИ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {Array.from(latestReportsByClass.values())
                    .sort((a, b) => a.className.localeCompare(b.className))
                    .map((report) => {
                      const total = report.presentCount + report.absentCount;
                      return (
                        <tr key={report.id} className="transition-colors hover:bg-white/[0.02]">
                          <td className="py-4 pl-2 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="size-4 text-[#00a884]" />
                              {report.className}
                            </div>
                          </td>
                          <td className="py-4 font-medium text-[#d1d7db]">{total}</td>
                          <td className="py-4 font-medium text-[#00a884]">{report.presentCount}</td>
                          <td className="py-4 font-medium text-[#ff4d5e]">{report.absentCount > 0 ? report.absentCount : "—"}</td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.08]">
                                <div 
                                  className={cn("h-full rounded-full", report.confidence > 0.8 ? "bg-[#00a884]" : "bg-amber-500")}
                                  style={{ width: `${(report.confidence || 0) * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px]">{Math.round((report.confidence || 0) * 100)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                  })}
                  {latestReportsByClass.size === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#6f8b82]">
                        Данные о посещаемости пока не поступали.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Боковая панель: Не сдавшие классы */}
          <section className="rounded-[28px] bg-[#111b21] p-6 border border-white/[0.04] flex flex-col">
            <h2 className="text-xl font-semibold text-white mb-2">Ожидают отчет</h2>
            <p className="text-sm text-[#8ea0a7] mb-6">Классы, кураторы которых еще не прислали данные по посещаемости.</p>
            
            <div className="flex-1 overflow-auto pr-2">
              <div className="flex flex-wrap gap-2">
                {missingClasses.length > 0 ? (
                  missingClasses.map(c => (
                    <div key={c} className="rounded-lg border border-white/[0.08] bg-[#18242a] px-3 py-1.5 text-sm font-medium text-[#d1d7db]">
                      {c}
                    </div>
                  ))
                ) : (
                  <div className="w-full rounded-xl bg-[#103529]/30 border border-[#103529] p-4 text-center">
                    <CheckCircle2 className="size-6 text-[#00a884] mx-auto mb-2" />
                    <div className="text-sm text-[#d8fff0]">Все классы сдали отчет!</div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, Filter } from "lucide-react";

import { useAppState } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";
import type { ScheduleEntry } from "@/lib/types";

const DAYS = [
  { key: 1, label: "Пн", full: "Понедельник" },
  { key: 2, label: "Вт", full: "Вторник" },
  { key: 3, label: "Ср", full: "Среда" },
  { key: 4, label: "Чт", full: "Четверг" },
  { key: 5, label: "Пт", full: "Пятница" },
];

const LESSONS = Array.from({ length: 10 }, (_, i) => i + 1);

const SUBJECT_COLORS = [
  "bg-[#1e293b] text-[#94a3b8] border-[#334155]", // Slate
  "bg-[#113226] text-[#6dbf8a] border-[#1d7b59]", // Emerald
  "bg-[#172554] text-[#60a5fa] border-[#1e3a8a]", // Deep Blue
  "bg-[#2d3748] text-[#a0aec0] border-[#4a5568]", // Gray
  "bg-[#1f2937] text-[#9ca3af] border-[#374151]", // Cool Gray
  "bg-[#1a365d] text-[#90cdf4] border-[#2b6cb0]", // Navy
  "bg-[#1c4532] text-[#68d391] border-[#276749]", // Dark Green
  "bg-[#2c2216] text-[#d69e2e] border-[#59422a]", // Dark Bronze
];

function getSubjectColor(subject: string) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

type TabKey = "classes" | "teachers" | "rooms";

export function PublicTimetable() {
  const { state } = useAppState();
  const [activeTab, setActiveTab] = useState<TabKey>("classes");
  const [selectedItem, setSelectedItem] = useState("7A");
  
  // Получаем уникальные списки для вкладок
  const uniqueClasses = useMemo(() => {
    return Array.from(new Set(state.scheduleEntries.map((e) => e.className))).sort();
  }, [state.scheduleEntries]);

  const uniqueTeachers = useMemo(() => {
    const teachers = Array.from(new Set(state.scheduleEntries.map((e) => e.teacherUserId))).map(id => {
      const user = state.users.find(u => u.id === id);
      return { id, name: user?.name || id };
    });
    // Добавляем завхоза
    teachers.push({ id: "zavhoz", name: "Завхоз (Хоз. часть)" });
    return teachers.sort((a, b) => a.name.localeCompare(b.name));
  }, [state.scheduleEntries, state.users]);

  const uniqueRooms = useMemo(() => {
    return Array.from(new Set(state.scheduleEntries.map((e) => e.room).filter(Boolean))).sort();
  }, [state.scheduleEntries]);

  const filteredEntries = useMemo(() => {
    if (activeTab === "teachers" && selectedItem === "zavhoz") {
      // Показываем задачи для Завхоза в виде расписания
      return state.tasks.filter(t => t.status !== "done").map((task, index) => {
        // Firebase Timestamp может быть объектом { seconds, nanoseconds } или строкой
        let date: Date;
        const ca = task.createdAt as any;
        if (ca && typeof ca === "object" && ca.seconds) {
          date = new Date(ca.seconds * 1000);
        } else if (ca) {
          date = new Date(ca);
        } else {
          date = new Date();
        }
        
        // День недели (0=вс,1=пн...6=сб). Выходные → понедельник
        let dayNum = date.getDay();
        if (dayNum === 0 || dayNum === 6) dayNum = 1;
        
        const lessonNum = (index % 8) + 1;
        const dayKey = DAYS[dayNum - 1]?.key || "monday";
        
        return {
          id: task.id,
          weekday: dayKey,
          lessonNumber: lessonNum,
          subject: task.title,
          room: task.status === "in_progress" ? "В процессе" : "Новая задача",
          teacherUserId: "zavhoz",
          className: task.assigneeUserId || "Завхоз",
          startTime: "—",
          endTime: "",
          substitutionStatus: "none",
        } as unknown as ScheduleEntry;
      });
    }

    return state.scheduleEntries.filter((entry) => {
      if (activeTab === "classes") return entry.className === selectedItem;
      if (activeTab === "teachers") return entry.teacherUserId === selectedItem || entry.substituteUserId === selectedItem;
      if (activeTab === "rooms") return entry.room === selectedItem;
      return false;
    });
  }, [state.scheduleEntries, activeTab, selectedItem, state.tasks]);

  // Генерируем сетку с объединением пар (consecutive lessons)
  const gridData = useMemo(() => {
    const map = new Map<number, { lessonNum: number; span: number; entries: ScheduleEntry[] }[]>();
    
    DAYS.forEach(day => {
      const lessonMap = new Map<number, ScheduleEntry[]>();
      LESSONS.forEach(l => lessonMap.set(l, []));
      
      filteredEntries.forEach(entry => {
        if (entry.weekday === day.key) {
          lessonMap.get(entry.lessonNumber)?.push(entry);
        }
      });

      const slots: { lessonNum: number; span: number; entries: ScheduleEntry[] }[] = [];
      let skipUntil = 0;

      for (let l = 1; l <= 10; l++) {
        if (l < skipUntil) continue;

        const entries = lessonMap.get(l) || [];
        const signature = entries.map(e => `${e.subject}|${e.teacherUserId}|${e.room}|${e.className}|${e.substituteUserId || ''}`).sort().join('||');
        
        let span = 1;
        if (signature !== "" && entries.length > 0) {
          for (let next = l + 1; next <= 10; next++) {
            const nextEntries = lessonMap.get(next) || [];
            const nextSig = nextEntries.map(e => `${e.subject}|${e.teacherUserId}|${e.room}|${e.className}|${e.substituteUserId || ''}`).sort().join('||');
            if (nextSig === signature && nextEntries.length > 0) {
              span++;
            } else {
              break;
            }
          }
        }
        
        slots.push({ lessonNum: l, span, entries });
        skipUntil = l + span;
      }
      
      map.set(day.key, slots);
    });

    return map;
  }, [filteredEntries]);

  function getShortTeacherName(id: string) {
    const user = state.users.find((u) => u.id === id);
    if (!user) return id;
    const parts = user.name.split(" ");
    if (parts.length > 1) {
      return `${parts[0]} ${parts[1][0]}.`;
    }
    return user.name;
  }

  // Обновляем выбранный элемент при смене вкладки, чтобы не было пустой сетки
  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    if (tab === "classes" && uniqueClasses.length) setSelectedItem(uniqueClasses[0]);
    if (tab === "teachers" && uniqueTeachers.length) setSelectedItem(uniqueTeachers[0].id);
    if (tab === "rooms" && uniqueRooms.length) setSelectedItem(uniqueRooms[0]);
  }

  // Получаем название текущего выбранного элемента для заголовка
  const currentTitle = useMemo(() => {
    if (activeTab === "classes") return selectedItem;
    if (activeTab === "teachers") return uniqueTeachers.find(t => t.id === selectedItem)?.name || selectedItem;
    if (activeTab === "rooms") return `Кабинет ${selectedItem}`;
    return selectedItem;
  }, [activeTab, selectedItem, uniqueTeachers]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0b141a] text-[#e9edef]">
      {/* Верхнее синее меню (стилизовано под AISana) */}
      <div className="bg-[#111b21] border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6 text-[13px] font-semibold tracking-wider">
              <span className="cursor-pointer text-[#8696a0] hover:text-[#d1d7db] transition">ГЛАВНАЯ</span>
              <span className="cursor-pointer text-[#00a884] border-b-2 border-[#00a884] py-4">РАСПИСАНИЕ</span>
              <span className="cursor-pointer text-[#8696a0] hover:text-[#d1d7db] transition">ЗАМЕНЫ</span>
              <span className="cursor-pointer text-[#8696a0] hover:text-[#d1d7db] transition">НОВОСТИ</span>
            </div>
            <div className="text-sm font-medium text-[#8696a0]">
              Aqbobek School • Расписание в интернете
            </div>
          </div>
        </div>
      </div>

      {/* Панель фильтров */}
      <div className="bg-[#202c33] border-b border-white/[0.06] sticky top-0 z-10 shadow-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 h-12">
          <div className="flex items-center gap-1">
            {(
              [
                { key: "classes", label: "КЛАССЫ" },
                { key: "teachers", label: "УЧИТЕЛЯ" },
                { key: "rooms", label: "КАБИНЕТЫ" }
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-[13px] font-medium transition",
                  activeTab === tab.key 
                    ? "bg-[#2a3942] text-white shadow-sm" 
                    : "text-[#8696a0] hover:bg-[#2a3942]/50 hover:text-[#d1d7db]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <select
                className="appearance-none bg-[#2a3942] border border-white/[0.08] text-white text-sm rounded-lg pl-4 pr-10 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00a884] cursor-pointer"
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
              >
                {activeTab === "classes" && uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                {activeTab === "teachers" && uniqueTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                {activeTab === "rooms" && uniqueRooms.map(r => <option key={r} value={r}>Кабинет {r}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[#8696a0] pointer-events-none" />
            </div>
            
            <div className="text-[13px] text-[#8696a0] flex items-center gap-2 border-l border-white/10 pl-4">
              <Filter className="size-4" />
              РЕГУЛЯРНОЕ РАСПИСАНИЕ
            </div>
          </div>
        </div>
      </div>

      {/* Основной контент (Сетка) */}
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="mx-auto max-w-[1400px]">
          <h1 className="text-center text-4xl font-bold text-white mb-2">{currentTitle}</h1>
          <p className="text-center text-sm text-[#8696a0] mb-8">
            Aqbobek School of Science and Mathematics
          </p>

          <div className="overflow-x-auto pb-8">
            <div className="min-w-[1000px] bg-[#111b21] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl">
              
              {/* Шапка таблицы (Номера уроков) */}
              <div className="grid grid-cols-[80px_repeat(10,minmax(90px,1fr))] border-b border-white/[0.08] bg-[#202c33]">
                <div className="border-r border-white/[0.08]"></div>
                {LESSONS.map((lesson) => {
                  const sampleEntry = state.scheduleEntries.find(e => e.lessonNumber === lesson);
                  const timeStr = sampleEntry ? `${sampleEntry.startTime} - ${sampleEntry.endTime}` : "";
                  
                  return (
                    <div key={lesson} className="border-r border-white/[0.08] p-2 text-center last:border-r-0">
                      <div className="text-lg font-bold text-[#d1d7db]">{lesson}</div>
                      <div className="text-[10px] text-[#8696a0] mt-0.5">{timeStr || "-"}</div>
                    </div>
                  );
                })}
              </div>

              {/* Тело таблицы (Дни недели) */}
              <div>
                {DAYS.map((day) => (
                  <div key={day.key} className="grid grid-cols-[80px_repeat(10,minmax(90px,1fr))] border-b border-white/[0.08] last:border-b-0">
                    {/* День */}
                    <div className="border-r border-white/[0.08] bg-[#1c262c] flex items-center justify-center">
                      <span className="text-xl font-bold text-[#e9edef]">{day.label}</span>
                    </div>

                    {/* Уроки */}
                    {gridData.get(day.key)?.map((slot) => {
                      const { lessonNum, span, entries } = slot;
                      
                      return (
                        <div 
                          key={`${day.key}-${lessonNum}`} 
                          className="border-r border-white/[0.08] p-1.5 last:border-r-0 relative min-h-[100px] flex flex-col gap-1.5 bg-[#0b141a]"
                          style={{ gridColumn: `span ${span}` }}
                        >
                          {entries.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-white/[0.02]">
                              <span className="text-[10px] text-[#8696a0]">-</span>
                            </div>
                          )}
                          
                          {entries.map((entry, idx) => {
                            const isSub = entry.substitutionStatus === "confirmed" && entry.substituteUserId;
                            const tId = isSub ? entry.substituteUserId! : entry.teacherUserId;
                            const colorClass = getSubjectColor(entry.subject);
                            
                            return (
                              <div 
                                key={`${entry.id}_${entry.teacherUserId}_${idx}`} 
                                className={cn(
                                  "flex-1 rounded-xl p-2.5 flex flex-col justify-between border relative overflow-hidden group hover:brightness-110 transition cursor-pointer",
                                  colorClass
                                )}
                              >
                                {isSub && (
                                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-bl-lg uppercase tracking-wider">
                                    Замена
                                  </div>
                                )}
                                
                                <div className="text-center font-bold text-[15px] leading-tight mt-1 line-clamp-2">
                                  {entry.subject}
                                </div>
                                
                                <div className="flex items-end justify-between mt-3 text-[11px] font-medium opacity-80">
                                  <span>{entry.room || "—"}</span>
                                  <span className="text-right ml-2 flex flex-col items-end">
                                    {activeTab === "classes" || activeTab === "rooms" ? (
                                      isSub ? (
                                        <div className="flex flex-col items-end gap-0.5">
                                          <span className="line-through opacity-60 text-[9px]">{getShortTeacherName(entry.teacherUserId)}</span>
                                          <span>{getShortTeacherName(entry.substituteUserId!)}</span>
                                        </div>
                                      ) : (
                                        <span className="truncate">{getShortTeacherName(tId)}</span>
                                      )
                                    ) : (
                                      // Вкладка "Учителя"
                                      <div className="flex flex-col items-end gap-0.5">
                                        <span className="truncate">{entry.className}</span>
                                        {isSub && (
                                          <div className="flex items-center gap-1 text-[9px] bg-black/20 px-1 rounded">
                                            <span className="line-through opacity-60">{getShortTeacherName(entry.teacherUserId)}</span>
                                            <span className="text-white font-bold">{getShortTeacherName(entry.substituteUserId!)}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

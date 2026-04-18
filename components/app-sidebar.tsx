"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  CalendarDays,
  CircleAlert,
  Files,
  MessageCircleMore,
  SquareCheckBig,
  Users,
} from "lucide-react";

import { useAppState } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/chats", label: "Чаты", icon: MessageCircleMore },
  { href: "/schedule", label: "Расписание", icon: CalendarDays },
  { href: "/attendance", label: "Посещаемость", icon: Users },
  { href: "/tasks", label: "Задачи", icon: SquareCheckBig },
  { href: "/incidents", label: "Инциденты", icon: CircleAlert },
  { href: "/documents", label: "Документы", icon: Files },
  { href: "/teacher-schedule", label: "Учителя", icon: Users },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useAppState();
  const unreadCount = state.chats.reduce((sum, chat) => sum + chat.unreadCount, 0);
  const openIncidents = state.incidents.filter((incident) => incident.status !== "resolved").length;
  const director = state.users.find((user) => user.role === "director");

  return (
    <div className="flex h-full flex-col items-center justify-between py-4">
      <div className="flex flex-col items-center gap-3">
        <div className="mb-2 flex size-11 items-center justify-center rounded-full text-[#00a884]">
          <BookOpenText className="size-7" strokeWidth={1.8} />
        </div>

        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          const badge =
            href === "/chats" ? unreadCount : href === "/incidents" ? openIncidents : 0;

          return (
            <Link
              className={cn(
                "relative flex size-12 items-center justify-center rounded-full text-[#aebac1] transition",
                active ? "bg-[#2a3942] text-white" : "hover:bg-white/[0.06] hover:text-white",
              )}
              href={href}
              key={href}
              title={label}
            >
              {active ? <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#00a884]" /> : null}
              <Icon className="size-5" strokeWidth={1.9} />
              {badge > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-[#ff4d5e] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3">

        <div
          className="flex size-12 items-center justify-center rounded-full bg-[#d1c2af] text-sm font-semibold text-[#0f1417]"
          title={director?.name ?? "Жанар С."}
        >
          {director?.avatar ?? "ЖС"}
        </div>
      </div>
    </div>
  );
}



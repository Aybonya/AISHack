"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { ChatList } from "@/components/chat-list";

const NAV_WIDTH = 72;
const CHAT_WIDTH = 360;

const mobileNav = [
  { href: "/", label: "Главная" },
  { href: "/chats", label: "Чаты" },
  { href: "/tasks", label: "Задачи" },
  { href: "/incidents", label: "Инциденты" },
  { href: "/schedule", label: "Календарь" },
  { href: "/documents", label: "Документы" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const showChatList = pathname === "/" || pathname.startsWith("/chats");

  return (
    <div className="min-h-screen bg-[#0b141a] text-foreground">
      <div className="border-b border-white/[0.06] bg-[#111b21] xl:hidden">
        <div className="px-4 py-4">
          <div className="font-brand text-xl font-semibold text-white">AISana</div>
          <div className="mt-1 text-sm text-[#95a5ab]">Aqbobek School</div>
        </div>
        <div className="flex gap-2 overflow-x-auto border-t border-white/[0.05] px-4 py-3">
          {mobileNav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                className={
                  active
                    ? "rounded-full bg-[#00a884] px-3 py-2 text-sm font-medium text-[#09141a]"
                    : "rounded-full bg-[#202c33] px-3 py-2 text-sm text-[#c7d0d4]"
                }
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="hidden h-screen w-full overflow-hidden bg-[#0b141a] xl:flex">
        <aside
          className="shrink-0 border-r border-white/[0.06] bg-[#111b21]"
          style={{ width: NAV_WIDTH }}
        >
          <AppSidebar />
        </aside>

        {showChatList ? (
          <section
            className="shrink-0 border-r border-white/[0.06] bg-[#111b21]"
            style={{ width: CHAT_WIDTH }}
          >
            <ChatList />
          </section>
        ) : null}

        <main className="min-w-0 flex-1 overflow-hidden bg-[#0b141a]">{children}</main>
      </div>

      <div className="xl:hidden">{children}</div>
    </div>
  );
}

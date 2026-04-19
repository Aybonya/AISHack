"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { ChatList } from "@/components/chat-list";
import { useAppState } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";

const NAV_WIDTH = 72;
const CHAT_WIDTH = 360;
const AISANA_CHAT_PATH = "/chats/chat-aisana";

const mobileNav = [
  { href: "/", label: "Главная" },
  { href: "/chats", label: "Чаты" },
  { href: "/tasks", label: "Задачи" },
  { href: "/schedule", label: "Календарь" },
  { href: "/documents", label: "Документы" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { markChatRead } = useAppState();
  const isPublicView = pathname === "/timetable";
  const showChatList = !isPublicView && (pathname === "/" || pathname.startsWith("/chats"));
  const orbActive = pathname === AISANA_CHAT_PATH;

  const handleOrbClick = () => {
    markChatRead("chat-aisana");
    router.push(AISANA_CHAT_PATH);
  };

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
        {!isPublicView && (
          <aside
            className="shrink-0 border-r border-white/[0.06] bg-[#111b21]"
            style={{ width: NAV_WIDTH }}
          >
            <AppSidebar />
          </aside>
        )}

        {showChatList ? (
          <section
            className="shrink-0 border-r border-white/[0.06] bg-[#111b21]"
            style={{ width: CHAT_WIDTH }}
          >
            <ChatList />
          </section>
        ) : null}

        <main className={cn("min-w-0 flex-1 bg-[#0b141a]", isPublicView ? "overflow-y-auto" : "overflow-hidden")}>
          {children}
        </main>
      </div>

      <div className="xl:hidden">{children}</div>

      {!isPublicView && (
        <button
          aria-label="Open AISana chat"
          className="drift-orb"
          data-active={orbActive ? "true" : "false"}
          onClick={handleOrbClick}
          type="button"
        >
        <span aria-hidden="true" className="drift-orb__text">
          AIS
        </span>
        <span aria-hidden="true" className="drift-orb__voice">
          <span className="drift-orb__bars">
            {Array.from({ length: 9 }).map((_, index) => (
              <span className="drift-orb__bar" key={index} />
            ))}
          </span>
          <span className="drift-orb__ring" />
          <span className="drift-orb__ring drift-orb__ring--outer" />
        </span>
      </button>
      )}
    </div>
  );
}

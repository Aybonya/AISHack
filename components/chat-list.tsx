"use client";

import { AlertTriangle, ChevronDown, MoreVertical, Pin, Search, SquarePen } from "lucide-react";
import { usePathname } from "next/navigation";
import { useDeferredValue, useState } from "react";

import { ChatListItem } from "@/components/chat-list-item";
import { useAppState } from "@/components/providers/app-provider";
import type { Chat } from "@/lib/types";

const filters = [
  { key: "all",       label: "Все" },
  { key: "unread",    label: "Непрочитанное" },
  { key: "important", label: "Важные" },
  { key: "personal",  label: "Личные" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

export function ChatList() {
  const pathname = usePathname();
  const { state, markChatRead, hydrated, backendError } = useAppState();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const unreadCount = state.chats.reduce((sum, chat) => sum + chat.unreadCount, 0);
  const importantCount = state.chats.filter((c) => c.isImportant).length;

  // Разделяем закреплённые и личные чаты
  const pinnedChats = state.chats.filter((c) => c.pinned);
  const personalChats = state.chats.filter((c) => !c.pinned);

  function matchesSearch(chat: Chat) {
    if (normalizedQuery.length === 0) return true;
    const lastMessage = state.messages.find((m) => m.id === chat.lastMessageId);
    return (
      chat.title.toLowerCase().includes(normalizedQuery) ||
      (lastMessage?.text ?? "").toLowerCase().includes(normalizedQuery)
    );
  }

  function matchesFilter(chat: Chat): boolean {
    if (activeFilter === "unread")    return chat.unreadCount > 0;
    if (activeFilter === "important") return !!chat.isImportant;
    if (activeFilter === "personal")  return !!chat.isUnknown;
    return true;
  }

  const visiblePinned  = pinnedChats.filter((c) => matchesSearch(c) && matchesFilter(c));
  const visiblePersonal = personalChats.filter((c) => matchesSearch(c) && matchesFilter(c));

  return (
    <div className="flex h-full flex-col bg-[#111b21]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-2xl font-semibold text-white">Чаты</div>
          <div className="flex items-center gap-2 text-[#d3dde0]">
            <button className="transition hover:text-white" type="button">
              <SquarePen className="size-5" />
            </button>
            <button className="transition hover:text-white" type="button">
              <MoreVertical className="size-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <label className="mt-5 flex items-center gap-3 rounded-full bg-[#202c33] px-4 py-2.5 text-[#93a5ab]">
          <Search className="size-5" />
          <input
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#9baeb4]"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск или новый чат"
            value={query}
          />
        </label>

        {/* Filter chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filters.map((filter) => {
            let label = filter.label;
            if (filter.key === "unread" && unreadCount > 0) label = `${filter.label} ${unreadCount}`;
            if (filter.key === "important" && importantCount > 0) label = `${filter.label} ${importantCount}`;

            return (
              <button
                className={
                  activeFilter === filter.key
                    ? "rounded-full border border-[#14543d] bg-[#103529] px-3 py-2 text-sm font-medium text-[#d8fff0]"
                    : "rounded-full border border-white/[0.08] bg-[#111b21] px-3 py-2 text-sm text-[#c1ccd0] transition hover:bg-white/[0.03] hover:text-white"
                }
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                type="button"
              >
                {filter.key === "important" && importantCount > 0 && (
                  <AlertTriangle className="mr-1 inline size-3 text-amber-400" />
                )}
                {label}
              </button>
            );
          })}

          <button
            className="flex size-11 items-center justify-center rounded-full border border-white/[0.08] text-[#b6c2c7] transition hover:bg-white/[0.03] hover:text-white"
            type="button"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-3">
        {!hydrated && state.chats.length === 0 && (
          <div className="px-6 py-10 text-base text-[#8ea0a4]">
            Подключаем реальные чаты из GreenAPI...
          </div>
        )}

        {hydrated && state.chats.length === 0 && (
          <div className="px-6 py-10 text-base text-[#8ea0a4]">
            {backendError ?? "Backend не вернул ни одного чата."}
          </div>
        )}

        {/* Закреплённые группы */}
        {visiblePinned.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-5 py-2">
              <Pin className="size-3 text-[#6b8087]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b8087]">
                Группы
              </span>
            </div>
            {visiblePinned.map((chat) => {
              const lastMessage = state.messages.find((m) => m.id === chat.lastMessageId);
              const href = `/chats/${chat.id}`;
              return (
                <ChatListItem
                  active={pathname === href || ((pathname === "/chats" || pathname === "/") && (chat.id === "chat-general" || chat.title === "Учителя и Директор"))}
                  avatar={chat.avatar}
                  href={href}
                  isImportant={chat.isImportant}
                  isPinned
                  key={chat.id}
                  onSelect={() => markChatRead(chat.id)}
                  preview={lastMessage?.text ?? "Нет сообщений"}
                  time={lastMessage?.createdAt ?? new Date().toISOString()}
                  title={chat.title}
                  unreadCount={chat.unreadCount}
                />
              );
            })}
          </>
        )}

        {/* Личные / Неизвестные */}
        {visiblePersonal.length > 0 && (
          <>
            <div className="mt-2 flex items-center gap-2 px-5 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6b8087]">
                Сообщения
              </span>
            </div>
            {visiblePersonal.map((chat) => {
              const lastMessage = state.messages.find((m) => m.id === chat.lastMessageId);
              const href = `/chats/${chat.id}`;
              return (
                <ChatListItem
                  active={pathname === href}
                  avatar={chat.avatar}
                  href={href}
                  isImportant={chat.isImportant}
                  isPinned={false}
                  key={chat.id}
                  onSelect={() => markChatRead(chat.id)}
                  preview={lastMessage?.text ?? "Нет сообщений"}
                  time={lastMessage?.createdAt ?? new Date().toISOString()}
                  title={chat.title}
                  unreadCount={chat.unreadCount}
                />
              );
            })}
          </>
        )}

        {hydrated && state.chats.length > 0 && visiblePinned.length === 0 && visiblePersonal.length === 0 && (
          <div className="px-6 py-10 text-base text-[#8ea0a4]">По этому фильтру чатов пока нет.</div>
        )}
      </div>
    </div>
  );
}

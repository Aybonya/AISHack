"use client";

import { ChevronDown, MoreVertical, Search, SquarePen } from "lucide-react";
import { usePathname } from "next/navigation";
import { useDeferredValue, useState } from "react";

import { ChatListItem } from "@/components/chat-list-item";
import { useAppState } from "@/components/providers/app-provider";

const filters = [
  { key: "all", label: "Все" },
  { key: "unread", label: "Непрочитанное" },
  { key: "favorites", label: "Избранное" },
] as const;

const favoriteChatIds = new Set(["chat-general", "chat-cafeteria"]);

export function ChatList() {
  const pathname = usePathname();
  const { state, markChatRead, hydrated, backendError } = useAppState();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]["key"]>("all");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const unreadCount = state.chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  const filteredChats = state.chats.filter((chat) => {
    const lastMessage = state.messages.find((message) => message.id === chat.lastMessageId);
    const matchesQuery =
      normalizedQuery.length === 0 ||
      chat.title.toLowerCase().includes(normalizedQuery) ||
      (lastMessage?.text ?? "").toLowerCase().includes(normalizedQuery);

    if (!matchesQuery) {
      return false;
    }

    if (activeFilter === "unread") {
      return chat.unreadCount > 0;
    }

    if (activeFilter === "favorites") {
      return favoriteChatIds.has(chat.id);
    }

    return true;
  });

  return (
    <div className="flex h-full flex-col bg-[#111b21]">
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

        <label className="mt-5 flex items-center gap-3 rounded-full bg-[#202c33] px-4 py-2.5 text-[#93a5ab]">
          <Search className="size-5" />
          <input
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#9baeb4]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск или новый чат"
            value={query}
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filters.map((filter) => {
            const label =
              filter.key === "unread" && unreadCount > 0
                ? `${filter.label} ${unreadCount}`
                : filter.label;

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

      <div className="flex-1 overflow-y-auto py-3">
        {!hydrated && state.chats.length === 0 ? (
          <div className="px-6 py-10 text-base text-[#8ea0a4]">
            Подключаем реальные чаты из GreenAPI...
          </div>
        ) : null}

        {hydrated && state.chats.length === 0 ? (
          <div className="px-6 py-10 text-base text-[#8ea0a4]">
            {backendError ?? "Backend не вернул ни одного чата."}
          </div>
        ) : null}

        {filteredChats.map((chat) => {
          const lastMessage = state.messages.find((message) => message.id === chat.lastMessageId);
          const href = `/chats/${chat.id}`;

          return (
            <ChatListItem
              active={
                pathname === href ||
                ((pathname === "/chats" || pathname === "/") && chat.id === "chat-general")
              }
              avatar={chat.avatar}
              href={href}
              key={chat.id}
              onSelect={() => markChatRead(chat.id)}
              preview={lastMessage?.text ?? "Нет сообщений"}
              time={lastMessage?.createdAt ?? new Date().toISOString()}
              title={chat.title}
              unreadCount={chat.unreadCount}
            />
          );
        })}

        {hydrated && state.chats.length > 0 && filteredChats.length === 0 ? (
          <div className="px-6 py-10 text-base text-[#8ea0a4]">По этому фильтру чатов пока нет.</div>
        ) : null}
      </div>
    </div>
  );
}

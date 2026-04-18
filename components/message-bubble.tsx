"use client";

import { useAppState } from "@/components/providers/app-provider";
import { AIActionCard } from "@/components/ai-action-card";
import type { Message, MessageCardData } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

const senderPalette = [
  "text-[#53bdeb]",
  "text-[#f15c6d]",
  "text-[#ffd279]",
  "text-[#8bd36d]",
  "text-[#c792ea]",
];

function isCardData(value: Message["metadata"]): value is MessageCardData {
  return Boolean(value && typeof value === "object" && "cardType" in value);
}

export function MessageBubble({ message }: { message: Message }) {
  const { state } = useAppState();
  const sender = state.users.find((user) => user.id === message.senderId);
  const senderColor =
    senderPalette[
      state.users.findIndex((user) => user.id === message.senderId) >= 0
        ? state.users.findIndex((user) => user.id === message.senderId) % senderPalette.length
        : 0
    ];

  const isOutgoing = message.senderType === "director";
  const isAI = message.senderType === "ai" || message.senderType === "system";

  if (message.kind === "voice" && isOutgoing) {
    return (
      <div className="ml-auto max-w-[430px] rounded-[0.95rem] bg-[#005c4b] px-4 py-3 text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
        <div className="flex items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-full bg-[#25d366] text-[#08251a]">
            <span className="ml-0.5 text-sm">▶</span>
          </div>
          <div className="flex flex-1 items-center gap-1">
            {Array.from({ length: 24 }, (_, index) => {
              const heights = [7, 13, 10, 17, 9, 20, 11, 18, 13, 22, 14, 19];
              const height = heights[index % heights.length];
              return (
                <span
                  className="w-1 rounded-full bg-[#b6ffcf]"
                  key={`${message.id}-${index}`}
                  style={{ height }}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-[#d3ffe1]">
          <span>0:08</span>
          <span>{formatTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  if (isCardData(message.metadata) && (message.kind === "parsed_card" || message.kind === "system_event")) {
    return (
      <div className="flex max-w-[540px] items-end gap-2">
        <div className="mb-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0b6150] text-sm font-semibold text-[#d9fff1]">
          AI
        </div>
        <div className="space-y-2">
          <div className="rounded-[0.85rem] bg-[#202c33] px-4 py-3 text-[1rem] leading-6 text-white shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
            {message.text}
          </div>
          <AIActionCard card={message.metadata} chatId={message.chatId} />
          <div className="pl-2 text-xs text-[#9aacb5]">{formatTime(message.createdAt)}</div>
        </div>
      </div>
    );
  }

  if (isAI) {
    return (
      <div className="flex max-w-[540px] items-end gap-2">
        <div className="mb-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0b6150] text-sm font-semibold text-[#d9fff1]">
          AI
        </div>
        <div className="rounded-[0.85rem] bg-[#202c33] px-4 py-3 text-[1rem] leading-6 text-white shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
          <div>{message.text}</div>
          <div className="mt-2 text-xs text-[#9aacb5]">{formatTime(message.createdAt)}</div>
        </div>
      </div>
    );
  }

  if (isOutgoing) {
    return (
      <div className="ml-auto max-w-[520px] rounded-[0.85rem] bg-[#005c4b] px-4 py-3 text-white shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
        <div className="text-[1rem] leading-6">{message.text}</div>
        <div className="mt-2 text-right text-xs text-[#c6efe0]">{formatTime(message.createdAt)}</div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[560px] items-end gap-2">
      <div className="mb-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#ff5f6d] text-sm font-semibold text-white">
        {sender?.avatar?.slice(0, 1) ?? "Т"}
      </div>
      <div className="rounded-[0.85rem] bg-[#202c33] px-4 py-3 text-white shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
        <div className={cn("mb-1 text-sm font-medium", senderColor)}>{sender?.name ?? "Сотрудник"}</div>
        <div className="text-[1rem] leading-6">{message.text}</div>
        <div className="mt-2 text-right text-xs text-[#9aacb5]">{formatTime(message.createdAt)}</div>
      </div>
    </div>
  );
}

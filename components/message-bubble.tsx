"use client";

import { AISanaWorkspace } from "@/components/aisana-workspace";
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

function extractWorkspace(value: Message["metadata"]) {
  if (!value || typeof value !== "object" || !("workspace" in value)) {
    return null;
  }

  const workspace = (
    value as {
      workspace?: {
        title?: string;
        fileName?: string;
        summary?: string;
        html?: string;
      } | null;
    }
  ).workspace;

  if (!workspace?.title || !workspace.fileName || !workspace.summary || !workspace.html) {
    return null;
  }

  return workspace;
}

function getVoiceDurationLabel(message: Message) {
  if (!message.metadata || typeof message.metadata !== "object" || !("durationMs" in message.metadata)) {
    return "0:00";
  }

  const durationMs = Number(message.metadata.durationMs ?? 0);
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function MessageBubble({
  message,
  renderedText,
  isStreaming = false,
}: {
  message: Message;
  renderedText?: string;
  isStreaming?: boolean;
}) {
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
  const isAISanaChat = message.chatId === "chat-aisana";
  const displayText = renderedText ?? message.text;
  const workspace = extractWorkspace(message.metadata);

  const typingCaret = isStreaming ? (
    <span className="ml-1 inline-block h-[1.05em] w-[0.58ch] animate-pulse rounded-full bg-[#dbc2ff] align-[-0.18em]" />
  ) : null;

  if (message.kind === "voice" && isOutgoing) {
    return (
      <div
        className={cn(
          "ml-auto max-w-[460px] rounded-[1rem] px-4 py-3 text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)]",
          isAISanaChat
            ? "border border-[#d2a8ff]/[0.16] bg-[linear-gradient(180deg,rgba(81,45,128,0.96),rgba(46,24,79,0.94))]"
            : "bg-[#005c4b]",
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex size-11 items-center justify-center rounded-full",
              isAISanaChat ? "bg-[#d4adff] text-[#241037]" : "bg-[#25d366] text-[#08251a]",
            )}
          >
            <span className="ml-0.5 text-sm">▶</span>
          </div>
          <div className="flex flex-1 items-center gap-1">
            {Array.from({ length: 24 }, (_, index) => {
              const heights = [7, 13, 10, 17, 9, 20, 11, 18, 13, 22, 14, 19];
              const height = heights[index % heights.length];
              return (
                <span
                  className={cn("w-1 rounded-full", isAISanaChat ? "bg-[#f0d8ff]" : "bg-[#b6ffcf]")}
                  key={`${message.id}-${index}`}
                  style={{ height }}
                />
              );
            })}
          </div>
        </div>
        <div
          className={cn(
            "mt-2 flex items-center justify-between text-sm",
            isAISanaChat ? "text-[#eedcff]" : "text-[#d3ffe1]",
          )}
        >
          <span>{getVoiceDurationLabel(message)}</span>
          <span>{formatTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  if (isCardData(message.metadata) && (message.kind === "parsed_card" || message.kind === "system_event")) {
    if (isAISanaChat) {
      return (
        <div className="flex w-full max-w-[760px] items-start gap-3">
          <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#7a46d6] text-sm font-semibold text-[#faf6ff]">
            AI
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="text-[1rem] leading-7 text-[#f4ecff]">
              {displayText}
              {typingCaret}
            </div>
            <AIActionCard card={message.metadata} chatId={message.chatId} />
            <div className="text-xs text-[#a991cc]">{formatTime(message.createdAt)}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex max-w-[540px] items-end gap-2">
        <div className="mb-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0b6150] text-sm font-semibold text-[#d9fff1]">
          AI
        </div>
        <div className="space-y-2">
          <div className="rounded-[0.85rem] bg-[#202c33] px-4 py-3 text-[1rem] leading-6 text-white shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
            {displayText}
            {typingCaret}
          </div>
          <AIActionCard card={message.metadata} chatId={message.chatId} />
          <div className="pl-2 text-xs text-[#9aacb5]">{formatTime(message.createdAt)}</div>
        </div>
      </div>
    );
  }

  if (isAI) {
    if (isAISanaChat) {
      return (
        <div className="flex w-full max-w-[760px] items-start gap-3">
          <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#7a46d6] text-sm font-semibold text-[#faf6ff]">
            AI
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="text-[1rem] leading-7 text-[#f6efff]">
              {displayText}
              {typingCaret}
            </div>
            {workspace ? <AISanaWorkspace compact workspace={workspace} /> : null}
            <div className="mt-3 text-xs text-[#a991cc]">{formatTime(message.createdAt)}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex max-w-[560px] items-end gap-2">
        <div className="mb-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0b6150] text-sm font-semibold text-[#d9fff1]">
          AI
        </div>
        <div className="rounded-[0.95rem] bg-[#202c33] px-4 py-3 text-[1rem] leading-6 text-white shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
          <div>
            {displayText}
            {typingCaret}
          </div>
          <div className="mt-2 text-xs text-[#9aacb5]">{formatTime(message.createdAt)}</div>
        </div>
      </div>
    );
  }

  if (isOutgoing) {
    return (
      <div
        className={cn(
          "ml-auto max-w-[520px] rounded-[0.95rem] px-4 py-3 text-white shadow-[0_10px_20px_rgba(0,0,0,0.15)]",
          isAISanaChat
            ? "border border-[#d7b5ff]/[0.16] bg-[linear-gradient(180deg,rgba(125,81,196,0.94),rgba(86,55,148,0.94))]"
            : "bg-[#005c4b]",
        )}
      >
        <div className="text-[1rem] leading-6">{displayText}</div>
        <div className={cn("mt-2 text-right text-xs", isAISanaChat ? "text-[#f0e4ff]" : "text-[#c6efe0]")}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[560px] items-end gap-2">
      <div
        className={cn(
          "mb-1 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
          isAISanaChat ? "bg-[#9a63ff]" : "bg-[#ff5f6d]",
        )}
      >
        {sender?.avatar?.slice(0, 1) ?? "T"}
      </div>
      <div
        className={cn(
          "rounded-[0.85rem] px-4 py-3 text-white shadow-[0_10px_20px_rgba(0,0,0,0.15)]",
          isAISanaChat
            ? "border border-[#c69dff]/[0.14] bg-[linear-gradient(180deg,rgba(37,20,58,0.96),rgba(21,11,33,0.94))]"
            : "bg-[#202c33]",
        )}
      >
        <div className={cn("mb-1 text-sm font-medium", senderColor)}>{sender?.name ?? "Сотрудник"}</div>
        <div className="text-[1rem] leading-6">{displayText}</div>
        <div className="mt-2 text-right text-xs text-[#9aacb5]">{formatTime(message.createdAt)}</div>
      </div>
    </div>
  );
}

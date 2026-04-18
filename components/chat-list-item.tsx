"use client";

import Link from "next/link";
import { BellOff, Pin } from "lucide-react";

import { cn, formatTime } from "@/lib/utils";

export function ChatListItem({
  href,
  active,
  avatar,
  title,
  preview,
  time,
  unreadCount,
  onSelect,
}: {
  href: string;
  active: boolean;
  avatar: string;
  title: string;
  preview: string;
  time: string;
  unreadCount: number;
  onSelect?: () => void;
}) {
  return (
    <Link
      className={cn(
        "mx-2 mb-1.5 block rounded-2xl px-3 py-2.5 transition",
        active ? "bg-[#2a3942]" : "hover:bg-white/[0.04]",
      )}
      href={href}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
            active ? "bg-[#1c7e55]" : "bg-[#24343d]",
          )}
        >
          {avatar}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="truncate text-sm font-medium text-white">{title}</div>
            <div className={cn("shrink-0 text-xs", unreadCount > 0 ? "text-[#00d26a]" : "text-[#8ca0a6]")}> 
              {formatTime(time)}
            </div>
          </div>
          <div className="mt-0.5 truncate text-sm text-[#9caeb4]">{preview}</div>
        </div>

        <div className="flex flex-col items-end gap-1 pt-0.5">
          {unreadCount > 0 ? (
            <div className="flex size-5 items-center justify-center rounded-full bg-[#00d26a] text-[10px] font-semibold text-[#081319]">
              {unreadCount}
            </div>
          ) : active ? (
            <BellOff className="size-4 text-[#91a3a9]" />
          ) : (
            <Pin className="size-4 text-[#7f9197]" />
          )}
        </div>
      </div>
    </Link>
  );
}

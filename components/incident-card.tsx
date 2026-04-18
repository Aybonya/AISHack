"use client";

import { AlertTriangle, Check, Clock3, MapPin, ShieldAlert, User2, X } from "lucide-react";
import { useState } from "react";

import { useAppState } from "@/components/providers/app-provider";
import type { Incident } from "@/lib/types";
import { cn, formatDateLabel, formatTime } from "@/lib/utils";

const priorityStyles = {
  high: "bg-[#1d241d] text-[#cfe7b7]",
  medium: "bg-[#211d16] text-[#e6d19d]",
  low: "bg-[#13221a] text-[#a8dfc2]",
} as const;

function priorityLabel(priority: Incident["priority"]) {
  if (priority === "high") {
    return "Высокий";
  }

  if (priority === "medium") {
    return "Средний";
  }

  return "Низкий";
}

function statusLabel(status: Incident["status"]) {
  if (status === "in_progress") {
    return "В работе";
  }

  if (status === "resolved") {
    return "Решено";
  }

  return "Новый";
}

export function IncidentCard({ incident }: { incident: Incident }) {
  const { state, updateIncidentStatus } = useAppState();
  const [open, setOpen] = useState(false);
  const assignee = state.users.find((user) => user.id === incident.assignedToUserId);

  return (
    <>
      <button
        className="w-full rounded-[26px] bg-[#121c21] px-6 py-5 text-left transition hover:bg-[#162129]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
              <ShieldAlert className="size-4 text-[#73dba5]" />
              {statusLabel(incident.status)}
            </div>
            <div className="mt-3 text-[1.1rem] font-semibold text-white">{incident.title}</div>
            <div className="mt-2 text-sm leading-7 text-[#8ea0a7]">{incident.description}</div>
          </div>

          <div className={cn("rounded-full px-3 py-1.5 text-xs", priorityStyles[incident.priority])}>
            {priorityLabel(incident.priority)}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-[#9fb1b7]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-2">
            <MapPin className="size-4 text-[#69d79a]" />
            {incident.location}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-2">
            <User2 className="size-4 text-[#69d79a]" />
            {assignee?.name ?? "Не назначено"}
          </div>
          <div className="text-[#75888f]">
            {formatDateLabel(incident.createdAt)}, {formatTime(incident.createdAt)}
          </div>
        </div>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[30px] bg-[#10181d] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.42)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">Инцидент</div>
                <div className="mt-2 text-2xl font-semibold text-white">{incident.title}</div>
                <div className="mt-3 text-sm leading-7 text-[#8ea0a7]">{incident.description}</div>
              </div>
              <button
                className="flex size-10 items-center justify-center rounded-full bg-white/[0.04] text-[#c8d4d8] transition hover:bg-white/[0.08] hover:text-white"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] bg-[#121d22] px-4 py-4">
                <div className="text-sm text-[#8ea0a7]">Локация</div>
                <div className="mt-2 text-base text-white">{incident.location}</div>
              </div>

              <div className="rounded-[22px] bg-[#121d22] px-4 py-4">
                <div className="text-sm text-[#8ea0a7]">Ответственный</div>
                <div className="mt-2 text-base text-white">{assignee?.name ?? "Не назначено"}</div>
              </div>

              <div className="rounded-[22px] bg-[#121d22] px-4 py-4">
                <div className="text-sm text-[#8ea0a7]">Приоритет</div>
                <div className="mt-2 text-base text-white">{priorityLabel(incident.priority)}</div>
              </div>

              <div className="rounded-[22px] bg-[#121d22] px-4 py-4">
                <div className="text-sm text-[#8ea0a7]">Создано</div>
                <div className="mt-2 text-base text-white">
                  {formatDateLabel(incident.createdAt)}, {formatTime(incident.createdAt)}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                className="rounded-full bg-white/[0.05] px-4 py-2.5 text-sm text-[#d7e0e3] transition hover:bg-white/[0.08]"
                onClick={() => updateIncidentStatus(incident.id, "new")}
                type="button"
              >
                <AlertTriangle className="mr-2 inline size-4" />
                Новый
              </button>
              <button
                className="rounded-full bg-[#10271f] px-4 py-2.5 text-sm text-[#bdf6d7] transition hover:bg-[#133025]"
                onClick={() => updateIncidentStatus(incident.id, "in_progress")}
                type="button"
              >
                <Clock3 className="mr-2 inline size-4" />
                В работу
              </button>
              <button
                className="rounded-full bg-[#103529] px-4 py-2.5 text-sm text-[#d8fff0] transition hover:bg-[#134232]"
                onClick={() => updateIncidentStatus(incident.id, "resolved")}
                type="button"
              >
                <Check className="mr-2 inline size-4" />
                Решено
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

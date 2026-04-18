"use client";

import { CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";

import { IncidentCard } from "@/components/incident-card";
import { useAppState } from "@/components/providers/app-provider";

export function IncidentsPageView() {
  const { state } = useAppState();
  const active = state.incidents.filter((incident) => incident.status !== "resolved");
  const resolved = state.incidents.filter((incident) => incident.status === "resolved");
  const inProgress = state.incidents.filter((incident) => incident.status === "in_progress");

  return (
    <div className="h-full overflow-auto px-4 py-5 xl:px-6 xl:py-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#6f8b82]">AISana</div>
            <h1 className="mt-2 text-[2.4rem] font-semibold tracking-tight text-white">
              Инциденты и хозяйственные сигналы
            </h1>
            <div className="mt-2 text-sm text-[#8ea0a7]">
              Карточки проблем, которые AISana поднимает из школьных чатов и сервисных сообщений.
            </div>
          </div>

          <div className="rounded-full bg-[#103529] px-4 py-2.5 text-sm text-[#d8fff0]">
            {active.length} активных кейсов
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] bg-[#10181d] px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
              <ShieldAlert className="size-4 text-[#73dba5]" />
              Активные
            </div>
            <div className="mt-3 text-[1.85rem] font-semibold leading-none text-white">{active.length}</div>
          </div>

          <div className="rounded-[22px] bg-[#10181d] px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
              <Sparkles className="size-4 text-[#73dba5]" />
              В работе
            </div>
            <div className="mt-3 text-[1.85rem] font-semibold leading-none text-white">{inProgress.length}</div>
          </div>

          <div className="rounded-[22px] bg-[#10181d] px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
              <CheckCircle2 className="size-4 text-[#73dba5]" />
              Закрытые
            </div>
            <div className="mt-3 text-[1.85rem] font-semibold leading-none text-white">{resolved.length}</div>
          </div>
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <section className="rounded-[28px] bg-[#0f171c] px-4 py-4">
            <div className="px-2">
              <div className="text-xl font-semibold text-white">Требуют внимания</div>
              <div className="mt-1 text-sm text-[#8ea0a7]">Новые и выполняемые обращения</div>
            </div>

            <div className="mt-4 h-px bg-white/[0.04]" />

            <div className="mt-4 space-y-3">
              {active.length > 0 ? (
                active.map((incident) => <IncidentCard incident={incident} key={incident.id} />)
              ) : (
                <div className="px-2 py-10 text-sm text-[#61757d]">Нет активных инцидентов</div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] bg-[#0f171c] px-4 py-4">
            <div className="px-2">
              <div className="text-xl font-semibold text-white">Закрытые кейсы</div>
              <div className="mt-1 text-sm text-[#8ea0a7]">История решённых обращений</div>
            </div>

            <div className="mt-4 h-px bg-white/[0.04]" />

            <div className="mt-4 space-y-3">
              {resolved.length > 0 ? (
                resolved.map((incident) => <IncidentCard incident={incident} key={incident.id} />)
              ) : (
                <div className="rounded-[22px] bg-[#121c21] px-5 py-5 text-sm text-[#7f9198]">
                  Пока нет закрытых карточек.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import { CheckCircle2, CircleDot, Sparkles } from "lucide-react";

export function TaskSummaryRow({
  total,
  urgent,
  completed,
}: {
  total: number;
  urgent: number;
  completed: number;
}) {
  const items = [
    { label: "Всего", value: total, icon: CircleDot },
    { label: "Срочные", value: urgent, icon: Sparkles },
    { label: "Выполнено сегодня", value: completed, icon: CheckCircle2 },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map(({ label, value, icon: Icon }) => (
        <div
          className="rounded-[22px] bg-[#10181d] px-5 py-4"
          key={label}
        >
          <div className="flex items-center gap-2 text-sm text-[#8ea0a7]">
            <Icon className="size-4 text-[#73dba5]" />
            {label}
          </div>
          <div className="mt-3 text-[1.85rem] font-semibold leading-none text-white">{value}</div>
        </div>
      ))}
    </div>
  );
}

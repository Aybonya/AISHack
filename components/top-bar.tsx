import type { ReactNode } from "react";

import { formatLongDate } from "@/lib/utils";

export function TopBar({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[1.8rem] border border-white/[0.05] bg-[#11191e] px-6 py-5 shadow-[0_16px_36px_rgba(0,0,0,0.2)] sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.24em] text-accent/80">
          {formatLongDate(new Date().toISOString())}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="text-sm leading-6 text-muted">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">{action}</div>
    </div>
  );
}

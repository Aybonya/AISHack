import type { LucideIcon } from "lucide-react";

import { Panel } from "@/components/panel";
import { cn } from "@/lib/utils";

export function StatWidget({
  title,
  value,
  detail,
  icon: Icon,
  className,
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Panel className={cn("space-y-4 bg-panel-2/80", className)}>
      <div className="flex items-center justify-between">
        <div className="rounded-2xl border border-accent/20 bg-accent-soft p-3 text-accent">
          <Icon className="size-5" />
        </div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted">live</div>
      </div>
      <div className="space-y-1">
        <div className="text-sm text-muted">{title}</div>
        <div className="text-3xl font-semibold text-white">{value}</div>
        <div className="text-sm text-foreground/75">{detail}</div>
      </div>
    </Panel>
  );
}

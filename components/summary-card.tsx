import type { ReactNode } from "react";

import { Panel } from "@/components/panel";
import { cn } from "@/lib/utils";

export function SummaryCard({
  eyebrow,
  title,
  value,
  description,
  action,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  value?: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          {eyebrow ? (
            <div className="text-[11px] uppercase tracking-[0.24em] text-accent/80">{eyebrow}</div>
          ) : null}
          <div className="text-sm font-medium text-foreground/90">{title}</div>
          {value ? <div className="text-3xl font-semibold text-white">{value}</div> : null}
          {description ? <div className="text-sm leading-6 text-muted">{description}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </Panel>
  );
}
